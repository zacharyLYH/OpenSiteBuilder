package main

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// ghClient talks to GitHub with stdlib only. Tokens stay in memory.
type ghClient struct {
	http      *http.Client
	apiBase   string
	oauthBase string
}

func newGHClient() *ghClient {
	return &ghClient{
		http:      &http.Client{Timeout: 30 * time.Second},
		apiBase:   "https://api.github.com",
		oauthBase: "https://github.com",
	}
}

// do sends JSON and decodes JSON into out when out is non-nil.
// It returns the HTTP status code.
func (g *ghClient) do(method, url, token string, body, out any) (int, error) {
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

// mintAppJWT signs a 10 minute app token. The private key never leaves disk.
func mintAppJWT(cfg Config) (string, error) {
	pemRaw, err := os.ReadFile(cfg.PrivateKeyPath)
	if err != nil {
		return "", err
	}
	block, _ := pem.Decode(pemRaw)
	if block == nil {
		return "", errors.New("bad private key pem")
	}
	var key *rsa.PrivateKey
	if k, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		key = k
	} else if k, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		rk, ok := k.(*rsa.PrivateKey)
		if !ok {
			return "", errors.New("private key is not RSA")
		}
		key = rk
	} else {
		return "", errors.New("unparseable private key")
	}
	now := time.Now().Unix()
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","typ":"JWT"}`))
	payload := base64.RawURLEncoding.EncodeToString([]byte(
		fmt.Sprintf(`{"iss":%q,"iat":%d,"exp":%d}`, cfg.AppID, now-60, now+600)))
	digest := sha256.Sum256([]byte(header + "." + payload))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	if err != nil {
		return "", err
	}
	return header + "." + payload + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

// exchangeCode trades GH_CODE plus client_secret for GH_USER.
func (g *ghClient) exchangeCode(cfg Config, code string) (string, error) {
	var out struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	st, err := g.do(http.MethodPost, g.oauthBase+"/login/oauth/access_token", "",
		map[string]string{"client_id": cfg.ClientID, "client_secret": cfg.ClientSecret, "code": code}, &out)
	if err != nil {
		return "", err
	}
	if st != http.StatusOK || out.AccessToken == "" {
		return "", fmt.Errorf("code exchange failed: status=%d error=%s", st, out.Error)
	}
	return out.AccessToken, nil
}

// authenticatedUser returns the login of the user a token acts as.
func (g *ghClient) authenticatedUser(token string) (string, error) {
	var out struct {
		Login string `json:"login"`
	}
	st, err := g.do(http.MethodGet, g.apiBase+"/user", token, nil, &out)
	if err != nil {
		return "", err
	}
	if st != http.StatusOK || out.Login == "" {
		return "", fmt.Errorf("user lookup failed: status=%d", st)
	}
	return out.Login, nil
}

// findInstallation returns the install ID for an owner login, or 0.
func (g *ghClient) findInstallation(appJWT, owner string) (int64, error) {
	var out []struct {
		ID      int64 `json:"id"`
		Account struct {
			Login string `json:"login"`
		} `json:"account"`
	}
	st, err := g.do(http.MethodGet, g.apiBase+"/app/installations?per_page=100", appJWT, nil, &out)
	if err != nil {
		return 0, err
	}
	if st != http.StatusOK {
		return 0, fmt.Errorf("installation list failed: status=%d", st)
	}
	for _, in := range out {
		if strings.EqualFold(in.Account.Login, owner) {
			return in.ID, nil
		}
	}
	return 0, nil
}
func (g *ghClient) installationInfo(appJWT string, id int64) (owner string, repoSelection string, status int, err error) {
	var out struct {
		Account struct {
			Login string `json:"login"`
		} `json:"account"`
		RepositorySelection string `json:"repository_selection"`
	}
	st, err := g.do(http.MethodGet, fmt.Sprintf("%s/app/installations/%d", g.apiBase, id), appJWT, nil, &out)
	if err != nil {
		return "", "", st, err
	}
	if st != http.StatusOK {
		return "", "", st, fmt.Errorf("installation lookup failed: status=%d", st)
	}
	return out.Account.Login, out.RepositorySelection, st, nil
}

// createInstallToken mints GH_INSTALL for one installation.
func (g *ghClient) createInstallToken(appJWT string, id int64) (string, error) {
	var out struct {
		Token string `json:"token"`
	}
	st, err := g.do(http.MethodPost, fmt.Sprintf("%s/app/installations/%d/access_tokens", g.apiBase, id), appJWT, map[string]any{}, &out)
	if err != nil {
		return "", err
	}
	if st != http.StatusCreated || out.Token == "" {
		return "", fmt.Errorf("install token failed: status=%d", st)
	}
	return out.Token, nil
}

// repoExists reports 200/404 for a repo. Other statuses are errors.
func (g *ghClient) repoExists(token, owner, repo string) (bool, error) {
	st, err := g.do(http.MethodGet, fmt.Sprintf("%s/repos/%s/%s", g.apiBase, owner, repo), token, nil, nil)
	if err != nil {
		return false, err
	}
	switch st {
	case http.StatusOK:
		return true, nil
	case http.StatusNotFound:
		return false, nil
	default:
		return false, fmt.Errorf("repo lookup failed: status=%d", st)
	}
}

// ghErr captures GitHub's error message on failure. The message is safe
// to log: GitHub never echoes tokens in it.
type ghErr struct {
	Message string `json:"message"`
}

// generateRepo copies the template into the user account.
func (g *ghClient) generateRepo(userToken, templateOwner, templateRepo, owner, name string) error {
	var ge ghErr
	st, err := g.do(http.MethodPost,
		fmt.Sprintf("%s/repos/%s/%s/generate", g.apiBase, templateOwner, templateRepo),
		userToken,
		map[string]any{"owner": owner, "name": name, "private": false, "include_all_branches": false}, &ge)
	if err != nil {
		return err
	}
	if st != http.StatusCreated {
		return fmt.Errorf("repo generate failed: status=%d message=%s", st, ge.Message)
	}
	return nil
}

// ensurePages enables Pages with Actions source. 409 means already enabled.
func (g *ghClient) ensurePages(token, owner, repo string) error {
	st, err := g.do(http.MethodPost, fmt.Sprintf("%s/repos/%s/%s/pages", g.apiBase, owner, repo),
		token, map[string]string{"build_type": "workflow"}, nil)
	if err != nil {
		return err
	}
	if st == http.StatusCreated || st == http.StatusConflict {
		return nil
	}
	return fmt.Errorf("pages enable failed: status=%d", st)
}

// refSHA returns the commit SHA of branch main.
func (g *ghClient) refSHA(token, owner, repo string) (string, error) {
	var out struct {
		Object struct {
			SHA string `json:"sha"`
		} `json:"object"`
	}
	st, err := g.do(http.MethodGet, fmt.Sprintf("%s/repos/%s/%s/git/ref/heads/main", g.apiBase, owner, repo), token, nil, &out)
	if err != nil {
		return "", err
	}
	if st != http.StatusOK || out.Object.SHA == "" {
		return "", fmt.Errorf("ref lookup failed: status=%d", st)
	}
	return out.Object.SHA, nil
}

// createBlob stores file content and returns its blob SHA.
func (g *ghClient) createBlob(token, owner, repo, content string) (string, error) {
	var out struct {
		SHA string `json:"sha"`
	}
	st, err := g.do(http.MethodPost, fmt.Sprintf("%s/repos/%s/%s/git/blobs", g.apiBase, owner, repo),
		token, map[string]string{"content": content, "encoding": "utf-8"}, &out)
	if err != nil {
		return "", err
	}
	if st != http.StatusCreated || out.SHA == "" {
		return "", fmt.Errorf("blob create failed: status=%d", st)
	}
	return out.SHA, nil
}

type treeEntry struct {
	Path string `json:"path"`
	Mode string `json:"mode"`
	Type string `json:"type"`
	SHA  string `json:"sha"`
}

// createTree builds a tree on top of base and returns its SHA.
func (g *ghClient) createTree(token, owner, repo, base string, entries []treeEntry) (string, error) {
	var out struct {
		SHA string `json:"sha"`
	}
	st, err := g.do(http.MethodPost, fmt.Sprintf("%s/repos/%s/%s/git/trees", g.apiBase, owner, repo),
		token, map[string]any{"base_tree": base, "tree": entries}, &out)
	if err != nil {
		return "", err
	}
	if st != http.StatusCreated || out.SHA == "" {
		return "", fmt.Errorf("tree create failed: status=%d", st)
	}
	return out.SHA, nil
}

// createCommit commits a tree on top of parent and returns the commit SHA.
func (g *ghClient) createCommit(token, owner, repo, message, tree, parent string) (string, error) {
	var out struct {
		SHA string `json:"sha"`
	}
	st, err := g.do(http.MethodPost, fmt.Sprintf("%s/repos/%s/%s/git/commits", g.apiBase, owner, repo),
		token, map[string]any{"message": message, "tree": tree, "parents": []string{parent}}, &out)
	if err != nil {
		return "", err
	}
	if st != http.StatusCreated || out.SHA == "" {
		return "", fmt.Errorf("commit create failed: status=%d", st)
	}
	return out.SHA, nil
}

// updateRef moves branch main to the new commit.
func (g *ghClient) updateRef(token, owner, repo, sha string) error {
	st, err := g.do(http.MethodPatch, fmt.Sprintf("%s/repos/%s/%s/git/refs/heads/main", g.apiBase, owner, repo),
		token, map[string]any{"sha": sha, "force": false}, nil)
	if err != nil {
		return err
	}
	if st != http.StatusOK {
		return fmt.Errorf("ref update failed: status=%d (push conflict, retry)", st)
	}
	return nil
}

// repoTree lists all files at main recursively.
func (g *ghClient) repoTree(token, owner, repo string) ([]struct {
	Path string `json:"path"`
	SHA  string `json:"sha"`
	Size *int   `json:"size"`
	Type string `json:"type"`
}, error) {
	base, err := g.refSHA(token, owner, repo)
	if err != nil {
		return nil, err
	}
	var commit struct {
		Tree struct {
			SHA string `json:"sha"`
		} `json:"tree"`
	}
	st, err := g.do(http.MethodGet, fmt.Sprintf("%s/repos/%s/%s/git/commits/%s", g.apiBase, owner, repo, base), token, nil, &commit)
	if err != nil {
		return nil, err
	}
	if st != http.StatusOK {
		return nil, fmt.Errorf("commit lookup failed: status=%d", st)
	}
	var tree struct {
		Tree []struct {
			Path string `json:"path"`
			SHA  string `json:"sha"`
			Size *int   `json:"size"`
			Type string `json:"type"`
		} `json:"tree"`
		Truncated bool `json:"truncated"`
	}
	st, err = g.do(http.MethodGet,
		fmt.Sprintf("%s/repos/%s/%s/git/trees/%s?recursive=1", g.apiBase, owner, repo, commit.Tree.SHA), token, nil, &tree)
	if err != nil {
		return nil, err
	}
	if st != http.StatusOK {
		return nil, fmt.Errorf("tree lookup failed: status=%d", st)
	}
	return tree.Tree, nil
}

// fileContent returns decoded text of one file at main.
func (g *ghClient) fileContent(token, owner, repo, path string) (content, sha string, err error) {
	var out struct {
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
		SHA      string `json:"sha"`
	}
	st, gerr := g.do(http.MethodGet,
		fmt.Sprintf("%s/repos/%s/%s/contents/%s?ref=main", g.apiBase, owner, repo, path), token, nil, &out)
	if gerr != nil {
		return "", "", gerr
	}
	if st != http.StatusOK {
		return "", "", fmt.Errorf("file lookup failed: status=%d", st)
	}
	if out.Encoding != "base64" {
		return "", "", fmt.Errorf("unexpected file encoding %q", out.Encoding)
	}
	raw, derr := base64.StdEncoding.DecodeString(stripSpaces(out.Content))
	if derr != nil {
		return "", "", fmt.Errorf("file decode failed: %w", derr)
	}
	if len(raw) > 1<<20 {
		return "", "", errors.New("file too large")
	}
	return string(raw), out.SHA, nil
}

func stripSpaces(s string) string {
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		if s[i] != '\n' && s[i] != '\r' && s[i] != ' ' {
			out = append(out, s[i])
		}
	}
	return string(out)
}
