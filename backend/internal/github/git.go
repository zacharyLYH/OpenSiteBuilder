package github

import (
	"fmt"
	"net/http"
)

// FileOp is one path plus content write inside a commit — also the wire shape
// of a publish request entry, so the handler decodes straight into it.
type FileOp struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type treeEntry struct {
	Path string `json:"path"`
	Mode string `json:"mode"`
	Type string `json:"type"`
	SHA  string `json:"sha"`
}

// CommitFiles pushes files as one commit: blobs, tree, commit, ref move.
func (g *Client) CommitFiles(token, owner, repo, message string, files []FileOp) (string, error) {
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
func (g *Client) refSHA(token, owner, repo string) (string, error) {
	var out struct {
		Object struct {
			SHA string `json:"sha"`
		} `json:"object"`
	}
	st, err := g.do(http.MethodGet, fmt.Sprintf("%s/repos/%s/%s/git/ref/heads/main", g.APIBase, owner, repo), token, nil, &out)
	if err != nil {
		return "", err
	}
	if st != http.StatusOK || out.Object.SHA == "" {
		return "", fmt.Errorf("ref lookup failed: status=%d", st)
	}
	return out.Object.SHA, nil
}

// createBlob stores file content and returns its blob SHA.
func (g *Client) createBlob(token, owner, repo, content string) (string, error) {
	var out struct {
		SHA string `json:"sha"`
	}
	st, err := g.do(http.MethodPost, fmt.Sprintf("%s/repos/%s/%s/git/blobs", g.APIBase, owner, repo),
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
func (g *Client) createTree(token, owner, repo, base string, entries []treeEntry) (string, error) {
	var out struct {
		SHA string `json:"sha"`
	}
	st, err := g.do(http.MethodPost, fmt.Sprintf("%s/repos/%s/%s/git/trees", g.APIBase, owner, repo),
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
func (g *Client) createCommit(token, owner, repo, message, tree, parent string) (string, error) {
	var out struct {
		SHA string `json:"sha"`
	}
	st, err := g.do(http.MethodPost, fmt.Sprintf("%s/repos/%s/%s/git/commits", g.APIBase, owner, repo),
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
func (g *Client) updateRef(token, owner, repo, sha string) error {
	st, err := g.do(http.MethodPatch, fmt.Sprintf("%s/repos/%s/%s/git/refs/heads/main", g.APIBase, owner, repo),
		token, map[string]any{"sha": sha, "force": false}, nil)
	if err != nil {
		return err
	}
	if st != http.StatusOK {
		return fmt.Errorf("ref update failed: status=%d (push conflict, retry)", st)
	}
	return nil
}
