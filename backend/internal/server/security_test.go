package server

import (
	"bytes"
	"encoding/json"
	"net/url"
	"testing"
)

// Rule: user-visible branches (statuses, messages, UI flows) live in the
// frontend suite, which drives the real backend. This file guards only
// what no UI can observe: which credential touches GitHub, how many
// calls fire, and the crypto underneath sessions.

func bearerIs(headers []string, token string) bool {
	for _, h := range headers {
		if h == "Bearer "+token {
			return true
		}
	}
	return false
}

func sessionCookie(t *testing.T, e *testEnv, name string) string {
	t.Helper()
	u, err := url.Parse(e.backend.URL)
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range e.client.Jar.Cookies(u) {
		if c.Name == name {
			return c.Value
		}
	}
	return ""
}

func TestSecurity_ExchangeSplitsUserAndInstallTokens(t *testing.T) {
	e := newTestEnv(t, mockOptions{})

	_, sbody := e.state("my-shop")
	code, _ := e.exchange("code-1", sbody["state"].(string), 0)
	if code != 200 {
		t.Fatalf("setup exchange failed: %d", code)
	}
	if !bearerIs(e.mock.Bearers("POST", "/repos/tmpl-owner/tmpl-repo/generate"), mockUserToken) {
		t.Fatal("repo creation must use the user token")
	}
	if !bearerIs(e.mock.Bearers("POST", "/repos/maya/my-shop/pages"), mockInstallToken) {
		t.Fatal("pages setup must use the install token")
	}
}

func TestSecurity_PublishGitOpsNeverTouchUserToken(t *testing.T) {
	e := newTestEnv(t, mockOptions{RepoExists: true})
	e.login("my-shop")

	payload, _ := json.Marshal(map[string]any{
		"files":   []any{map[string]string{"path": "src/App.jsx", "content": "hi"}},
		"message": "x",
	})
	r, err := e.client.Post(e.backend.URL+"/api/publish", "application/json", bytes.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	defer r.Body.Close()
	if r.StatusCode != 200 {
		t.Fatalf("setup publish failed: %d", r.StatusCode)
	}
	for _, p := range []string{
		"/repos/maya/my-shop/git/blobs",
		"/repos/maya/my-shop/git/trees",
		"/repos/maya/my-shop/git/commits",
	} {
		for _, method := range []string{"POST"} {
			for _, b := range e.mock.Bearers(method, p) {
				if b != "Bearer "+mockInstallToken {
					t.Fatalf("git call %s %s leaked wrong credential: %s", method, p, b)
				}
			}
		}
	}
	if got := e.mock.Calls("PATCH", "/repos/maya/my-shop/git/refs/heads/main"); got != 1 {
		t.Fatal("branch must move exactly once per publish")
	}
}

func TestSecurity_ForgedStateMakesZeroGitHubCalls(t *testing.T) {
	e := newTestEnv(t, mockOptions{})

	code, _ := e.exchange("code-1", "forged-state", 0)
	if code != 400 {
		t.Fatalf("expected 400, got %d", code)
	}
	if e.mock.Calls("POST", "/login/oauth/access_token") != 0 {
		t.Fatal("forged state must die before any GitHub contact")
	}
}

func TestSecurity_UnauthenticatedPublishMakesZeroGitHubCalls(t *testing.T) {
	e := newTestEnv(t, mockOptions{RepoExists: true})

	payload, _ := json.Marshal(map[string]any{
		"files": []any{map[string]string{"path": "src/App.jsx", "content": "x"}},
	})
	r, err := e.client.Post(e.backend.URL+"/api/publish", "application/json", bytes.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	defer r.Body.Close()
	if r.StatusCode != 401 {
		t.Fatalf("expected 401, got %d", r.StatusCode)
	}
	if got := e.mock.Calls("POST", "/repos/maya/my-shop/git/blobs"); got != 0 {
		t.Fatal("unauthenticated push must never reach git")
	}
}

func TestSecurity_WorkflowPathsRejectedAtAPI(t *testing.T) {
	// No UI can even produce these paths; the API is the last line.
	e := newTestEnv(t, mockOptions{RepoExists: true})
	e.login("my-shop")

	for _, p := range []string{".github/workflows/deploy.yml", ".github/x", ".git/config", "../x", "/abs"} {
		payload, _ := json.Marshal(map[string]any{
			"files": []any{map[string]string{"path": p, "content": "x"}},
		})
		r, err := e.client.Post(e.backend.URL+"/api/publish", "application/json", bytes.NewReader(payload))
		if err != nil {
			t.Fatal(err)
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			r.Body.Close()
			t.Fatal(err)
		}
		r.Body.Close()
		if r.StatusCode != 400 {
			t.Fatalf("path %q: expected 400, got %d", p, r.StatusCode)
		}
	}
	if got := e.mock.Calls("POST", "/repos/maya/my-shop/git/blobs"); got != 0 {
		t.Fatal("rejected paths must stop before any git call")
	}
}

func TestSecurity_StateSetsPendingCookieForInstallLeg(t *testing.T) {
	e := newTestEnv(t, mockOptions{})

	code, body := e.state("my-shop")
	if code != 200 || body["state"] == nil {
		t.Fatalf("expected state, got %d %v", code, body)
	}
	if sessionCookie(t, e, "osb_pending") == "" {
		t.Fatal("state must set the pending cookie the install leg relies on")
	}
	if e.mock.Calls("POST", "/login/oauth/access_token") != 0 {
		t.Fatal("state alone must contact nobody")
	}
}
