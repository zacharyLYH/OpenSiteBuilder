package main

import (
	"net/http"
)

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
