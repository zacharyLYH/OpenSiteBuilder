package main

import (
	"flag"
	"log"
	"net/http"
)

type status struct {
	OK bool `json:"ok"`
}

func main() {
	cfg := loadConfig()
	flag.Parse()

	s := &server{cfg: cfg, gh: newGHClient()}

	mux := http.NewServeMux()
	health := func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		writeJSON(w, http.StatusOK, status{OK: true})
	}
	mux.HandleFunc("/healthz", health)
	mux.HandleFunc("/api/healthz", health)
	mux.HandleFunc("/api/state", s.handleState)
	mux.HandleFunc("/api/exchange", s.handleExchange)
	mux.HandleFunc("/api/repo", s.handleRepo)
	mux.HandleFunc("/api/publish", s.handlePublish)

	log.Printf("backend listening on %s", cfg.Addr)
	if err := http.ListenAndServe(cfg.Addr, mux); err != nil {
		log.Fatal(err)
	}
}
