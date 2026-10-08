package main

import (
	"testing"
	"time"
)

func TestStateRoundtrip(t *testing.T) {
	tok, err := signToken("test-key", statePayload{Slug: "my-shop", Exp: time.Now().Add(time.Minute).Unix()})
	if err != nil {
		t.Fatal(err)
	}
	var out statePayload
	if err := verifyToken("test-key", tok, &out); err != nil {
		t.Fatal(err)
	}
	if out.Slug != "my-shop" {
		t.Fatalf("wrong payload: %+v", out)
	}
}

func TestStateExpiry(t *testing.T) {
	tok, err := signToken("test-key", statePayload{Slug: "x", Exp: time.Now().Add(-time.Minute).Unix()})
	if err != nil {
		t.Fatal(err)
	}
	var out statePayload
	if err := verifyToken("test-key", tok, &out); err == nil {
		t.Fatal("expected expiry error")
	}
}

func TestStateWrongKey(t *testing.T) {
	tok, err := signToken("key-a", statePayload{Slug: "x", Exp: time.Now().Add(time.Minute).Unix()})
	if err != nil {
		t.Fatal(err)
	}
	var out statePayload
	if err := verifyToken("key-b", tok, &out); err == nil {
		t.Fatal("expected signature error")
	}
}

func TestPublishablePath(t *testing.T) {
	ok := []string{"src/App.jsx", "src/components/ui/button.jsx", "index.html", "package.json", "vite.config.js", "tailwind.config.js", "postcss.config.js", "public/logo.png"}
	for _, p := range ok {
		if !publishablePath(p) {
			t.Errorf("expected allowed: %s", p)
		}
	}
	blocked := []string{"", "/etc/passwd", "./x", "a/../b", ".github/workflows/deploy.yml", ".GitHub/x", ".git/config", "server.go", "backend/main.go", "README.md", ".env"}
	for _, p := range blocked {
		if publishablePath(p) {
			t.Errorf("expected blocked: %s", p)
		}
	}
}
