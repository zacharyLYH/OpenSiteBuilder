# OpenSiteBuilder V2 — Simple Plan for a Fast, Pretty, Iterable Builder

Reader: you have no context. You are busy. This doc gives you the whole product and architecture in plain words. No design jargon. No missing pieces.

## 1. What this product is

OpenSiteBuilder lets a normal person build a clean website and put it on the internet for free.

No sign-up for our app. No monthly fee. No code. The person edits in a browser, presses Push, and gets a live link hosted on GitHub Pages. They own their code in their own GitHub repo. They can come back and edit again.

We want our sites to look nicer than Wix and Canva. Think Apple product page: big type, lots of white space, few colors, smooth motion, great photos. We win with taste, not with 500 settings.

## 2. The user journey (the only flow we support in V2)

1. Open the app. See a blank page. One big `+ Add` button. No forced setup.
2. Add something. Pick from a short menu: text, image, button, or a ready-made block like Hero, 2 Columns, 3 Cards, Footer. It appears at the bottom. Done.
3. Arrange. Grab the handle on any block. Drag it. A blue line shows where it will land: between two items, or beside a card. Release. Done. To put two cards side by side, drag one to the right edge of the other. The app wraps both in a Columns box automatically. The user never learns what a Column is.
4. Change words and looks. Click a block. A small side panel shows only its settings: text, image link, button link, color choice, size Small/Medium/Large, alignment left/center/right. No pixel boxes.
5. Check phone. Flip to phone preview. The same page squeezes automatically. Columns stack vertical. Desktop-only nudges turn off. A yellow dot warns on anything custom.
6. Push live. Press Push. The app sends the saved list to GitHub. GitHub builds and hosts. The user gets a link. Edit again later the same way.

The page itself accepts anything. There is no required Section first. A Section is just an optional full-width paint band (background color or image, content centered, max 1200px wide) for when the user wants color. The page acts as a default section so nobody is ever blocked.

## 3. Core rule: order only, no coordinates

V1 stored `x, y, width, height` for every block on a 32-column grid. That forced 600+ lines of math for overlap, snapping, slide bands, and remount hacks, plus a second translation step on publish to guess the reading order. It made the code impossible to iterate.

V2 stores only order. A website is a list of lists:

- Page holds Sections (or Cards directly).
- Columns holds Cards or Stacks side by side.
- Card and Stack hold atoms.
- Atoms (text, button, image, video, badge) hold nothing. They just show.

Max depth is 3: Page > Section > Columns > Card > Button. That covers the tall-left plus two-short-right case (Columns with left = tall card, right = vertical stack of two shorts) and every normal landing page. No deeper nesting. No diagonal canvas. No overlap.

Drag means "insert at this gap." Resize is never a corner drag. Height is always automatic from content. Width is a choice (fill, hug, Small/Medium/Large) or a ratio for Columns (50/50, 70/30, triple). The browser does the layout with flex and grid. What you see in the editor is what publishes, because both use the same drawing code.

## 4. Names we locked (use these exact words in code and UI)

- Atom: a leaf with no children. Text, button, image, video, badge.
- Container: a box that holds things. Section, Columns, Card, Stack. Containers hold atoms, and Columns/Section may hold Cards one level deep. Nothing deeper.
- Preset: a pre-filled container. Hero, Features, Pricing, Testimonials, Footer, Carousel. Insert once, then it behaves like a normal container. Fancy motion and CSS are allowed inside a preset only.
- Page: an ordered list of sections and containers. Has a path like `/` or `/about`.
- Site: pages plus theme plus name. Theme (fonts, colors, spacing) lives in one place. Schema version 1, with an upgrade function for later.
- Canvas: the editor view only. It draws the site plus blue drop lines, selection outlines, hover checkmarks, and the bottom action bar. None of this is saved. Publish strips it.
- Ops: the only five actions. Add, move, edit settings, delete, undo. Every change goes through these. Every change is undoable.
- Registry: the one definition per type. Each type declares its name, its fields, its default settings, what it can hold, and its adapter. The side panel, the validator, and the published site all read this. Add a type by adding one entry.
- Adapter: the thin translator between our site and real shadcn code. It takes our config (for example button label, look, size) and maps it to shadcn props (children, variant, size), then adds the small extras shadcn does not know (alignment wrapper, link wrapper, theme class). About 20 lines per component. shadcn files stay frozen and are updated with the shadcn CLI. If the adapter cannot express a feature without editing shadcn, we do not support that feature in V1.
- UI vendor: the real shadcn components in `components/ui`, identical in the editor repo and the template repo, pinned to one version. We deleted our old forked `OSB*` copies. One source, no duplication. Publish ships the same folder.
- Runtime: the one function that turns a site into React. It imports `site.json`, loops pages and nodes in order, calls the registry adapter to draw each, and wraps with the theme. The editor and the live site use the same runtime.
- Store: browser autosave plus Push to GitHub. Editing never touches the server. Push only sends files.

If a new idea does not fit one of these, reject it. That is how we stop complexity from exploding.

## 5. Remix first, free edit second

Most users never want a blank canvas. They want to pick something great and change the words.

So we ship a catalog of opinionated, high-end presets first: 20 heroes, 20 cards, 20 buttons, plus features, pricing, testimonials, footers. Each looks Apple-grade out of the box because we locked the taste: 3 fonts max, 5 colors, fixed radius and shadows, huge spacing, fade-up motion, great default Unsplash photos with locked crop.

The fast path is: pick a preset, swap it in one click, edit text and image URLs only. Layout stays locked. It cannot look bad.

The power path uses the same parts: unlock to reorder, nudge, change colors and spacing, delete and add. Primitives stay handcuffed (order plus small settings). Presets may cheat inside (custom CSS, absolute decor, marquee animation) because we built and tested that cheat once. Complexity stays inside one preset file, never in the engine. Presets are composed from adapters too, so a Hero is just Cards, Buttons, and Images with fixed copy and locked layout, not a separate engine concept.

## 6. Sizing, nudge, and the percentage rule

Project rule: relative units win, absolute units die.

Widths are percentages and fractions only (`50%`, `1fr 2fr`). Gaps are `rem`. Type is fluid `clamp()`. Images fill `%`. Nudge is `margin-left` in percent of the parent: steps 0, 5, 10, 15, 20%. Desktop only. Phone forces 0% and stacks. A yellow badge says `desktop shift` wherever a nudge exists.

Pixels are allowed only for borders (1px), minimums (column min 240px so nothing crushes), maximums (content max 1200px centered so wide screens stay readable), and fixed eye details like radius and shadow. A lint rule fails the build on `width: 300px` inside parts.

The UI for this:

- Single card: no ratio buttons. Show width mode (fill, hug), size (S, M, L, XL), alignment, max-width, background, padding (tight, comfy, roomy), corners (off, on). Default is centered, hug content, max 720px. Not full-width stretched.
- Columns selected: show split presets (50/50, 70/30, 30/70, triple, auto-fit) plus an optional divider drag that snaps to 25, 33, 50, 66, 75 with a live `%` label, plus a nerd field for `2 : 1`. All three save the same fractions.
- Button inside a card: asks about itself only (words, link, look, size, hug or fill, place left/center/right). The parent card asks about all kids at once (stack down or row side, gap small or big). Cards side by side never negotiate with each other. The parent Columns decides the split. Kids just fill their slot.

Free pixel dragging is banned. Constrained free (snap percentages, capped max-width, desktop-only nudge, live phone preview with warnings) gives users control over edge cases without breaking mobile or the engine.

## 7. Drag and selection without hidden gestures

No lasso. No shift-click. No secret keys. Everything visible.

Each block shows a drag handle and a check tick on hover. Tap ticks to select more than one. A bottom bar appears with big buttons: Move together, Columns, Section, Delete. The left layers list has the same ticks.

While dragging, the app shows wide glowing side pads (`drop side`) and a bottom line (`drop below`). Side drop on a card auto-wraps both cards in a 50/50 Columns box behind the scenes. Bottom drop stacks. Invalid targets show no line, and the parent flashes red if the type cannot hold the child (for example, nothing can drop inside a button). One function, `canHold(parent, child)`, decides for hover, drop, and validation alike, so feedback never lies.

First-time users get one pulsing hint and a `2 side` item in the `+` menu so drag is never required. Pads stick for 300ms to forgive shaky hands.

Grouping works the same way: tick two cards, press Columns, done. No configuration to discover. The app does the wrapping.

## 8. Mobile: one list, no double design

We do not ask users to design twice. That doubles work, causes drift, and doubles bugs.

One ordered list drives all screens. Columns collapse to vertical under 768px. Nudges turn off. Order stays. The only per-phone controls in V1 are hide-on-phone toggles per block. A genuinely different phone layout becomes a second page (`/m`) with a link, not a second mode for the same page.

Nudged or custom items show a yellow dot. Clicking it opens phone preview with the fix: remove nudge or hide on phone. Warn, do not block.

## 9. How deploy and publish work

Deploy today: the user connects GitHub once. The app creates a repo from our template (which holds the GitHub Actions workflow). The user edits in our frontend. On Push, the frontend sends files to our backend (`POST /api/publish`, allowlisted to `src/*`, `public/*`, `index.html`, `package.json`, `site.json`, configs; blocks `.github/*` and `.git/*`). The backend commits with an install token. Actions runs `npm ci && npm run build` and deploys to GitHub Pages. The repo must exist before editing; editing publishes the exact code the editor used.

After an edit lands: update the in-memory list, debounced autosave to browser storage, re-run the single `canHold` check, select the new node, re-render. No server call. No build. Instant.

On publish we send `site.json` plus the fixed runtime plus the shared `components/ui` folder, not generated React per block. The runtime is `import site from './site.json'` plus `<Runtime site={site} />`, which loops and draws through adapters. Rebuilds are small (mostly the JSON changed), fast, and cannot drift from the editor because both sides share the drawer and the same `ui` folder (the publish allowlist already covers `src/*`). Generating custom React per drop would be heavier, buggier, and slower to iterate. Adding a component later means `shadcn add <part>` once in both repos plus one ~20-line adapter plus fields, with a snapshot test on the config-to-props map. Never edit `components/ui` to fit our needs. If the adapter cannot do it, the feature waits.

The old `CanvasStage` (react-grid-layout board with cells, ghosts, epoch remounts) is deleted in V2. The new canvas is a plain vertical list using the same runtime plus edit chrome. Drag uses a lightweight list sorter (dnd-kit sortable or native HTML5), saving only the new index. No `seatRect`, `slideCell`, `eventCell`, `containerFloor`, or contiguity math.

## 10. What we build next

Branch `archive-grid-v1` holds the old grid code for reference. `main` builds V2 clean with no backward compatibility and no feature flags (no users yet).

Order: delete forked `OSB*` components and install real shadcn into `components/ui` in both editor and template repos first, then registry plus adapters, runtime shared second, list ops and store third, plain canvas with gaps and ticks fourth, Columns plus presets plus nudge-percent plus phone preview last. Small pull requests per entity. Remix catalog quality is the kicker: fewer, better, Apple-grade presets beat an open pixel canvas.

## 11. How owner works with agent (replicate this)

When it comes to communication, the goal is to help users get to understanding in the shortest time possible, down to the second. Here's how we'll achieve this goal:

Prose: 
- Summary; The efficiency of Singlish. Most compact way to convey ideas through words.
- Pretend you're doing an elevator pitch. Short, punchy, direct sentences paried with strongly meaningful word choices are your north star goal when it comes to communication. 
- Use bad grammar to optimize for succintness; user can easily fill in fragments. Keep verbs and nouns. But do not gloss over important points.
- Keep prose casual and non techncial word choice simple. This is to optimize for skimmability. No preamble. Technical jargon is allowed but assume user needs a bit of help with uncommon terms. 


Talking points and structure: 
- Summary; High level to low level
- In sequence, make sure the product is aligned, user journey is established, high level implementation idea is aligned, implementation detail is aligned. Do not jump into a deep step until users brain is one with your idea. You have the vested power to even waste a turn confirming things!
- Taxonomy lock. Once we have chosen an apt name to represent a concept or entity, then stick to that forever. This is to drive adoption and consistency. No synonym drift.
- Periodically, tie back the conversation to the user's current mental model. This is helpful to let user see the bigger picture.
- Point out pros, cons, and edge cases where applicable to let user develop better mental model for the choices they need to make
