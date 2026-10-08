package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"
)

var slugRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,99}$`)

// publishablePath reports whether path may be written through P1.
func publishablePath(p string) bool {
	if p == "" || strings.HasPrefix(p, "/") || strings.HasPrefix(p, "./") {
		return false
	}
	for _, seg := range strings.Split(p, "/") {
		if seg == "" || seg == "." || seg == ".." {
			return false
		}
	}
	lower := strings.ToLower(p)
	if lower == ".github" || strings.HasPrefix(lower, ".github/") {
		return false
	}
	if lower == ".git" || strings.HasPrefix(lower, ".git/") {
		return false
	}
	switch {
	case strings.HasPrefix(p, "src/"):
		return true
	case strings.HasPrefix(p, "public/"):
		return true
	case p == "index.html" || p == "package.json" || p == "vite.config.js" ||
		p == "tailwind.config.js" || p == "postcss.config.js":
		return true
	}
	return false
}

type server struct {
	cfg Config
	gh  *ghClient
}

func (s *server) sessionCookie(sess sessionPayload) (string, error) {
	tok, err := signToken(s.cfg.SessionKey, sess)
	if err != nil {
		return "", err
	}
	return tok, nil
}

func (s *server) readSession(r *http.Request) (*sessionPayload, error) {
	c, err := r.Cookie("osb_session")
	if err != nil {
		return nil, err
	}
	var sess sessionPayload
	if err := verifyToken(s.cfg.SessionKey, c.Value, &sess); err != nil {
		return nil, err
	}
	return &sess, nil
}

func (s *server) setSession(w http.ResponseWriter, tok string) {
	c := &http.Cookie{
		Name:     "osb_session",
		Value:    tok,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.cfg.SecureCookies,
		MaxAge:   7 * 24 * 3600,
	}
	http.SetCookie(w, c)
}

// GET /api/state?slug= issues a signed state for R1.
func (s *server) handleState(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	slug := r.URL.Query().Get("slug")
	if !slugRe.MatchString(slug) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad slug (lowercase letters, numbers, hyphens)"})
		return
	}
	st, err := signToken(s.cfg.SessionKey, statePayload{Slug: slug, Exp: time.Now().Add(10 * time.Minute).Unix()})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "sign failed"})
		return
	}
	// Same cookie jar carries state across the install leg, which echoes
	// no parameters back. Short-lived and HttpOnly by construction.
	http.SetCookie(w, &http.Cookie{
		Name: "osb_pending", Value: st, Path: "/",
		HttpOnly: true, SameSite: http.SameSiteLaxMode,
		Secure:   s.cfg.SecureCookies, MaxAge: 600,
	})
	writeJSON(w, http.StatusOK, map[string]string{"state": st, "slug": slug})
}

// POST /api/exchange {code, installation_id, state} runs E1+G1.
func (s *server) handleExchange(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var in struct {
		Code           string `json:"code"`
		InstallationID int64  `json:"installation_id"`
		State          string `json:"state"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad json"})
		return
	}
	if in.Code == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "code required"})
		return
	}
	state := in.State
	if state == "" {
		// Install leg returns no state; fall back to the pending cookie
		// set by /api/state in the same browser session.
		if c, err := r.Cookie("osb_pending"); err == nil {
			state = c.Value
		}
	}
	if state == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "state required (publish again to restart)"})
		return
	}
	var st statePayload
	if err := verifyToken(s.cfg.SessionKey, state, &st); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad state: " + err.Error()})
		return
	}
	// Mint first: installation lookup costs nothing single-use.
	appJWT, err := mintAppJWT(s.cfg)
	if err != nil {
		log.Printf("app jwt failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "app auth failed"})
		return
	}
	userToken, err := s.gh.exchangeCode(s.cfg, in.Code)
	if err != nil {
		log.Printf("exchange code failed slug=%s: %v", st.Slug, err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "github authorization failed"})
		return
	}
	// Owner comes from the token, never from user input.
	login, err := s.gh.authenticatedUser(userToken)
	if err != nil {
		log.Printf("user lookup failed slug=%s: %v", st.Slug, err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "github authorization failed"})
		return
	}
	instID := in.InstallationID
	if instID == 0 {
		found, err := s.gh.findInstallation(appJWT, login)
		if err != nil {
			log.Printf("installation list failed: %v", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "installation lookup failed"})
			return
		}
		if found == 0 {
			writeJSON(w, http.StatusConflict, map[string]any{
				"error":       "app not installed on this account",
				"install_url": "https://github.com/apps/" + s.cfg.AppSlug + "/installations/new",
			})
			return
		}
		instID = found
	} else {
		instLogin, _, _, err := s.gh.installationInfo(appJWT, instID)
		if err != nil {
			log.Printf("installation lookup failed id=%d: %v", instID, err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "installation lookup failed"})
			return
		}
		if !strings.EqualFold(instLogin, login) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "installation belongs to another account"})
			return
		}
	}
	exists, err := s.gh.repoExists(userToken, login, st.Slug)
	if err != nil {
		log.Printf("repo lookup failed %s/%s: %v", login, st.Slug, err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "github lookup failed"})
		return
	}
	created := false
	if !exists {
		if err := s.gh.generateRepo(userToken, s.cfg.TemplateOwner, s.cfg.TemplateRepo, login, st.Slug); err != nil {
			log.Printf("repo generate failed %s/%s: %v", login, st.Slug, err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "repo creation failed"})
			return
		}
		created = true
	}
	installToken, err := s.gh.createInstallToken(appJWT, instID)
	if err != nil {
		log.Printf("install token failed id=%d: %v", instID, err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "install token failed"})
		return
	}
	if err := s.gh.ensurePages(installToken, login, st.Slug); err != nil {
		log.Printf("pages enable failed %s/%s: %v", login, st.Slug, err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "pages enable failed"})
		return
	}
	tok, err := s.sessionCookie(sessionPayload{
		Owner: login, Slug: st.Slug, Inst: instID,
		Exp: time.Now().Add(7 * 24 * time.Hour).Unix(),
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "session failed"})
		return
	}
	s.setSession(w, tok)
	// Pending state served its purpose; clear it.
	http.SetCookie(w, &http.Cookie{Name: "osb_pending", Value: "", Path: "/", MaxAge: -1})
	log.Printf("exchange ok owner=%s slug=%s created=%v", login, st.Slug, created)
	writeJSON(w, http.StatusOK, map[string]any{
		"owner": login, "slug": st.Slug, "created": created,
		"url": fmt.Sprintf("https://%s.github.io/%s/", login, st.Slug),
	})
}

// GET /api/repo?slug=[&path=] lists files or returns one file.
// Owner comes from the session, never from the query.
func (s *server) handleRepo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	sess, err := s.readSession(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "login required"})
		return
	}
	slug, path := r.URL.Query().Get("slug"), r.URL.Query().Get("path")
	if slug != sess.Slug {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "session covers another site"})
		return
	}
	owner := sess.Owner
	appJWT, err := mintAppJWT(s.cfg)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "app auth failed"})
		return
	}
	token, err := s.gh.createInstallToken(appJWT, sess.Inst)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "install token failed"})
		return
	}
	if path != "" {
		if !publishablePath(path) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "path not readable"})
			return
		}
		content, sha, err := s.gh.fileContent(token, owner, slug, path)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "file lookup failed"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"path": path, "content": content, "sha": sha})
		return
	}
	tree, err := s.gh.repoTree(token, owner, slug)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "repo lookup failed"})
		return
	}
	files := []map[string]any{}
	for _, e := range tree {
		if e.Type != "blob" || !publishablePath(e.Path) {
			continue
		}
		size := 0
		if e.Size != nil {
			size = *e.Size
		}
		files = append(files, map[string]any{"path": e.Path, "sha": e.SHA, "size": size})
	}
	writeJSON(w, http.StatusOK, map[string]any{"owner": owner, "slug": slug, "files": files})
}

// POST /api/publish {files:[{path,content}], message?} runs P1.
func (s *server) handlePublish(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	sess, err := s.readSession(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "login required"})
		return
	}
	var in struct {
		Files []struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		} `json:"files"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<20)).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad json"})
		return
	}
	if len(in.Files) == 0 || len(in.Files) > 20 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "files count must be 1..20"})
		return
	}
	seen := map[string]bool{}
	for _, f := range in.Files {
		if !publishablePath(f.Path) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "blocked path: " + f.Path})
			return
		}
		if seen[f.Path] {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "duplicate path: " + f.Path})
			return
		}
		seen[f.Path] = true
		if len(f.Content) > 200*1024 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "file too large: " + f.Path})
			return
		}
	}
	msg := strings.TrimSpace(in.Message)
	if msg == "" {
		msg = "osb publish"
	}
	if len(msg) > 200 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message too long"})
		return
	}
	appJWT, err := mintAppJWT(s.cfg)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "app auth failed"})
		return
	}
	token, err := s.gh.createInstallToken(appJWT, sess.Inst)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "install token failed"})
		return
	}
	base, err := s.gh.refSHA(token, sess.Owner, sess.Slug)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "branch lookup failed"})
		return
	}
	entries := make([]treeEntry, 0, len(in.Files))
	for _, f := range in.Files {
		sha, err := s.gh.createBlob(token, sess.Owner, sess.Slug, f.Content)
		if err != nil {
			log.Printf("blob failed %s/%s %s: %v", sess.Owner, sess.Slug, f.Path, err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "upload failed"})
			return
		}
		entries = append(entries, treeEntry{Path: f.Path, Mode: "100644", Type: "blob", SHA: sha})
	}
	tree, err := s.gh.createTree(token, sess.Owner, sess.Slug, base, entries)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "tree failed"})
		return
	}
	commit, err := s.gh.createCommit(token, sess.Owner, sess.Slug, msg, tree, base)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "commit failed"})
		return
	}
	if err := s.gh.updateRef(token, sess.Owner, sess.Slug, commit); err != nil {
		log.Printf("ref update failed %s/%s: %v", sess.Owner, sess.Slug, err)
		writeJSON(w, http.StatusConflict, map[string]string{"error": "push conflict, retry"})
		return
	}
	log.Printf("publish ok owner=%s slug=%s files=%d commit=%.7s", sess.Owner, sess.Slug, len(in.Files), commit)
	writeJSON(w, http.StatusOK, map[string]string{
		"commit": commit,
		"url":    fmt.Sprintf("https://%s.github.io/%s/", sess.Owner, sess.Slug),
	})
}
