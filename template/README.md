# osb-template

Minimal Vite plus React shell for OpenSiteBuilder user sites. Copy this repo
per user site through GitHub Generate. Do not add builder code here.

The shell stays buildable on its own (the placeholder `App.jsx`). On the first
**Publish**, the builder hydrates the repo — it ships the runtime into
`src/osb/` (the engine, registry, and components), drops `site.json`, and
overwrites `src/App.jsx` with the static skeleton that imports the manifest and
hands it to `OSBRuntime`. `src/osb/` is builder-owned: manual edits there are
overwritten on every publish (see `docs/codegen-v2.md`).
