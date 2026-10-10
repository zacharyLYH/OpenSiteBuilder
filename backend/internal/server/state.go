package server

import (
	"net/http"
	"time"

	"opensitebuilder-backend/internal/auth"
	"opensitebuilder-backend/internal/validate"
)

// GET /api/state?slug= issues a signed state for R1.
func (s *Server) handleState(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodGet) {
		return
	}
	slug := r.URL.Query().Get("slug")
	if !validate.ValidSlug(slug) {
		fail(w, http.StatusBadRequest, "bad slug (lowercase letters, numbers, hyphens)")
		return
	}
	st, err := auth.SignToken(s.Cfg.SessionKey, auth.StatePayload{Slug: slug, Exp: time.Now().Add(stateTTL).Unix()})
	if err != nil {
		fail(w, http.StatusInternalServerError, "sign failed")
		return
	}
	// Same cookie jar carries state across the install leg, which echoes
	// no parameters back. HttpOnly by construction.
	http.SetCookie(w, &http.Cookie{
		Name: "osb_pending", Value: st, Path: "/",
		HttpOnly: true, SameSite: http.SameSiteLaxMode,
		Secure: s.Cfg.SecureCookies, MaxAge: int(stateTTL.Seconds()),
	})
	// client_id rides along so the frontend never hardcodes it (single source).
	writeJSON(w, http.StatusOK, map[string]string{"state": st, "slug": slug, "client_id": s.Cfg.ClientID})
}
