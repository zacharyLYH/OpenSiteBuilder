package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
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
	if !requireMethod(w, r, http.MethodPost) {
		return
	}
	sess, err := s.readSession(r)
	if err != nil {
		fail(w, http.StatusUnauthorized, "login required")
		return
	}
	var in struct {
		Files   []publishFile `json:"files"`
		Message string        `json:"message"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<20)).Decode(&in); err != nil {
		fail(w, http.StatusBadRequest, "bad json")
		return
	}
	if err := checkFiles(in.Files); err != nil {
		fail(w, http.StatusBadRequest, err.Error())
		return
	}
	msg := strings.TrimSpace(in.Message)
	if msg == "" {
		msg = "osb publish"
	}
	if len(msg) > 200 {
		fail(w, http.StatusBadRequest, "message too long")
		return
	}
	appJWT, err := github.MintAppJWT(s.Cfg)
	if err != nil {
		fail(w, http.StatusInternalServerError, "app auth failed")
		return
	}
	token, err := s.Gh.CreateInstallToken(appJWT, sess.Inst)
	if err != nil {
		fail(w, http.StatusBadGateway, "install token failed")
		return
	}
	commit, err := s.Gh.CommitFiles(token, sess.Owner, sess.Slug, msg, fileOps(in.Files))
	if err != nil {
		if strings.Contains(err.Error(), "push conflict") {
			fail(w, http.StatusConflict, "push conflict, retry")
			return
		}
		slog.Error("publish failed", "owner", sess.Owner, "slug", sess.Slug, "err", err)
		fail(w, http.StatusBadGateway, "upload failed")
		return
	}
	slog.Info("publish ok", "owner", sess.Owner, "slug", sess.Slug, "files", len(in.Files), "commit", commit)
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
