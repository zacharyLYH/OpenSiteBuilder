package server

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"opensitebuilder-backend/internal/config"
	"opensitebuilder-backend/internal/github"
)

// testEnv is the whole world a behavior test needs: the real server mux,
// a GitHub mock, and an HTTP client. One constructor, one cleanup.
type testEnv struct {
	t       *testing.T
	mock    *ghMock
	backend *httptest.Server
	client  *http.Client
}

func newTestEnv(t *testing.T, opts mockOptions) *testEnv {
	t.Helper()

	mock := newGHMock(t, opts)

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
	keyPath := filepath.Join(t.TempDir(), "test.pem")
	if err := os.WriteFile(keyPath, keyPEM, 0o600); err != nil {
		t.Fatal(err)
	}

	cfg := config.Config{
		AppID:           "123",
		AppSlug:         "test-app",
		ClientID:        "test-client",
		ClientSecret:    "test-secret",
		PrivateKeyPath:  keyPath,
		SessionKey:      "test-session-key-32-bytes-long!!",
		PublicBaseURL:   "http://example.test",
		TemplateOwner:   "tmpl-owner",
		TemplateRepo:    "tmpl-repo",
		SecureCookies:   false,
		GitHubAPIBase:   mock.url(),
		GitHubOAuthBase: mock.url(),
	}
	srv := httptest.NewServer(NewMux(New(cfg, github.NewClientWithBases(mock.url(), mock.url()))))
	t.Cleanup(srv.Close)

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	return &testEnv{t: t, mock: mock, backend: srv, client: &http.Client{Jar: jar}}
}

// state fetches a signed state for slug through the real /api/state.
func (e *testEnv) state(slug string) (int, map[string]any) {
	e.t.Helper()
	r, err := e.client.Get(e.backend.URL + "/api/state?slug=" + slug)
	if err != nil {
		e.t.Fatal(err)
	}
	defer r.Body.Close()
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		e.t.Fatal(err)
	}
	return r.StatusCode, body
}

// exchange posts one E1 through the real /api/exchange.
func (e *testEnv) exchange(code, state string, inst int64) (int, map[string]any) {
	e.t.Helper()
	payload, _ := json.Marshal(map[string]any{
		"code": code, "state": state, "installation_id": inst,
	})
	r, err := e.client.Post(e.backend.URL+"/api/exchange", "application/json", bytes.NewReader(payload))
	if err != nil {
		e.t.Fatal(err)
	}
	defer r.Body.Close()
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		e.t.Fatal(err)
	}
	return r.StatusCode, body
}

// login runs the happy exchange and returns a client holding OSB_SESSION.
func (e *testEnv) login(slug string) {
	e.t.Helper()
	_, sbody := e.state(slug)
	st, _ := sbody["state"].(string)
	code, body := e.exchange("code-1", st, 0)
	if code != 200 {
		e.t.Fatalf("login exchange failed: %d %v", code, body)
	}
}

// decode is a small helper for response assertions.
func decode(t *testing.T, r *http.Response) map[string]any {
	t.Helper()
	defer r.Body.Close()
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	return body
}
