package main

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"opensitebuilder-backend/internal/config"
	"opensitebuilder-backend/internal/github"
	"opensitebuilder-backend/internal/server"
)

// HTTP server timeouts. WriteTimeout is generous because a publish fans out
// into several GitHub API calls.
const (
	readHeaderTimeout = 5 * time.Second
	readTimeout       = 30 * time.Second
	writeTimeout      = 120 * time.Second
	idleTimeout       = 120 * time.Second
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config invalid", "err", err)
		os.Exit(1)
	}
	// The App cannot sign anything without its key; fail loudly at boot.
	if _, err := github.MintAppJWT(cfg); err != nil {
		panic("private key unavailable: " + err.Error())
	}
	s := server.New(cfg, github.NewClient(cfg.GitHubAPIBase, cfg.GitHubOAuthBase))

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           server.NewMux(s),
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       readTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
	}
	slog.Info("backend listening", "addr", cfg.Addr)
	if err := srv.ListenAndServe(); err != nil {
		slog.Error("server stopped", "err", err)
		os.Exit(1)
	}
}
