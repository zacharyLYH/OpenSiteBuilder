package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
)

type status struct {
	OK bool `json:"ok"`
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func main() {
	addr := getenv("ADDR", ":18081")
	flag.Parse()

	required := []string{"APP_ID", "CLIENT_ID", "PRIVATE_KEY_PATH", "SESSION_HMAC_KEY", "PUBLIC_BASE_URL"}
	for _, k := range required {
		if os.Getenv(k) == "" {
			log.Printf("warn: env %s is empty", k)
		}
	}

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
	mux.HandleFunc("/api/exchange", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusNotImplemented, map[string]string{"error": "exchange not implemented"})
	})
	mux.HandleFunc("/api/publish", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusNotImplemented, map[string]string{"error": "publish not implemented"})
	})

	log.Printf("backend listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func getenv(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}
