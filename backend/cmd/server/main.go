package main

import (
	"flag"
	"log"
	"net/http"

	"opensitebuilder-backend/internal/config"
	"opensitebuilder-backend/internal/github"
	"opensitebuilder-backend/internal/server"
)

func main() {
	cfg := config.Load()
	flag.Parse()

	s := server.New(cfg, github.NewClientWithBases(cfg.GitHubAPIBase, cfg.GitHubOAuthBase))

	mux := server.NewMux(s)

	log.Printf("backend listening on %s", cfg.Addr)
	if err := http.ListenAndServe(cfg.Addr, mux); err != nil {
		log.Fatal(err)
	}
}
