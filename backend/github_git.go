package main

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
)

// fileOp is one path plus content write inside a commit.
type fileOp struct {
	Path    string
	Content string
}

type treeEntry struct {
	Path string `json:"path"`
	Mode string `json:"mode"`
	Type string `json:"type"`
	SHA  string `json:"sha"`
}

// treeNode is one entry of a recursive tree listing.
type treeNode struct {
	Path string `json:"path"`
	SHA  string `json:"sha"`
	Size *int   `json:"size"`
	Type string `json:"type"`
}

// commitFiles pushes files as one commit: blobs, tree, commit, ref move.
func (g *ghClient) commitFiles(token, owner, repo, message string, files []fileOp) (string, error) {
	base, err := g.refSHA(token, owner, repo)
	if err != nil {
		return "", err
	}
	entries := make([]treeEntry, 0, len(files))
	for _, f := range files {
		sha, err := g.createBlob(token, owner, repo, f.Content)
		if err != nil {
			return "", err
		}
		entries = append(entries, treeEntry{Path: f.Path, Mode: "100644", Type: "blob", SHA: sha})
	}
	tree, err := g.createTree(token, owner, repo, base, entries)
	if err != nil {
		return "", err
	}
	commit, err := g.createCommit(token, owner, repo, message, tree, base)
	if err != nil {
		return "", err
	}
	if err := g.updateRef(token, owner, repo, commit); err != nil {
		return "", err
	}
	return commit, nil
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
func (g *ghClient) repoTree(token, owner, repo string) ([]treeNode, error) {
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
		Tree      []treeNode `json:"tree"`
		Truncated bool       `json:"truncated"`
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
