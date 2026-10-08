package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"time"
)

// statePayload binds a slug request to a GitHub redirect. 10 minute life.
// Owner travels in the token, never in user input.
type statePayload struct {
	Slug string `json:"slug"`
	Exp  int64  `json:"exp"`
}

// sessionPayload identifies an installed site. 7 day life.
type sessionPayload struct {
	Owner string `json:"owner"`
	Slug  string `json:"slug"`
	Inst  int64  `json:"inst"`
	Exp   int64  `json:"exp"`
}

var b64 = base64.RawURLEncoding

// signToken serializes payload to JSON and appends an HMAC signature.
func signToken(key string, payload any) (string, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	body := b64.EncodeToString(raw)
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(body))
	return body + "." + b64.EncodeToString(mac.Sum(nil)), nil
}

// verifyToken checks the signature, expiry, and decodes into out.
func verifyToken(key, token string, out any) error {
	body, sig, ok := splitOnce(token)
	if !ok {
		return errors.New("bad token format")
	}
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(body))
	want := mac.Sum(nil)
	got, err := b64.DecodeString(sig)
	if err != nil {
		return errors.New("bad token signature")
	}
	if subtle.ConstantTimeCompare(got, want) != 1 {
		return errors.New("bad token signature")
	}
	raw, err := b64.DecodeString(body)
	if err != nil {
		return errors.New("bad token payload")
	}
	var exp struct {
		Exp int64 `json:"exp"`
	}
	if err := json.Unmarshal(raw, &exp); err != nil {
		return err
	}
	if exp.Exp < time.Now().Unix() {
		return errors.New("token expired")
	}
	return json.Unmarshal(raw, out)
}

func splitOnce(s string) (string, string, bool) {
	for i := len(s) - 1; i >= 0; i-- {
		if s[i] == '.' {
			return s[:i], s[i+1:], true
		}
	}
	return "", "", false
}
