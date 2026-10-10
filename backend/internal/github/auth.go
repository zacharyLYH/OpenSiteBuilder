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

// appJWTTTL is GitHub's ceiling for app JWTs: it rejects any issued-at time
// more than 10 minutes in the past. Do not raise this.
const appJWTTTL = 10 * time.Minute

// jwtIATSkew backdates iat to absorb small clock drift between us and GitHub.
const jwtIATSkew int64 = 60

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
		fmt.Sprintf(`{"iss":%q,"iat":%d,"exp":%d}`, cfg.AppID, now-jwtIATSkew, now+int64(appJWTTTL.Seconds()))))
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

// installPageSize matches GitHub's max page size for installation listings.
const installPageSize = 100

type installation struct {
	ID      int64 `json:"id"`
	Account struct {
		Login string `json:"login"`
	} `json:"account"`
}

// FindInstallation returns the install ID for an owner login, or 0. It walks
// every page, so an account with more than one page of installs is still found.
func (g *Client) FindInstallation(appJWT, owner string) (int64, error) {
	for page := 1; ; page++ {
		var out []installation
		st, err := g.do(http.MethodGet,
			fmt.Sprintf("%s/app/installations?per_page=%d&page=%d", g.APIBase, installPageSize, page), appJWT, nil, &out)
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
		if len(out) < installPageSize {
			return 0, nil
		}
	}
}

// InstallationAccount confirms which account an install belongs to.
func (g *Client) InstallationAccount(appJWT string, id int64) (string, error) {
	var out struct {
		Account struct {
			Login string `json:"login"`
		} `json:"account"`
	}
	st, err := g.do(http.MethodGet, fmt.Sprintf("%s/app/installations/%d", g.APIBase, id), appJWT, nil, &out)
	if err != nil {
		return "", err
	}
	if st != http.StatusOK {
		return "", fmt.Errorf("installation lookup failed: status=%d", st)
	}
	return out.Account.Login, nil
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
