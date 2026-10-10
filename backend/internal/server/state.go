package server

import (
	"net/http"
	"time"

	"opensitebuilder-backend/internal/auth"
	"opensitebuilder-backend/internal/validate"
)

// GET /api/state?slug= issues a signed state for R1.
func (s *Server) handleState(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	slug := r.URL.Query().Get("slug")
	if !validate.ValidSlug(slug) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad slug (lowercase letters, numbers, hyphens)"})
		return
	}
	st, err := auth.SignToken(s.Cfg.SessionKey, auth.StatePayload{Slug: slug, Exp: time.Now().Add(10 * time.Minute).Unix()})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "sign failed"})
		return
	}
	// Same cookie jar carries state across the install leg, which echoes
	// no parameters back. Short-lived and HttpOnly by construction.
	http.SetCookie(w, &http.Cookie{
		Name: "osb_pending", Value: st, Path: "/",
		HttpOnly: true, SameSite: http.SameSiteLaxMode,
		Secure: s.Cfg.SecureCookies, MaxAge: 600,
	})
	writeJSON(w, http.StatusOK, map[string]string{"state": st, "slug": slug})
}
