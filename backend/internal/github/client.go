package github

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client talks to GitHub with stdlib only. Tokens stay in memory.
type Client struct {
	http      *http.Client
	APIBase   string
	OAuthBase string
}

func NewClient() *Client {
	return &Client{
		http:      &http.Client{Timeout: 30 * time.Second},
		APIBase:   "https://api.github.com",
		OAuthBase: "https://github.com",
	}
}

// NewClientWithBases is the test seam: same client, mock endpoints.
func NewClientWithBases(apiBase, oauthBase string) *Client {
	return &Client{
		http:      &http.Client{Timeout: 30 * time.Second},
		APIBase:   apiBase,
		OAuthBase: oauthBase,
	}
}

// ghErr captures GitHub's error message on failure. The message is safe
// to log: GitHub never echoes tokens in it.
type ghErr struct {
	Message string `json:"message"`
}

// do sends JSON and decodes JSON into out when out is non-nil.
// It returns the HTTP status code.
func (g *Client) do(method, url, token string, body, out any) (int, error) {
	var rdr io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return 0, err
		}
		rdr = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, url, rdr)
	if err != nil {
		return 0, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := g.http.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return resp.StatusCode, err
	}
	if out != nil && len(raw) > 0 {
		if err := json.Unmarshal(raw, out); err != nil {
			return resp.StatusCode, fmt.Errorf("decode github response: %w", err)
		}
	}
	return resp.StatusCode, nil
}
