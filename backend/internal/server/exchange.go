package server

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"opensitebuilder-backend/internal/auth"
	"opensitebuilder-backend/internal/github"
)

// POST /api/exchange {code, installation_id?, state?} runs E1+G1.
// Owner comes from the token, never from user input. State falls back
// to the pending cookie when the install leg drops it from the URL.
func (s *Server) handleExchange(w http.ResponseWriter, r *http.Request) {
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
		if c, err := r.Cookie("osb_pending"); err == nil {
			state = c.Value
		}
	}
	if state == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "state required (publish again to restart)"})
		return
	}
	var st auth.StatePayload
	if err := auth.VerifyToken(s.Cfg.SessionKey, state, &st); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad state: " + err.Error()})
		return
	}
	// Mint first: installation lookup costs nothing single-use.
	appJWT, err := github.MintAppJWT(s.Cfg)
	if err != nil {
		log.Printf("app jwt failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "app auth failed"})
		return
	}
	userToken, err := s.Gh.ExchangeCode(s.Cfg, in.Code)
	if err != nil {
		log.Printf("exchange code failed slug=%s: %v", st.Slug, err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "github authorization failed"})
		return
	}
	login, err := s.Gh.AuthenticatedUser(userToken)
	if err != nil {
		log.Printf("user lookup failed slug=%s: %v", st.Slug, err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "github authorization failed"})
		return
	}
	instID := in.InstallationID
	if instID == 0 {
		found, err := s.Gh.FindInstallation(appJWT, login)
		if err != nil {
			log.Printf("installation list failed: %v", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "installation lookup failed"})
			return
		}
		if found == 0 {
			writeJSON(w, http.StatusConflict, map[string]any{
				"error":       "app not installed on this account",
				"install_url": "https://github.com/apps/" + s.Cfg.AppSlug + "/installations/new",
			})
			return
		}
		instID = found
	} else {
		instLogin, _, _, err := s.Gh.InstallationInfo(appJWT, instID)
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
	exists, err := s.Gh.RepoExists(userToken, login, st.Slug)
	if err != nil {
		log.Printf("repo lookup failed %s/%s: %v", login, st.Slug, err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "github lookup failed"})
		return
	}
	created := false
	if !exists {
		if err := s.Gh.GenerateRepo(userToken, s.Cfg.TemplateOwner, s.Cfg.TemplateRepo, login, st.Slug); err != nil {
			log.Printf("repo generate failed %s/%s: %v", login, st.Slug, err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "repo creation failed"})
			return
		}
		created = true
	}
	installToken, err := s.Gh.CreateInstallToken(appJWT, instID)
	if err != nil {
		log.Printf("install token failed id=%d: %v", instID, err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "install token failed"})
		return
	}
	if err := s.Gh.EnsurePages(installToken, login, st.Slug); err != nil {
		log.Printf("pages enable failed %s/%s: %v", login, st.Slug, err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "pages enable failed"})
		return
	}
	tok, err := s.sessionCookie(auth.SessionPayload{
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
