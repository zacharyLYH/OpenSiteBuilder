package config

import (
	"fmt"
	"os"
	"strings"
)

// Config holds backend settings. Secrets never leave this process.
type Config struct {
	Addr           string
	AppID          string
	AppSlug        string
	ClientID       string
	ClientSecret   string
	PrivateKeyPath string
	SessionKey     string
	PublicBaseURL  string
	TemplateOwner  string
	TemplateRepo   string
	SecureCookies  bool
	// GitHub bases. Production defaults; tests point these at the mock.
	GitHubAPIBase   string
	GitHubOAuthBase string
}

func getenv(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}

// Load reads backend settings from the environment and validates them.
// It returns an error rather than warning when a required setting is missing:
// an empty SessionKey would make every signed session/state token forgeable.
func Load() (Config, error) {
	c := Config{
		Addr:            getenv("ADDR", ":18081"),
		AppID:           os.Getenv("APP_ID"),
		AppSlug:         os.Getenv("APP_SLUG"),
		ClientID:        os.Getenv("CLIENT_ID"),
		ClientSecret:    os.Getenv("CLIENT_SECRET"),
		PrivateKeyPath:  os.Getenv("PRIVATE_KEY_PATH"),
		SessionKey:      os.Getenv("SESSION_HMAC_KEY"),
		PublicBaseURL:   getenv("PUBLIC_BASE_URL", "http://localhost:9999"),
		TemplateOwner:   os.Getenv("TEMPLATE_OWNER"),
		TemplateRepo:    os.Getenv("TEMPLATE_REPO"),
		GitHubAPIBase:   getenv("GITHUB_API_BASE", "https://api.github.com"),
		GitHubOAuthBase: getenv("GITHUB_OAUTH_BASE", "https://github.com"),
	}
	c.SecureCookies = strings.HasPrefix(c.PublicBaseURL, "https://")
	if err := c.validate(); err != nil {
		return Config{}, err
	}
	return c, nil
}

// minSessionKeyBytes is the HMAC-SHA256 key strength we require.
const minSessionKeyBytes = 32

func (c Config) validate() error {
	for _, r := range []struct{ name, value string }{
		{"APP_ID", c.AppID},
		{"APP_SLUG", c.AppSlug},
		{"CLIENT_ID", c.ClientID},
		{"CLIENT_SECRET", c.ClientSecret},
		{"PRIVATE_KEY_PATH", c.PrivateKeyPath},
		{"SESSION_HMAC_KEY", c.SessionKey},
		{"PUBLIC_BASE_URL", c.PublicBaseURL},
		{"TEMPLATE_OWNER", c.TemplateOwner},
		{"TEMPLATE_REPO", c.TemplateRepo},
	} {
		if r.value == "" {
			return fmt.Errorf("missing required env %s", r.name)
		}
	}
	if len(c.SessionKey) < minSessionKeyBytes {
		return fmt.Errorf("SESSION_HMAC_KEY must be at least %d bytes, got %d", minSessionKeyBytes, len(c.SessionKey))
	}
	return nil
}
