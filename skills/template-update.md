# Skill: Update OSB Template Repository

Use this skill when you need to change the underlying infrastructure of the published sites (Vite config, GH Actions, static shell). 

## Context
The `osb-template` repository is a skeleton used to bootstrap new sites. While component code is "hydrated" at publish-time, the core build files live in the template repo.

## The Process
1.  **Clone to Temp:**
    ```bash
    git clone https://github.com/zacharyLYH/osb-template.git /tmp/osb-template
    ```
2.  **Apply Changes:**
    *   Modify `/tmp/osb-template/package.json` (e.g. updating Vite).
    *   Modify `/tmp/osb-template/.github/workflows/deploy.yml` (e.g. changing build steps).
    *   Modify `/tmp/osb-template/vite.config.js`.
3.  **Validate:**
    Run `npm install` and `npm run build` inside the temp directory to ensure the skeleton isn't broken.
4.  **Commit & Push:**
    ```bash
    cd /tmp/osb-template
    git add .
    git commit -m "chore: update infrastructure [reason]"
    git push origin main
    ```
5.  **Cleanup:**
    ```bash
    rm -rf /tmp/osb-template
    ```

## Success Criteria
*   The `osb-template` repo stays "pure" (no component code, just the shell).
*   All new sites created after the push receive the updated infrastructure.
*   Existing sites will only get the update if the user's repo is manually re-synced (future feature) or if they re-publish.
