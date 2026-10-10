package server

import (
	"net/http"
	"time"

	"opensitebuilder-backend/internal/auth"
	"opensitebuilder-backend/internal/config"
	"opensitebuilder-backend/internal/github"
)

// Timeouts, in one place.
const (
	// sessionTTL bounds how long a signed editor session stays usable.
	sessionTTL = 24 * time.Hour
	// stateTTL is the window to finish the GitHub authorize + install journey
	// before the signed state (and its pending cookie) expire.
	stateTTL = 10 * time.Minute
)

// Per-client-IP API budget (all API routes share one bucket).
const (
	apiRatePerMinute = 120
	apiBurst         = 30
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
		if !requireMethod(w, r, http.MethodGet) {
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
	mux.HandleFunc("/healthz", health)
	api := newRateLimiter(apiRatePerMinute, apiBurst)
	mux.HandleFunc("/api/state", api.middleware(s.handleState))
	mux.HandleFunc("/api/exchange", api.middleware(s.handleExchange))
	mux.HandleFunc("/api/publish", api.middleware(s.handlePublish))
	return mux
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
	http.SetCookie(w, &http.Cookie{
		Name:     "osb_session",
		Value:    tok,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.Cfg.SecureCookies,
		MaxAge:   int(sessionTTL.Seconds()),
	})
}
