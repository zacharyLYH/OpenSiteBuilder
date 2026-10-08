# GitHub Deployment POC Test Plan (GitHub App + React)

## What it is

This file describes how OpenSiteBuilder publishes React sites to GitHub Pages. The repo stores source code. GitHub Actions builds the site. Pages serves the build output.

## Terms

The frontend never holds GitHub tokens. The frontend holds only `OSB_SESSION`.

- `GH_CODE` is the consent receipt. GitHub creates the receipt after the user clicks Install. The receipt lives 10 minutes. The receipt alone does nothing.
- `installation_id` identifies the install slot. Example: OSB on maya is install 123. OSB on zac is install 456. The value is a plain number. The value is not secret.
- `CLIENT_SECRET` is the backend password. The backend uses the password to trade `GH_CODE` for `GH_USER`.
- `PRIVATE_KEY` is the backend signing key. The backend uses the key to create `GH_APP_JWT`.
- `GH_USER` acts as the user. The backend creates `GH_USER` once. The backend reads login from `GET /user` (owner comes from the token, never typed), then checks or creates the repo.
- `GH_APP_JWT` proves the app identity. The backend creates `GH_APP_JWT`. GitHub accepts `GH_APP_JWT` for 10 minutes.
- `GH_INSTALL` acts on one install. GitHub issues `GH_INSTALL` after the backend presents `GH_APP_JWT`. `GH_INSTALL` lasts 1 hour. The backend uses `GH_INSTALL` to push code and enable Pages.
- `OSB_SESSION` is the app session cookie. The cookie connects the frontend to the backend.

Moves use fixed names:

- `R1` sends the user to GitHub.
- `R2` returns the user with `GH_CODE` and `installation_id`.
- `E1` sends `GH_CODE` and `installation_id` to the backend.
- `G1` checks or creates the repo and enables Pages.
- `P1` publishes site content.

## Why this design exists

Two keys serve two jobs. `CLIENT_SECRET` supports user consent and repo creation. `PRIVATE_KEY` supports server pushes without user involvement. One test account supports all test loops. No new GitHub accounts are required.

## Tech stack and deployment

Backend uses Go. Frontend uses React plus Vite. User sites use React plus Vite. No code lives in this file. This section records alignment only.

Edge nginx owns one domain. Prod domain is `https://opensitebuilder.bytesbylyh.dev`. Dev origin is `http://localhost:9999`. Host ports `5173` and `8080` are taken by other projects. This project avoids both ports.

- Only edge publishes to the host. Edge publishes `9999:80`.
- Frontend listens on internal port `80`. Frontend exposes no host port.
- Backend listens on internal port `18081`. Backend exposes no host port. The backend never uses `8080`.
- Local non-Docker dev uses `http://localhost:9999` for the frontend dev server and `http://localhost:18081` for `go run`. Edge nginx still provides the single-origin shape in Docker.

- `/` routes to the frontend container. The container serves the Vite build.
- `/callback` routes to the frontend container. The React route forwards `GH_CODE` and `installation_id` to the backend.
- `/api/*` routes to the backend container. The backend serves exchange, publish, repo, and health.
- `/healthz` routes to the backend container. The route supports container healthchecks.

Frontend and backend run in separate containers. Edge nginx runs in front. Same origin removes CORS work. The browser sees one domain.

Backend env vars are `APP_ID`, `PRIVATE_KEY_PEM`, `CLIENT_ID`, `CLIENT_SECRET`, `SESSION_HMAC_KEY`, `PUBLIC_BASE_URL`, `TEMPLATE_OWNER`, and `TEMPLATE_REPO`. `PUBLIC_BASE_URL` is the prod domain in prod and `http://localhost:9999` in dev. GitHub App registers both callbacks.

### Live values (non-secret)

- `APP_SLUG` is `opensitebuilder-bytesbylyh-dev`.
- `APP_ID` is `5226393`.
- `CLIENT_ID` is `Iv23liBOHhapv9XPFgLw`.
- `TEST_OWNER` is `zacharyLYH`.
- Test install lives on `TEST_OWNER` with All repositories. Reinstalls mint a fresh installation ID; nothing pins it — the backend and the probe both discover the install by owner login at runtime.
- `TEMPLATE_FULL_NAME` is `zacharyLYH/osb-template`.
- Callback URL is `https://opensitebuilder.bytesbylyh.dev/callback`. Setup URL is the same URL.
- `CLIENT_SECRET` stays local in `.env`. `dev.pem` stays local in `./secrets/dev.pem`. The backend reads the key through `PRIVATE_KEY_PATH`. The file never stores secrets.
- One file serves dev and prod. The file name is `.env`, not `.env.test`. Shared values (`APP_ID`, `CLIENT_ID`, `TEMPLATE_*`, secrets) stay identical. Per-env value `PUBLIC_BASE_URL` is overridden by compose: prod uses the prod domain, dev uses `http://localhost:9999`. No second setup run exists.
- One GitHub App serves dev and prod. Saved Callback and Setup URLs stay prod. Localhost tests copy `GH_CODE` and `installation_id` manually from the prod redirect. No settings flip runs.
- Generate `SESSION_HMAC_KEY` once now with 32 random bytes. Reuse the same key in dev and prod for the POC. Rotate the key later only forces logout because `OSB_SESSION` cookies invalidate.
- Gitignore covers `.env` and `secrets/`. Commit `.env.example` with empty secret slots and the path placeholder only.
- Prod DNS and edge nginx are not live yet. Local testing uses prod URLs with manual copy of `GH_CODE` and `installation_id`.

## How it works

### Setup

The template lives in the dev account. Example: `opensitebuilder/osb-template`. The template contains Vite, React, and `deploy.yml`. The workflow runs `npm ci`, runs `npm run build`, uploads `dist/`, and deploys the upload.

The GitHub App requests four permissions: Contents read/write, Pages read/write, Administration read/write, Metadata read-only. Administration covers repo creation from the template (`generate` returns `Resource not accessible by integration` without it). The backend stores `APP_ID`, `PRIVATE_KEY`, `CLIENT_ID`, and `CLIENT_SECRET`. The backend exposes `/api/exchange` and `/api/publish`.

### First publish

1. The user edits anonymously and enters a slug. Example slug: `my-shop`.
2. `R1` starts. The user clicks Publish and clicks Install on GitHub. The app requests All repositories. This selection avoids the chicken-egg problem because the repo does not exist yet.
3. `R2` returns `GH_CODE` and `installation_id`.
4. `E1` and `G1` run automatically. The backend verifies `state` first. The backend trades `GH_CODE` for `GH_USER`. The backend checks `GET /repos/{owner}/{slug}`. A 404 response means the name is free. The backend creates the repo from the template when the name is free. The backend mints `GH_INSTALL` and enables Pages with `build_type: workflow`.
5. `P1` publishes. The backend commits React source with the Git Data API. The backend follows the sequence blob, tree, commit, ref. Actions builds `dist/` and deploys the result.

### Return visit

The user supplies owner and slug. The backend pulls `src/*` with `GH_INSTALL` and loads the editor. No GitHub redirect occurs unless the user uninstalled the app.

### URLs and visibility

Repo name controls the URL. Example: `maya/my-shop` serves `https://maya.github.io/my-shop/`. Repos must be public for Free users. GitHub restricts Pages on Free to public repos.

## How testing works

One throwaway account is enough. Install the dev app once with All repositories.

- Unit tests run on every save. Unit tests mock `api.github.com`. Unit tests check the tree-commit payload and block `.github/**`.
- Integration tests run in the tight loop. Integration tests mint `GH_INSTALL` directly from `GH_APP_JWT`. Integration tests push to the fixed probe repo `osb-e2e-probe`. Integration tests skip `R1`, `R2`, and `GH_CODE`. The skip is valid because presence check and push both work with `GH_INSTALL` after the repo exists.
- Browser tests run rarely. Browser tests perform one real `R1` and `R2` with Playwright. Browser tests catch consent-screen regressions.

The tight loop uses four commands: mint token, ensure probe repo, publish probe, watch Actions and curl the live URL. The loop reuses the same probe repo because reuse keeps the npm cache warm.

## Important limitations

- `GH_CODE` expires after 10 minutes. Each code works once.
- `GH_INSTALL` expires after 1 hour. The backend refreshes the token on demand.
- `vite.config.js` must set `base: './'`. The setting keeps asset paths valid for any `<owner>.github.io/<repo>/` URL.
- The app must never push to `.github/` after creation. This rule avoids repeated workflow scope requirements.
- Rate limits apply. Limit `E1` by IP. Limit `P1` per install.
