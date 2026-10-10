package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"

	"opensitebuilder-backend/internal/github"
	"opensitebuilder-backend/internal/validate"
)

// publishFile is one validated file in a P1 request.
type publishFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// POST /api/publish {files:[{path,content}], message?} runs P1.
func (s *Server) handlePublish(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	sess, err := s.readSession(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "login required"})
		return
	}
	var in struct {
		Files   []publishFile `json:"files"`
		Message string        `json:"message"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<20)).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad json"})
		return
	}
	if err := checkFiles(in.Files); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	msg := strings.TrimSpace(in.Message)
	if msg == "" {
		msg = "osb publish"
	}
	if len(msg) > 200 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message too long"})
		return
	}
	appJWT, err := github.MintAppJWT(s.Cfg)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "app auth failed"})
		return
	}
	token, err := s.Gh.CreateInstallToken(appJWT, sess.Inst)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "install token failed"})
		return
	}
	commit, err := s.Gh.CommitFiles(token, sess.Owner, sess.Slug, msg, fileOps(in.Files))
	if err != nil {
		if strings.Contains(err.Error(), "push conflict") {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "push conflict, retry"})
			return
		}
		log.Printf("publish failed %s/%s: %v", sess.Owner, sess.Slug, err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "upload failed"})
		return
	}
	log.Printf("publish ok owner=%s slug=%s files=%d commit=%.7s", sess.Owner, sess.Slug, len(in.Files), commit)
	writeJSON(w, http.StatusOK, map[string]string{
		"commit": commit,
		"url":    fmt.Sprintf("https://%s.github.io/%s/", sess.Owner, sess.Slug),
	})
}

// fileOps converts request files to commit operations.
func fileOps(files []publishFile) []github.FileOp {
	ops := make([]github.FileOp, 0, len(files))
	for _, f := range files {
		ops = append(ops, github.FileOp{Path: f.Path, Content: f.Content})
	}
	return ops
}

// checkFiles enforces count, allowlist, duplicates, and size caps.
func checkFiles(files []publishFile) error {
	if len(files) == 0 || len(files) > 20 {
		return errors.New("files count must be 1..20")
	}
	seen := map[string]bool{}
	for _, f := range files {
		if !validate.PublishablePath(f.Path) {
			return errors.New("blocked path: " + f.Path)
		}
		if seen[f.Path] {
			return errors.New("duplicate path: " + f.Path)
		}
		seen[f.Path] = true
		if len(f.Content) > 200*1024 {
			return errors.New("file too large: " + f.Path)
		}
	}
	return nil
}
