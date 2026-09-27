1.1 Vision
To deliver a frictionless, accountless web publishing experience where users visually build and edit modern web pages in the browser and publish them directly to free static hosting (e.g., GitHub Pages) with minimal effort.

1.2 Core Philosophy
Zero Backend / Accountless: The application runs completely client-side. The user's site source/state is the single source of truth.

Modern & Clean Aesthetics: Output modern, accessible, and responsive components by default (avoiding absolute positioning mess).

Open & Portable: Users fully own their code and configuration files. No vendor lock-in.

2. Target Audience & Personas
The Casual Developer / Hacker: Wants to spin up a landing page or personal portfolio quickly without dealing with local build tools or complex CMS backends.

The Creator / Indie Maker: Needs a clean, high-converting landing page hosted on their own domain/GitHub Pages without paying recurring platform fees.

The Non-Technical User with GitHub Access: Comfortable following a simple one-time setup guide to get free hosting, but wants a visual canvas for ongoing page edits.

3. High-Level User Journey & Workflows
Journey A: First-Time Creation & Local Export
Landing & Canvas Access: User lands on the web app URL. No login, sign-up, or email collection is required.

Template / Blank Slate Selection: User selects a starter design system/theme or a blank canvas.

Visual Editing:

User drags/drops pre-designed modern layout blocks (Hero, Features, Pricing, Testimonials, Footer).

User modifies copy, colors, spacing, image links, and component settings in real-time.

Responsive preview modes (Desktop, Tablet, Mobile) allow instant device checks.

Source Generation & Download:

User clicks "Export / Download".

Process: Built-in React component generation. Export bundles React source files with styling configurations.

Journey B: "Load In" & Re-Editing Existing Sites
Return Visit: User visits the web app with an existing site built using the platform.

Import from GitHub: User pastes their GitHub Pages URL (e.g., https://username.github.io/my-site).

Automatic Discovery: App fetches React component files from their repo, extracts component types from filenames and props from component code, and reconstructs the visual canvas.

No DSL/State Files Required: Component structure is inferred directly from React file naming convention and structure.

Iterative Changes: User updates content, layouts, or styling.

One-Click Sync: User clicks "Deploy" and changes are pushed to their repo via GitHub API.

Journey C: One-Click Publishing via GitHub Actions
Initial Repository Setup (One-Time):

User clicks "Deploy to GitHub".

App guides user through OAuth, creates repo from template (which contains the GitHub Actions workflow).

Enable GitHub Pages: User clicks "Enable Pages" once in their repo Settings.

Deploy: User clicks "Sync & Deploy".

GitHub Actions runs `npm run build` on their code.

Site is live at https://username.github.io/repo-name within 60 seconds.

Subsequent Edits: User makes changes in editor, clicks "Sync & Deploy" → Action rebuilds and redeploys.

4. Key Functional Requirements
4.1 Client-Side Canvas & Visual Editor
Layout Blocks: Pre-configured modern component blocks (Grid, Flexbox, Tailwind-styled primitives) guaranteed to be mobile-responsive.

Style Engine: Fine-grained style panel covering typography, spacing, color palettes, border radiuses, and light/dark theme toggling.

Live DOM Inspection & Hierarchy: A tree/layers view showing component structure for easy selection and reordering.

Code Preview / Edit: Real-time side-by-side view of generated HTML/CSS alongside the visual canvas.
