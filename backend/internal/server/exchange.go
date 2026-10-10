package server

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"opensitebuilder-backend/internal/auth"
	"opensitebuilder-backend/internal/github"
)

// POST /api/exchange {code, installation_id?, state?} runs E1+G1.
// Owner comes from the token, never from user input. State falls back
// to the pending cookie when the install leg drops it from the URL.
func (s *Server) handleExchange(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodPost) {
		return
	}
	var in struct {
		Code           string `json:"code"`
		InstallationID int64  `json:"installation_id"`
		State          string `json:"state"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&in); err != nil {
		fail(w, http.StatusBadRequest, "bad json")
		return
	}
	if in.Code == "" {
		fail(w, http.StatusBadRequest, "code required")
		return
	}
	state := in.State
	if state == "" {
		if c, err := r.Cookie("osb_pending"); err == nil {
			state = c.Value
		}
	}
	if state == "" {
		fail(w, http.StatusBadRequest, "state required (publish again to restart)")
		return
	}
	var st auth.StatePayload
	if err := auth.VerifyToken(s.Cfg.SessionKey, state, &st); err != nil {
		fail(w, http.StatusBadRequest, "bad state: "+err.Error())
		return
	}
	// Mint first: installation lookup costs nothing single-use.
	appJWT, err := github.MintAppJWT(s.Cfg)
	if err != nil {
		slog.Error("app jwt failed", "err", err)
		fail(w, http.StatusInternalServerError, "app auth failed")
		return
	}
	userToken, err := s.Gh.ExchangeCode(s.Cfg, in.Code)
	if err != nil {
		slog.Error("exchange code failed", "slug", st.Slug, "err", err)
		fail(w, http.StatusBadGateway, "github authorization failed")
		return
	}
	login, err := s.Gh.AuthenticatedUser(userToken)
	if err != nil {
		slog.Error("user lookup failed", "slug", st.Slug, "err", err)
		fail(w, http.StatusBadGateway, "github authorization failed")
		return
	}
	instID := in.InstallationID
	if instID == 0 {
		found, err := s.Gh.FindInstallation(appJWT, login)
		if err != nil {
			slog.Error("installation list failed", "err", err)
			fail(w, http.StatusBadGateway, "installation lookup failed")
			return
		}
		if found == 0 {
			writeJSON(w, http.StatusConflict, map[string]any{
				"error":       "app not installed on this account",
				"install_url": "https://github.com/apps/" + s.Cfg.AppSlug + "/installations/new",
			})
			return
		}
		instID = found
	} else {
		instLogin, err := s.Gh.InstallationAccount(appJWT, instID)
		if err != nil {
			slog.Error("installation lookup failed", "id", instID, "err", err)
			fail(w, http.StatusBadGateway, "installation lookup failed")
			return
		}
		if !strings.EqualFold(instLogin, login) {
			fail(w, http.StatusForbidden, "installation belongs to another account")
			return
		}
	}
	exists, err := s.Gh.RepoExists(userToken, login, st.Slug)
	if err != nil {
		slog.Error("repo lookup failed", "owner", login, "slug", st.Slug, "err", err)
		fail(w, http.StatusBadGateway, "github lookup failed")
		return
	}
	created := false
	if !exists {
		if err := s.Gh.GenerateRepo(userToken, s.Cfg.TemplateOwner, s.Cfg.TemplateRepo, login, st.Slug); err != nil {
			slog.Error("repo generate failed", "owner", login, "slug", st.Slug, "err", err)
			fail(w, http.StatusBadGateway, "repo creation failed")
			return
		}
		created = true
	}
	installToken, err := s.Gh.CreateInstallToken(appJWT, instID)
	if err != nil {
		slog.Error("install token failed", "id", instID, "err", err)
		fail(w, http.StatusBadGateway, "install token failed")
		return
	}
	if err := s.Gh.EnsurePages(installToken, login, st.Slug); err != nil {
		slog.Error("pages enable failed", "owner", login, "slug", st.Slug, "err", err)
		fail(w, http.StatusBadGateway, "pages enable failed")
		return
	}
	tok, err := auth.SignToken(s.Cfg.SessionKey, auth.SessionPayload{
		Owner: login, Slug: st.Slug, Inst: instID,
		Exp: time.Now().Add(sessionTTL).Unix(),
	})
	if err != nil {
		fail(w, http.StatusInternalServerError, "session failed")
		return
	}
	s.setSession(w, tok)
	// Pending state served its purpose; clear it.
	http.SetCookie(w, &http.Cookie{Name: "osb_pending", Value: "", Path: "/", MaxAge: -1})
	slog.Info("exchange ok", "owner", login, "slug", st.Slug, "created", created)
	writeJSON(w, http.StatusOK, map[string]any{
		"owner": login, "slug": st.Slug, "created": created,
		"url": fmt.Sprintf("https://%s.github.io/%s/", login, st.Slug),
	})
}
