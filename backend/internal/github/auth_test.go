package github

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// FindInstallation must page past the first 100 installs, and match the
// account login case-insensitively.
func TestFindInstallationPaginates(t *testing.T) {
	const wantID = int64(7)
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		var list []map[string]any
		if r.URL.Query().Get("page") == "1" {
			list = make([]map[string]any, installPageSize)
			for i := range list {
				list[i] = map[string]any{"id": int64(i), "account": map[string]string{"login": "other"}}
			}
		} else {
			list = []map[string]any{{"id": wantID, "account": map[string]string{"login": "Maya"}}}
		}
		_ = json.NewEncoder(w).Encode(list)
	}))
	defer srv.Close()

	id, err := NewClient(srv.URL, srv.URL).FindInstallation("jwt", "maya")
	if err != nil {
		t.Fatal(err)
	}
	if id != wantID {
		t.Fatalf("want install %d, got %d", wantID, id)
	}
	if calls != 2 {
		t.Fatalf("want 2 page requests, got %d", calls)
	}
}

// No matching install anywhere => 0, and paging stops at the short page.
func TestFindInstallationNotFound(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		_ = json.NewEncoder(w).Encode([]map[string]any{{"id": int64(1), "account": map[string]string{"login": "other"}}})
	}))
	defer srv.Close()

	id, err := NewClient(srv.URL, srv.URL).FindInstallation("jwt", "maya")
	if err != nil {
		t.Fatal(err)
	}
	if id != 0 || calls != 1 {
		t.Fatalf("want 0 after 1 page, got id=%d calls=%d", id, calls)
	}
}
