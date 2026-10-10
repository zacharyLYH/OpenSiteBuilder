package config

import "testing"

// setRequired fills every non-secret-optional env Load demands, so each test
// can vary exactly one value.
func setRequired(t *testing.T, sessionKey string) {
	t.Helper()
	t.Setenv("APP_ID", "1")
	t.Setenv("APP_SLUG", "app")
	t.Setenv("CLIENT_ID", "client")
	t.Setenv("CLIENT_SECRET", "secret")
	t.Setenv("PRIVATE_KEY_PATH", "/tmp/k.pem")
	t.Setenv("SESSION_HMAC_KEY", sessionKey)
	t.Setenv("TEMPLATE_OWNER", "owner")
	t.Setenv("TEMPLATE_REPO", "repo")
}

func TestLoadAcceptsCompleteConfig(t *testing.T) {
	setRequired(t, "0123456789abcdef0123456789abcdef")
	if _, err := Load(); err != nil {
		t.Fatalf("expected valid config, got %v", err)
	}
}

func TestLoadRejectsEmptySessionKey(t *testing.T) {
	setRequired(t, "")
	if _, err := Load(); err == nil {
		t.Fatal("expected error for empty SESSION_HMAC_KEY")
	}
}

func TestLoadRejectsShortSessionKey(t *testing.T) {
	setRequired(t, "too-short")
	if _, err := Load(); err == nil {
		t.Fatal("expected error for short SESSION_HMAC_KEY")
	}
}

func TestLoadRejectsMissingSecret(t *testing.T) {
	setRequired(t, "0123456789abcdef0123456789abcdef")
	t.Setenv("CLIENT_SECRET", "")
	if _, err := Load(); err == nil {
		t.Fatal("expected error for missing CLIENT_SECRET")
	}
}
