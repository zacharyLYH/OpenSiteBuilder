# Codegen V2: Data-Driven Runtime

Current codegen is string-crammed hell. Brittle. One missing `</div>` kills the site. V2 moves to "Player + Manifest" model. Real production grade stuff.

## The Architecture
Stop generating `.jsx` files. Generate `site.json` instead. 
*   **Zero Legacy Baggage:** No backward compatibility needed. Break things freely. If we change the engine or JSON schema, a "Re-Publish" just overwrites the old world. Simple.


*   **Manifest (`site.json`):** Pure data. Tree of nodes, types, and configs.
*   **The Engine (`OSBRuntime.tsx`):** Generic React component. Recursively loops JSON, looks up type in Registry, renders component.
*   **The Registry (`registry.tsx`):** Map of strings to actual React components (`"button" -> OSBButton`).
*   **The Skeleton (`template/`):** Standard Vite shell. `App.jsx` just imports the Manifest and passes it to the Engine.

## Ownership & Distribution
Main OSB repo owns the "Source of Truth" for components and the engine.

1.  **Source:** `frontend/src/osb/` contains all UI atoms + Engine + Registry.
2.  **Hydration:** When user hits "Publish", backend does a folder-sync.
3.  **Result:** User repo gets a fresh copy of `src/osb/` and a new `site.json`.

## The Update Loop (Strategy: Re-Publish)
If we improve `OSBButton.tsx` in the main repo:
1.  Existing user sites don't change (stable).
2.  User wants the new shiny button.

## The "One Runtime" Rule
`OSBRuntime` is NOT just for publishing. It is the primary renderer for:
1.  **The Canvas:** Renders components with editor-only wrappers (handles/outlines).
2.  **The Preview:** Renders the live state exactly as it will appear published.
3.  **The Published Site:** Renders the `site.json` manifest.

**Success = Zero Drift.** If you see it in the OSB app, the runtime is working. The engine is constantly "live-tested" during the design phase.


## Technical Build Flow
Vite treats the repo as a standard SPA. No magic strings at build time.

1.  **Import Chain:** `App.jsx` -> `OSBRuntime` -> `Registry` -> `OSBComponents`.
2.  **Data:** `site.json` is imported as a standard ES module.
3.  **Bundling:** `npm run build` crawls the imports, minifies the components, and bakes the JSON into the JS bundle.
4.  **Execution:** In browser, `OSBRuntime` acts as a "Recursive Switch Statement" rendering React components based on the `site.json` tree.

3.  User opens OpenSiteBuilder editor.
4.  User hits **Publish**.
5.  System overwrites their `src/osb/` with latest code + pushes to GH.
6.  GH Actions builds the site. Done.

## User Journey
1.  **Creation:** Build site in canvas.
2.  **First Deploy:** Click "Publish". System creates repo, hydrates `osb/` engine, drops `site.json`.
3.  **Iteration:** Edit canvas -> Publish. Only `site.json` changes. Fast.
4.  **Maintenance:** OSB releases new features. User re-opens editor -> Publish. Entire engine updates.

## Success Criteria
*   **Syntactic Safety:** Zero risk of "invalid code generation". If JSON is valid, site renders.
*   **WYSIWYG:** Canvas and Published site use *exact* same `OSBRuntime` and component files. No drift.
*   **Eject-ability:** User can delete `site.json` and keep the `osb/` components to build a custom React app. Clean code.
*   **Speed:** Backend publishing is just a file-copy + JSON-string-dump. No heavy lifting.

## The Gaps (To be Addressed)
1.  **Asset Sync:** The "Hydration" step must push local images/fonts to the user's `public/` folder, not just code.
2.  **Dependency Merging:** Closed — publish derives the user repo's
    `package.json` from the builder frontend's own manifest and ships the
    frontend's lock with it (`publishedPackageJson` in `push.ts`), so a new
    component dependency reaches new and already-created repos on the next
    publish with no manual template sync.
3.  **The "Managed" Boundary:** Users must be warned that the `src/osb/` folder is owned by the Builder. Manual changes there WILL be overwritten on re-publish.
6. **SEO & SSG (Option A):** The `template/` will include a pre-rendering script. At build-time (GitHub Actions), `ReactDOMServer.renderToString()` will run the `OSBRuntime` to bake the `site.json` content directly into the `index.html`. 
    *   **Benefit:** Instant load for users + perfect SEO for crawlers.
    *   **UI Requirement:** A new "Site Settings" modal in the OSB app will allow users to set global Meta Tags (Title, Description, Social Image). These tags will be stored in `site.json` and injected into the `<head>` during build-time.

4.  **SEO Strategy:** Initial V2 is an SPA (Client-side render). Future V2.1 will use a Vite SSG plugin to pre-render the JSON into HTML for Googlebot.
5.  **Route Mapping:** `site.json` should support a `routes` key to handle multi-page navigation within the same runtime.

## Implementation Status

Done in this pass:

*   **Manifest + Engine.** `frontend/src/osb/OSBRuntime.tsx` is the engine
    (`OSBRuntime`, `OSBNodeView`, `OSBOverlayView`); the manifest shape is
    `SiteManifest` / `SitePage` / `SiteNode` in `frontend/src/site/types.ts`.
    `codegen.ts` (JSX emission) is deleted.
*   **Publish = hydration.** `push.ts` ships the static skeleton `App.jsx`, the
    whole builder-owned `src/osb/` runtime folder, and `site.json` — no code
    generation. `template/App.jsx` stays a buildable placeholder that the first
    publish overwrites.
*   **One runtime (publish + screenshots).** `mount.tsx` renders through
    `OSBNodeView` / `OSBOverlayView`, the same engine the published site uses.
    The canvas still renders the *same components* through the *same registry*,
    but keeps its own grid/selection wrappers rather than going through
    `OSBRuntime` — folding editor chrome into the engine is follow-up work.
*   **Backend.** No new endpoints; the publish allowlist already covers
    `src/**` + `site.json`. The per-request file cap moved to a named
    `maxPublishFiles` (64) so the whole runtime folder fits with headroom.

Still open: asset sync (gap 1), the managed-folder
notice (gap 3), SSG pre-render (gap 6), and multi-page routes (gap 5).

