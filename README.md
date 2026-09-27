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

App exports a production-ready zip archive containing index.html, clean CSS/asset links, and an embedded or standalone configuration state file (project-state.json).

Journey B: "Load In" & Re-Editing Existing Sites
Return Visit: User visits the web app with an existing site built using the platform.

Load Project:

User clicks "Load Site" and drags/drops their exported index.html or project-state.json file.

Alternative: User pastes the public URL of their hosted site (if configuration metadata is embedded in the live HTML).

Hydration & Restoration: The app parses the schema and hydrates the visual editor canvas back to the exact layout state.

Iterative Changes: User updates content, layouts, or styling.

Re-Export / Save: User exports the updated site artifacts to overwrite their existing repository or local files.

Journey C: One-Click Publishing via GitHub Pages / Automated Workflows
Initial Repository Setup (One-Time):

User clicks "Publish to Hosting".

App presents options for GitHub Pages, Vercel, or Netlify via client-side authorization (e.g., GitHub Device Flow or OAuth token stored locally).

User forks a provided boilerplate repo template or authorizes direct repo commit access.

Automated Deployment & Iteration:

User edits their page visually on the canvas.

User clicks "Sync & Deploy".

The app sends a direct commit containing the updated index.html and assets to the user's repository via GitHub REST API.

A GitHub Action automatically triggers and updates the live site in under a minute.

4. Key Functional Requirements
4.1 Client-Side Canvas & Visual Editor
Layout Blocks: Pre-configured modern component blocks (Grid, Flexbox, Tailwind-styled primitives) guaranteed to be mobile-responsive.

Style Engine: Fine-grained style panel covering typography, spacing, color palettes, border radiuses, and light/dark theme toggling.

Live DOM Inspection & Hierarchy: A tree/layers view showing component structure for easy selection and reordering.

Code Preview / Edit: Real-time side-by-side view of generated HTML/CSS alongside the visual canvas.
