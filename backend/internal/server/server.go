package server

import (
	"net/http"

	"opensitebuilder-backend/internal/auth"
	"opensitebuilder-backend/internal/config"
	"opensitebuilder-backend/internal/github"
)

// Server carries config and the GitHub client to every handler.
type Server struct {
	Cfg config.Config
	Gh  *github.Client
}

// New wires config and GitHub client into a Server.
func New(cfg config.Config, gh *github.Client) *Server {
	return &Server{Cfg: cfg, Gh: gh}
}

// NewMux wires every route.
func NewMux(s *Server) *http.ServeMux {
	mux := http.NewServeMux()
	health := func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
	mux.HandleFunc("/healthz", health)
	mux.HandleFunc("/api/healthz", health)
	mux.HandleFunc("/api/state", s.handleState)
	mux.HandleFunc("/api/exchange", s.handleExchange)
	mux.HandleFunc("/api/repo", s.handleRepo)
	mux.HandleFunc("/api/publish", s.handlePublish)
	return mux
}

func (s *Server) sessionCookie(sess auth.SessionPayload) (string, error) {
	tok, err := auth.SignToken(s.Cfg.SessionKey, sess)
	if err != nil {
		return "", err
	}
	return tok, nil
}

func (s *Server) readSession(r *http.Request) (*auth.SessionPayload, error) {
	c, err := r.Cookie("osb_session")
	if err != nil {
		return nil, err
	}
	var sess auth.SessionPayload
	if err := auth.VerifyToken(s.Cfg.SessionKey, c.Value, &sess); err != nil {
		return nil, err
	}
	return &sess, nil
}

func (s *Server) setSession(w http.ResponseWriter, tok string) {
	c := &http.Cookie{
		Name:     "osb_session",
		Value:    tok,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.Cfg.SecureCookies,
		MaxAge:   7 * 24 * 3600,
	}
	http.SetCookie(w, c)
}
