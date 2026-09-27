# GitHub Deployment POC Test Plan

## Goal
Test end-to-end deployment of user-built sites to GitHub Pages via OAuth + GitHub Actions.

---

## Prerequisites

### 1. Template Repo (Author's Account)
Create template repo `osb-template` in YOUR GitHub account:
```
osb-template/
├── .github/workflows/deploy.yml    # GitHub Actions workflow
├── index.html                      # Basic HTML structure  
└── README.md
```

Mark as **Template Repository** in Settings → General.

### 2. OAuth App & Serverless Function (Developer Setup)
*Note: This is a setup step for you as the developer.*
1. Register at https://github.com/settings/developers
   - Callback URL: Your frontend URL (e.g., `https://your-app.com/callback`).
2. Deploy a tiny Serverless Function (e.g., Vercel, Cloudflare Worker).
   - Securely store your `client_id` and `client_secret` here as environment variables.
   - This function will act as a secure middleman to fetch the access token for the frontend.

---

## Expected User Journey (The "Gatekeeper" Flow)

To prevent data loss (e.g., losing unsaved site edits during a login redirect) and ensure a smooth publishing experience, the user must authenticate and connect a valid GitHub repository **before** entering the OpenSiteBuilder editor.

### Scenario A: User Has No Repository Yet
1. **User Clicks "Create New Repo"**: App initiates the GitHub OAuth flow.
2. **User Authorizes**: GitHub redirects back, and the app exchanges the code for an Access Token (via the Serverless Function).
3. **App Creates Repo**: App uses the token to `POST /user/repos` from the template.
4. **Manual Setup**: App instructs the user to go to their new repo's settings and enable GitHub Pages (Source -> GitHub Actions).
5. **User Starts Editing**: The user proceeds into the editor with their new repo linked.

### Scenario B: User Already Has a Repository
1. **User Pastes Repo Link**: User provides their existing OpenSiteBuilder repository URL.
2. **App Verifies Access**: App makes a `GET /repos/{owner}/{repo}` request.
   - If the request fails or the response `permissions.push` is false, the app forces the user through the OAuth flow to get a valid Access Token.
3. **User Enters Editor**: Once the token is validated and push access is confirmed, the user is allowed into the editor.

### The "Submit" Action (Inside the Editor)
Because the user was fully authenticated at the front door, the actual deployment is seamless.
- **User Clicks "Submit"**: No OAuth screen is shown.
- **Fetch SHA**: App fetches the latest file SHA of `index.html` from the repository (required to overwrite existing files).
- **Push Updates**: App pushes the new `index.html` via the GitHub API (`PUT`) using the retrieved SHA.
- **Deploy**: GitHub Actions automatically rebuilds and updates the live site.

---

## Success Criteria
- [ ] Total deploy time: < 3 minutes  
- [ ] User actions: Click "Deploy", click "Authorize", enable Pages in Settings
- [ ] No command line required
- [ ] Site renders correctly

---

## Resetting the Test (Teardown)
To run this end-to-end test repeatedly, you can programmatically clean up the test user's GitHub account. 

### 1. Delete the Generated Repository
You must delete the created repository so that Step 3 doesn't fail with a "repository already exists" error on the next run. 
```bash
# Using the GitHub API and the user's Access Token
curl -X DELETE -H "Authorization: Bearer <ACCESS_TOKEN>" \
  https://api.github.com/repos/<username>/my-site
```

### 2. (Optional) Revoke OAuth Authorization
By default, if you test again, GitHub remembers the user authorized your app and skips the consent screen. If you want to explicitly test the consent screen (Step 2) again:
- **Manual:** Go to `Settings -> Applications -> Authorized OAuth Apps` and revoke it.
- **Programmatic:** Use the [GitHub API to revoke the grant](https://docs.github.com/en/rest/apps/oauth-applications#delete-an-app-authorization) using your `client_id` and `client_secret`.

---

## GitHub Actions Workflow (deploy.yml)
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - uses: actions/deploy-pages@v4
```