package main

import (
	"fmt"
	"net/http"
)

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
