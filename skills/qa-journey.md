# Skill: AI-Driven QA Journeys (Find Product Gaps)

Use this skill when you want to know whether a realistic site can be built in
OpenSiteBuilder today — and, when it can't, exactly which feature is missing.

## Context

Unit tests prove components render. Component e2e specs prove gestures work.
Neither answers "can a user build a 3-column pricing page?" A QA journey is a
Playwright spec in `frontend/e2e/qa-*.spec.ts` that performs ONE realistic
build task through real UI gestures only (palette/pattern drops, drawer edits,
child drags — the same vocabulary as `osb-nesting.spec.ts`), asserting the
persisted doc after each step.

## The Process

1.  **Pick a task** a real user would attempt (pricing page, restaurant menu,
    photo gallery, FAQ, landing hero, …). One task = one spec file.
2.  **Write the journey as independent tests**, one per build step. Each test
    seeds its own doc with `openCanvas(page, slug, doc)` (fixed ids) so a
    failure isolates to one step — never chain UI state across tests.
3.  **Assert the persisted doc**, not pixels: `persistedDoc` + `validateDoc`.
    One screenshot per journey is allowed: the finished-page state mounted
    through `/osb-mount`, as a visual record of what "done" looks like today.
    Gaps stay pixel-free (`test.fixme`, never snapshots).
4.  **Record gaps as `test.fixme`**, not failures: a `fixme` names the missing
    capability ("tiers render side by side", "bullet list atom") and keeps the
    suite green while the gap is tracked in code. A journey with no `fixme`
    means the task is fully buildable today.
5.  **Run it:** `npm run test:e2e -- qa-<task>` from `frontend/`.
6.  **Triage:** every `fixme` is a feature request with a reproduction. File
    them (or fix them) before writing the next journey.

## Success Criteria

*   Every step a user can do today is covered by a passing test.
*   Every step a user CANNOT do today is a `test.fixme` with a one-line gap
    note — never a red test, never a silent skip.
*   At most one `toHaveScreenshot` per journey (the finished state); commit
    its baseline snapshot alongside the spec.
*   No coordinates invented in the spec — `dropToCell`, `dragChildToCell`,
    testids, and drawer labels only.
