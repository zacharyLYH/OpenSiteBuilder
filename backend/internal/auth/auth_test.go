package auth

import (
	"testing"
	"time"
)

func TestStateRoundtrip(t *testing.T) {
	tok, err := SignToken("test-key", StatePayload{Slug: "my-shop", Exp: time.Now().Add(time.Minute).Unix()})
	if err != nil {
		t.Fatal(err)
	}
	var out StatePayload
	if err := VerifyToken("test-key", tok, &out); err != nil {
		t.Fatal(err)
	}
	if out.Slug != "my-shop" {
		t.Fatalf("wrong payload: %+v", out)
	}
}

func TestStateExpiry(t *testing.T) {
	tok, err := SignToken("test-key", StatePayload{Slug: "x", Exp: time.Now().Add(-time.Minute).Unix()})
	if err != nil {
		t.Fatal(err)
	}
	var out StatePayload
	if err := VerifyToken("test-key", tok, &out); err == nil {
		t.Fatal("expected expiry error")
	}
}

func TestStateWrongKey(t *testing.T) {
	tok, err := SignToken("key-a", StatePayload{Slug: "x", Exp: time.Now().Add(time.Minute).Unix()})
	if err != nil {
		t.Fatal(err)
	}
	var out StatePayload
	if err := VerifyToken("key-b", tok, &out); err == nil {
		t.Fatal("expected signature error")
	}
}
