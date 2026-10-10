package main

import (
	"net/http"
	"time"
)

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
		Secure: s.cfg.SecureCookies, MaxAge: 600,
	})
	writeJSON(w, http.StatusOK, map[string]string{"state": st, "slug": slug})
}
