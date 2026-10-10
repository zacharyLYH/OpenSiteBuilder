package main

import (
	"net/http"
)

// server carries config and the GitHub client to every handler.
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
