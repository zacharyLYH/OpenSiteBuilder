package github

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"opensitebuilder-backend/internal/config"
)

// MintAppJWT signs a 10 minute app token. The private key never leaves disk.
func MintAppJWT(cfg config.Config) (string, error) {
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

// ExchangeCode trades GH_CODE plus client_secret for GH_USER.
func (g *Client) ExchangeCode(cfg config.Config, code string) (string, error) {
	var out struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	st, err := g.do(http.MethodPost, g.OAuthBase+"/login/oauth/access_token", "",
		map[string]string{"client_id": cfg.ClientID, "client_secret": cfg.ClientSecret, "code": code}, &out)
	if err != nil {
		return "", err
	}
	if st != http.StatusOK || out.AccessToken == "" {
		return "", fmt.Errorf("code exchange failed: status=%d error=%s", st, out.Error)
	}
	return out.AccessToken, nil
}

// AuthenticatedUser returns the login of the user a token acts as.
func (g *Client) AuthenticatedUser(token string) (string, error) {
	var out struct {
		Login string `json:"login"`
	}
	st, err := g.do(http.MethodGet, g.APIBase+"/user", token, nil, &out)
	if err != nil {
		return "", err
	}
	if st != http.StatusOK || out.Login == "" {
		return "", fmt.Errorf("user lookup failed: status=%d", st)
	}
	return out.Login, nil
}

// FindInstallation returns the install ID for an owner login, or 0.
func (g *Client) FindInstallation(appJWT, owner string) (int64, error) {
	var out []struct {
		ID      int64 `json:"id"`
		Account struct {
			Login string `json:"login"`
		} `json:"account"`
	}
	st, err := g.do(http.MethodGet, g.APIBase+"/app/installations?per_page=100", appJWT, nil, &out)
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

// InstallationInfo confirms which account an install belongs to.
func (g *Client) InstallationInfo(appJWT string, id int64) (owner string, repoSelection string, status int, err error) {
	var out struct {
		Account struct {
			Login string `json:"login"`
		} `json:"account"`
		RepositorySelection string `json:"repository_selection"`
	}
	st, err := g.do(http.MethodGet, fmt.Sprintf("%s/app/installations/%d", g.APIBase, id), appJWT, nil, &out)
	if err != nil {
		return "", "", st, err
	}
	if st != http.StatusOK {
		return "", "", st, fmt.Errorf("installation lookup failed: status=%d", st)
	}
	return out.Account.Login, out.RepositorySelection, st, nil
}

// CreateInstallToken mints GH_INSTALL for one installation.
func (g *Client) CreateInstallToken(appJWT string, id int64) (string, error) {
	var out struct {
		Token string `json:"token"`
	}
	st, err := g.do(http.MethodPost, fmt.Sprintf("%s/app/installations/%d/access_tokens", g.APIBase, id), appJWT, map[string]any{}, &out)
	if err != nil {
		return "", err
	}
	if st != http.StatusCreated || out.Token == "" {
		return "", fmt.Errorf("install token failed: status=%d", st)
	}
	return out.Token, nil
}
