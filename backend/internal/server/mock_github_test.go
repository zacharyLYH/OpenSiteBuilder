package server

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

// Fixed tokens the mock hands out. Tests assert which token each GitHub
// endpoint received, proving user vs install separation.
const (
	mockUserToken    = "gh-user-token"
	mockInstallToken = "gh-install-token"
	mockInstallID    = int64(7)
)

// mockOptions programs one scenario. Zero values select the happy path.
type mockOptions struct {
	// Identity.
	UserLogin    string // GET /user (default "maya")
	InstallLogin string // installation account (default "maya")
	// Repo state.
	RepoExists     bool // GET /repos/{o}/{r} (default false)
	GenerateStatus int  // default 201
	PagesStatus    int  // POST pages (default 201; use 409 for already-enabled)
	// Failure injection.
	ExchangeFails   bool // every code exchange fails like a spent code
	UpdateRefStatus int  // PATCH ref (default 200; 422 simulates push conflict)
}

// ghMock is the only GitHub double. One httptest server answers both the
// API and OAuth bases. Every hit records method+path and the bearer used.
type ghMock struct {
	t    *testing.T
	srv  *httptest.Server
	opts mockOptions

	mu           sync.Mutex
	calls        map[string]int
	tokens       map[string][]string
	blobCount    int
	generateBody string
}

func newGHMock(t *testing.T, opts mockOptions) *ghMock {
	t.Helper()
	if opts.UserLogin == "" {
		opts.UserLogin = "maya"
	}
	if opts.InstallLogin == "" {
		opts.InstallLogin = "maya"
	}
	if opts.GenerateStatus == 0 {
		opts.GenerateStatus = 201
	}
	if opts.PagesStatus == 0 {
		opts.PagesStatus = 201
	}
	if opts.UpdateRefStatus == 0 {
		opts.UpdateRefStatus = 200
	}
	m := &ghMock{t: t, opts: opts, calls: map[string]int{}, tokens: map[string][]string{}}
	m.srv = httptest.NewServer(http.HandlerFunc(m.serve))
	t.Cleanup(m.srv.Close)
	return m
}

func (m *ghMock) url() string { return m.srv.URL }

func (m *ghMock) record(r *http.Request) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := r.Method + " " + r.URL.Path
	m.calls[key]++
	if h := r.Header.Get("Authorization"); h != "" {
		m.tokens[key] = append(m.tokens[key], h)
	}
}

// Calls returns how many times method+path hit the mock.
func (m *ghMock) Calls(method, path string) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.calls[method+" "+path]
}

// Bearers returns every Authorization header seen on method+path.
func (m *ghMock) Bearers(method, path string) []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]string{}, m.tokens[method+" "+path]...)
}

func writeMockJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func (m *ghMock) serve(w http.ResponseWriter, r *http.Request) {
	m.record(r)
	p := r.URL.Path

	// OAuth base.
	if r.Method == "POST" && p == "/login/oauth/access_token" {
		if m.opts.ExchangeFails {
			writeMockJSON(w, 200, map[string]string{"error": "bad_verification_code"})
			return
		}
		writeMockJSON(w, 200, map[string]string{"access_token": mockUserToken})
		return
	}

	// Identity.
	if r.Method == "GET" && p == "/user" {
		writeMockJSON(w, 200, map[string]string{"login": m.opts.UserLogin})
		return
	}

	// Installations.
	if r.Method == "GET" && p == "/app/installations" {
		writeMockJSON(w, 200, []any{
			map[string]any{"id": mockInstallID, "account": map[string]string{"login": m.opts.InstallLogin}},
		})
		return
	}
	if r.Method == "GET" && strings.HasPrefix(p, "/app/installations/") {
		if p == fmt.Sprintf("/app/installations/%d", mockInstallID) {
			writeMockJSON(w, 200, map[string]any{
				"account":              map[string]string{"login": m.opts.InstallLogin},
				"repository_selection": "all",
			})
			return
		}
		writeMockJSON(w, 404, map[string]string{"message": "Not Found"})
		return
	}
	if r.Method == "POST" && strings.HasSuffix(p, "/access_tokens") {
		writeMockJSON(w, 201, map[string]string{"token": mockInstallToken})
		return
	}

	// Template generate.
	if r.Method == "POST" && strings.HasSuffix(p, "/generate") {
		raw, _ := io.ReadAll(r.Body)
		m.mu.Lock()
		m.generateBody = string(raw)
		m.mu.Unlock()
		if m.opts.GenerateStatus == 201 {
			writeMockJSON(w, 201, map[string]string{"id": "new-repo"})
			return
		}
		writeMockJSON(w, m.opts.GenerateStatus, map[string]string{"message": "mocked generate failure"})
		return
	}

	// Pages.
	if r.Method == "POST" && strings.HasSuffix(p, "/pages") {
		if m.opts.PagesStatus == 201 {
			writeMockJSON(w, 201, map[string]string{"html_url": "https://example.github.io/x/"})
			return
		}
		writeMockJSON(w, m.opts.PagesStatus, map[string]string{"message": "mocked pages state"})
		return
	}

	// Git data API.
	if strings.Contains(p, "/git/ref/heads/main") && r.Method == "GET" {
		writeMockJSON(w, 200, map[string]any{"object": map[string]string{"sha": "base-sha"}})
		return
	}
	if strings.HasSuffix(p, "/git/blobs") && r.Method == "POST" {
		m.mu.Lock()
		m.blobCount++
		n := m.blobCount
		m.mu.Unlock()
		writeMockJSON(w, 201, map[string]string{"sha": fmt.Sprintf("blob-%d", n)})
		return
	}
	if strings.HasSuffix(p, "/git/trees") && r.Method == "POST" {
		writeMockJSON(w, 201, map[string]string{"sha": "tree-sha"})
		return
	}
	if strings.HasSuffix(p, "/git/commits") && r.Method == "POST" {
		writeMockJSON(w, 201, map[string]string{"sha": "commit-sha"})
		return
	}
	if strings.Contains(p, "/git/refs/heads/main") && r.Method == "PATCH" {
		if m.opts.UpdateRefStatus == 200 {
			writeMockJSON(w, 200, map[string]any{"ref": "refs/heads/main"})
			return
		}
		writeMockJSON(w, m.opts.UpdateRefStatus, map[string]string{"message": "mocked ref failure"})
		return
	}
	// Plain repo lookup.
	if r.Method == "GET" && strings.Count(p, "/") == 3 && strings.HasPrefix(p, "/repos/") {
		if m.opts.RepoExists {
			writeMockJSON(w, 200, map[string]string{"full_name": "x/y"})
			return
		}
		writeMockJSON(w, 404, map[string]string{"message": "Not Found"})
		return
	}

	writeMockJSON(w, 404, map[string]string{"message": "mock: unhandled " + r.Method + " " + p})
}
