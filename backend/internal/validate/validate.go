package validate

import (
	"regexp"
	"strings"
)

// slugRe constrains site names to lowercase letters, numbers, hyphens.
var slugRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,99}$`)

// ValidSlug reports whether slug may be used for a site/repo name.
func ValidSlug(slug string) bool {
	return slugRe.MatchString(slug)
}

// PublishablePath reports whether path may be written through P1.
func PublishablePath(p string) bool {
	if p == "" || strings.HasPrefix(p, "/") || strings.HasPrefix(p, "./") {
		return false
	}
	for _, seg := range strings.Split(p, "/") {
		if seg == "" || seg == "." || seg == ".." {
			return false
		}
	}
	lower := strings.ToLower(p)
	if lower == ".github" || strings.HasPrefix(lower, ".github/") {
		return false
	}
	if lower == ".git" || strings.HasPrefix(lower, ".git/") {
		return false
	}
	switch {
	case strings.HasPrefix(p, "src/"):
		return true
	case strings.HasPrefix(p, "public/"):
		return true
	case p == "index.html" || p == "package.json" || p == "package-lock.json" ||
		p == "vite.config.js" || p == "tailwind.config.js" || p == "postcss.config.js" || p == "site.json":
		return true
	}
	return false
}
