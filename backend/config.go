package main

import (
	"log"
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
}

func loadConfig() Config {
	c := Config{
		Addr:           getenv("ADDR", ":18081"),
		AppID:          os.Getenv("APP_ID"),
		AppSlug:        os.Getenv("APP_SLUG"),
		ClientID:       os.Getenv("CLIENT_ID"),
		ClientSecret:   os.Getenv("CLIENT_SECRET"),
		PrivateKeyPath: os.Getenv("PRIVATE_KEY_PATH"),
		SessionKey:     os.Getenv("SESSION_HMAC_KEY"),
		PublicBaseURL:  getenv("PUBLIC_BASE_URL", "http://localhost:9999"),
		TemplateOwner:  os.Getenv("TEMPLATE_OWNER"),
		TemplateRepo:   os.Getenv("TEMPLATE_REPO"),
	}
	c.SecureCookies = strings.HasPrefix(c.PublicBaseURL, "https://")
	for _, kv := range [][2]string{
		{"APP_ID", c.AppID},
		{"CLIENT_ID", c.ClientID},
		{"CLIENT_SECRET", c.ClientSecret},
		{"PRIVATE_KEY_PATH", c.PrivateKeyPath},
		{"SESSION_HMAC_KEY", c.SessionKey},
		{"PUBLIC_BASE_URL", c.PublicBaseURL},
		{"TEMPLATE_OWNER", c.TemplateOwner},
		{"TEMPLATE_REPO", c.TemplateRepo},
	} {
		if kv[1] == "" {
			log.Printf("warn: env %s is empty", kv[0])
		}
	}
	return c
}
