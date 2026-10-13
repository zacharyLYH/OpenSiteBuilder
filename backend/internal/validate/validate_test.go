package validate

import (
	"testing"
)

func TestPublishablePath(t *testing.T) {
	ok := []string{"src/App.jsx", "src/osb/OSBCard.tsx", "src/lib/utils.ts", "site.json", "src/components/ui/button.jsx", "index.html", "package.json", "package-lock.json", "vite.config.js", "tailwind.config.js", "postcss.config.js", "public/logo.png"}
	for _, p := range ok {
		if !PublishablePath(p) {
			t.Errorf("expected allowed: %s", p)
		}
	}
	blocked := []string{"", "/etc/passwd", "./x", "a/../b", ".github/workflows/deploy.yml", ".GitHub/x", ".git/config", "server.go", "backend/main.go", "README.md", ".env"}
	for _, p := range blocked {
		if PublishablePath(p) {
			t.Errorf("expected blocked: %s", p)
		}
	}
}
