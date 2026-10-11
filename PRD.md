# Product Requirements Document: Visual-First Website Builder

**Status:** Product direction aligned; detailed implementation and scope remain to be validated  
**Product category:** Visual website creation and static publishing  
**Target audience:** Nontechnical users who want to create and publish attractive websites with minimal friction  
**Core experience:** A visual canvas, intelligent layout guides, intuitive component insertion, responsive editing, and one-click publishing  
**Initial publishing target:** GitHub Pages  
**Frontend:** React and TypeScript  
**Primary product constraint:** Favor simplicity and good defaults over maximum customization.

---

# 1. Executive Summary

## 1.1 Product vision

Build a website builder that allows nontechnical users to create attractive, functional websites through direct visual manipulation, without needing to learn HTML, CSS, JavaScript, or traditional web design concepts.

The product should combine the accessibility of a drag-and-drop builder with the compositional freedom of a design canvas, while avoiding the complexity of professional design tools.

Users should be able to:

1. Start with a blank page.
2. Add content and components through a simple insertion menu.
3. Arrange elements visually on a canvas.
4. Customize appearance through a contextual inspector.
5. Preview desktop, tablet, and mobile layouts.
6. Make mobile-specific adjustments when automatic responsiveness is insufficient.
7. Publish a working static website with minimal effort.

The user should spend their time deciding what their website should say and look like, rather than configuring the system that makes it work.

## 1.2 The central product thesis

**Give users creative freedom without making them responsible for designing the underlying layout system.**

The builder should not be a rigid template editor, where users can only rearrange predefined blocks. Nor should it be a general-purpose graphics editor, where users must manage arbitrary coordinates, constraints, and responsive behavior themselves.

Instead, the product should provide:

- A blank canvas as the starting point.
- Visual layout guides that help users align and position elements.
- Sensible layout behavior that works automatically.
- A small, approachable set of components and customization options.
- Responsive defaults, with explicit overrides when necessary.
- A straightforward path from editing to publishing.

The guiding philosophy is to constrain complexity rather than creativity.

## 1.3 What success looks like

A nontechnical user can create a credible, visually coherent website without consulting documentation or learning web development terminology.

The experience should feel natural enough that users can discover how to use it by trying things. Mistakes should be easy to undo, the interface should communicate what is happening, and publishing should not require users to understand a build pipeline or deployment infrastructure.

---

# 2. Product Principles

These principles govern feature decisions, UX design, and technical architecture.

## 2.1 Minimal friction over maximum control

Every additional control creates cognitive overhead. A feature should not be included merely because professional tools offer it.

When deciding between a simple default and a more configurable system:

- Prefer the simple default when it covers common use cases.
- Offer a small number of understandable alternatives when they provide meaningful value.
- Expose advanced controls only when the user needs them.
- Accept that some unusual layouts will not be supported initially.

The product should optimize for the number of users who successfully publish a good website, not the theoretical number of layouts that can be constructed.

## 2.2 Good defaults are a core feature

The system should make reasonable decisions automatically.

Examples:

- Text grows vertically when content wraps.
- Elements align and space themselves consistently.
- Images fit their containers sensibly.
- Multi-column layouts adapt to smaller screens.
- Buttons size themselves appropriately to their labels.
- Empty collections remain empty until the user adds content.
- Mobile inherits desktop content and styling unless an override is necessary.
- Published pages use sensible typography, spacing, and semantic HTML.

Users should not have to configure these behaviors individually.

## 2.3 Visual-first, not configuration-first

Users should interact directly with the page wherever possible.

They should be able to click an image to select it, drag an element to reposition it when appropriate, resize an element using handles, and see changes immediately.

The property inspector complements direct manipulation. It is not the primary way users must construct a page.

## 2.4 Blank-canvas freedom, with guardrails

Users should not be forced to start from a template or a prescribed page structure.

They can add a heading, image, button, or layout container directly to an empty page. The builder should introduce structure when it helps, rather than requiring it as a prerequisite.

At the same time, it should prevent common mistakes such as invalid nesting, accidental overlap, unusable mobile layouts, and elements that cannot fit their content.

## 2.5 Progressive disclosure

The default interface should be compact.

Common operations should be immediately available. Less common options should appear contextually.

For example:

- Selecting a heading reveals its text, typography, and alignment controls.
- Selecting a grid reveals its column and gap settings.
- Selecting an image reveals its source, crop, and sizing controls.
- Selecting a button reveals its label, destination, and appearance.

Users should not see every property supported by the rendering engine.

## 2.6 Consistency over arbitrary freedom

Similar operations should behave similarly across the application.

- Insertion should follow predictable rules.
- Selection should not accidentally move elements.
- Resizing should have consistent handles and feedback.
- Responsive overrides should inherit predictably.
- Undo should reverse the user's last meaningful operation.
- Saving and publishing should have clear, distinct meanings.

## 2.7 The editor should remain maintainable

The editor must not become a collection of component-specific exceptions.

New component types, property controls, patterns, and behaviors should be added primarily through definitions and implementations, rather than by modifying the generic editor for every new feature.

The document model should remain the source of truth for both editing and publishing.

---

# 3. Target Users and Primary Jobs

## 3.1 Primary user

A nontechnical person who wants to put a website online without learning a web framework, configuring a design system, or hiring a developer.

Potential website types include:

- Personal websites and portfolios.
- Small business landing pages.
- Service and product pages.
- Event and campaign pages.
- Simple informational websites.
- Small multi-page websites.

The initial product should optimize for these relatively common website needs rather than complex applications.

## 3.2 User jobs

The product should help users accomplish the following jobs.

**Create:** Turn an idea into a page without starting from a complicated template.

**Arrange:** Position and organize content visually without learning layout terminology.

**Customize:** Change the content and appearance of elements using intuitive controls.

**Adapt:** Ensure the website looks good on mobile and desktop without designing everything twice.

**Publish:** Get a real, working website online without understanding deployment infrastructure.

**Iterate:** Return later, make changes, preview them, and publish an updated version.

## 3.3 Out of scope for the initial target

The first version does not need to be a professional-grade replacement for Figma, Webflow, or a full content management system.

Avoid making the initial product responsible for:

- Arbitrary graphic design and illustration.
- Complex web applications with custom business logic.
- A full visual programming system.
- Unrestricted CSS and JavaScript editing.
- Sophisticated database-backed content management.
- A complete design-system authoring environment.
- Every possible animation, interaction, and positioning mode.

These may be considered later if supported by demonstrated user needs.

---

# 4. Core User Experience

## 4.1 The primary journey

```text
Open project
    |
    v
Blank page
    |
    v
Add an element
    |
    v
Arrange and customize visually
    |
    v
Repeat until the page looks right
    |
    v
Preview desktop / tablet / mobile
    |
    v
Adjust mobile where necessary
    |
    v
Publish
    |
    v
Live website
```

The journey should be linear and forgiving. Users should not have to complete setup steps unrelated to the page they are creating.

## 4.2 Start with a blank page

The default starting point is an empty page, not a mandatory template.

The page itself acts as an implicit root container. Users do not have to insert a Section or Container before adding content.

An empty page can accept a heading, paragraph, image, button, or layout element directly.

Example document structure:

```text
Page
├── Heading
├── Paragraph
├── Image
├── Button
└── Grid
    ├── Card
    └── Card
```

An alternative composition can introduce more explicit structure:

```text
Page
└── Section
    └── Container
        └── Grid
            ├── Card
            ├── Card
            └── Card
```

Both should be valid.

The product should not force users to learn a prescribed hierarchy before they can create something.

## 4.3 Add components through an insertion menu

A persistent Add button in the editor toolbar opens the component catalog. Contextual insertion affordances can also appear between existing elements.

Both entry points use the same underlying catalog and insertion logic.

The menu should be searchable, compact, and organized around recognizable concepts.

Recommended initial categories:

- **Essentials:** Heading, Paragraph, Image, Button, Link.
- **Layout:** Stack, Grid, Container, Section, Spacer.
- **Content:** Card, List, and a small selection of useful content elements.
- **Patterns:** Hero, Navigation, Feature section, Testimonials, Footer.

The initial catalog should contain approximately 12–20 core components, plus a handful of useful patterns. The exact inventory should be validated against common website tasks.

Avoid an overwhelming library of nearly identical components.

### Insertion rules

Insertion depends on the current selection and the type of component being added.

| Current context | User adds | Expected result |
|---|---|---|
| Empty page | Heading | Heading becomes a root child |
| Empty page | Grid | Empty grid is inserted |
| Grid selected | Card | Card is inserted inside the grid |
| Heading selected | Image | Image is inserted after the heading |
| List selected | List item | Item is appended to the list |
| Page or insertion point | Hero pattern | Full hero composition is inserted |

Selection is not the same as nesting.

Selecting a heading should not cause every subsequently inserted element to become its child. When the selected element cannot contain the new component, insert the new component adjacent to it.

The system should prevent invalid nesting rather than requiring users to understand the component hierarchy.

### Empty-state behavior

An empty Grid should show an unobtrusive placeholder and an Add item affordance.

It should not silently create sample cards or example content. The user should remain in control of what appears on the page.

### Patterns

Patterns are precomposed groups of editable components.

Examples include Hero, Navigation, Feature section, Testimonials, and Footer.

Inserting a pattern should insert its component composition into the page. Users can then edit its content and structure like any other page element.

Patterns are optional accelerators, not mandatory starting points. A user should be able to create the same composition manually.

### Menu polish

- Search should support both component names and user intent.
- Search for "columns" should find Grid.
- Search for "top navigation" should find Navigation.
- Recently used components may be surfaced when useful.
- Pattern previews should communicate what will be inserted.
- Keyboard navigation should support searching, selecting, Enter, and Escape.
- Invalid destinations should not accept an insertion.

The catalog should be generated from the component registry, not maintained as a separate hardcoded list.

---

# 5. Canvas and Layout Guides

## 5.1 The agreed direction

Use a visual canvas with intelligent layout guides.

The original checkerboard idea was intended to give users a spatial model for positioning and resizing elements. However, a permanent, fixed checkerboard risks making the editor feel like a rigid grid editor or a CAD tool.

The refined direction is to borrow the useful aspects of design-tool layout guides without exposing the complexity of a full design application.

**The guides are visual aids, not the underlying layout system.**

## 5.2 Expected behavior

The canvas should have a clear page boundary and a subtle indication of the available content area.

When the user drags or resizes an element, the editor can display:

- Alignment guides.
- Center lines.
- Spacing indicators.
- Snapping targets.
- Container boundaries.
- Clear insertion positions.
- Selection outlines and resize handles.

Guides should become more prominent when useful and disappear when the operation finishes.

A permanent checkerboard should not dominate the canvas. A grid or column guide may be available when it helps users understand alignment, but it should remain subtle and ideally optional.

## 5.3 Layout behavior

The editor should favor content-aware, flow-based layout.

Examples:

- Text grows vertically when it wraps.
- A button normally sizes itself to its content.
- A Stack arranges children in a row or column.
- A Grid organizes children into a structured layout.
- A container constrains content width.
- Images fit their assigned area without accidental distortion.
- Sections and containers maintain predictable spacing.

Resizing a text element should generally change its available width, not force the text into an arbitrary fixed-height box.

This avoids clipping, unexplained whitespace, and fragile page layouts.

## 5.4 Three layout concepts

The implementation should distinguish three layers.

**Visual guides:** Alignment lines, snapping, grid overlays, and spacing indicators. These assist editing but do not determine published layout.

**Layout containers:** Page, Section, Container, Stack, and Grid. These define relationships, grouping, spacing, and sizing behavior.

**Website elements:** Headings, text, images, buttons, cards, lists, and other meaningful content.

Keeping these concepts separate allows the editor's visual aids to evolve without rewriting the document model.

## 5.5 Direct manipulation

Users should be able to:

- Click an element to select it.
- Drag an element when its layout permits repositioning.
- Resize elements using handles.
- Reorder elements through clear insertion zones.
- Change the layout of a group using simple, understandable options.
- Edit properties through a contextual inspector.

Selection and dragging must be distinct interactions. A dedicated drag handle can be used for operations that might otherwise conflict with text editing or nested selection.

Normal flow-based layouts should not behave like arbitrary coordinate canvases.

Free positioning may be supported for intentional overlaps and special compositions, but it should be an advanced capability rather than the default behavior of every element.

## 5.6 Dragging and collision behavior

The editor must distinguish between the pointer touching an element and the user's intended insertion target.

Use explicit insertion zones:

- Before an element.
- After an element.
- Inside a container.
- Inside a repeatable collection.

Show a clear insertion indicator while dragging.

If the target does not accept the element, do not silently nest it. Provide a valid alternative or clear feedback.

True visual overlap should generally occur only when intentionally configured through a supported positioning behavior.

---

# 6. Component System and Customization

## 6.1 Component philosophy

Components are meaningful website elements, not arbitrary graphical objects.

The user should think in terms of "add a heading," "insert a grid," or "change the image," rather than configure an HTML element or write a CSS rule.

The system should separate:

1. Component implementation.
2. Component definition.
3. Component instance.

### Component implementation

The React code that actually renders the component and implements its behavior.

### Component definition

The metadata describing its supported properties, defaults, permitted children, capabilities, and editor controls.

### Component instance

The values for a particular occurrence of the component, stored in the page document.

This separation allows the editor to remain generic while individual components can evolve independently.

## 6.2 Initial component families

### Structural and layout components

- Page root, implicit rather than manually inserted.
- Section.
- Container.
- Stack.
- Grid.
- Spacer.
- Slot, where needed for reusable compositions.

### Content components

- Heading.
- Paragraph or rich text.
- Image.
- Button.
- Link.
- Icon.
- List and List item.
- Card.
- Video, if required by the initial use cases.

### Patterns

- Navigation.
- Hero.
- Feature section.
- Testimonials.
- Pricing section, if useful.
- Footer.

Patterns should be compositions of ordinary editable components wherever practical, not opaque special-case widgets.

### Modern and motion components

Modern, visually rich components are first-class citizens alongside the basics. They reuse the same two nesting models — no new engine concepts:

- Marquee (infinite scrolling text/logo strip). Leaf: items are plain strings edited as a repeatable collection in the inspector, not canvas children.
- Accordion. Fixed slots: list of header/body items, edited in the inspector.
- Tabs. Fixed slots: one panel per tab, where each panel is a free-form container.
- Carousel / testimonial slider. Fixed slots: ordered slide list, where each slide is a free-form container.
- Modal / popover trigger. Leaf plus a link target; dialog content is a free-form container edited in place.
- Announcement bar. Leaf with text and link fields.
- Animated counter / stat. Leaf with numeric fields.
- Before/after image slider. Leaf with two asset references.

Rule of thumb: if children need spatial arrangement, the component is (or contains) a free-form container governed by the allowed-child rules in §10.5. If children are uniform repeated data (marquee items, accordion rows, dropdown options), they are inspector-edited collections, never canvas nodes.

## 6.3 Property inspector

The inspector is context-sensitive.

It should show the smallest set of controls necessary to edit the selected element.

Examples:

| Selection | Primary controls |
|---|---|
| Heading | Text, size, weight, alignment, color |
| Paragraph | Text, typography, alignment |
| Image | Image source, crop, fit, alt text |
| Button | Label, destination, appearance |
| Stack | Direction, alignment, spacing |
| Grid | Columns, gap, child arrangement |
| Section | Background, content width, spacing |
| Card | Content, appearance, internal layout |

Advanced properties should be revealed only when they are useful.

The inspector should not expose raw CSS or require the user to understand implementation details.

## 6.4 Property definitions

Property definitions should declare the value type, default, validation rules, available options, and editor control.

Supported control families may include:

- Text and rich text.
- Number and dimension.
- Color or theme token.
- Enumerated options.
- Boolean toggle.
- Asset picker.
- Component or page reference.
- Repeatable collection.
- Responsive value.

These definitions should drive the inspector UI and validation.

Adding a new property should generally not require writing a new bespoke inspector panel.

## 6.5 Behaviors and modifiers

Do not multiply component types merely because their behavior differs.

For example, avoid separate components for every possible combination of scrollable, sticky, visible, and hoverable content.

Instead, define composable behaviors and supported capabilities.

Potential behaviors include:

- Horizontal or vertical overflow.
- Sticky positioning.
- Hover effects.
- Visibility rules.
- Navigation to another page.
- Scrolling to a page element.
- Background treatments.
- Responsive visibility.

Only expose behaviors appropriate for the selected component.

The registry must define dependencies and validation. For example, an edge-fade effect should require a compatible overflow behavior.

The user should see understandable settings, not a list of technical implementation flags.

## 6.6 Styling system

Use a constrained styling system with predictable defaults.

- Design tokens for color, typography, spacing, radius, border, and shadow.
- Responsive rules for supported breakpoints.
- CSS custom properties for dynamic values.
- Tailwind for suitable static utility classes.
- Dedicated CSS for complex effects.

Avoid arbitrary CSS selectors as the mechanism for expressing semantic relationships between components.

Avoid constructing dynamic Tailwind class names from incomplete strings, since those classes may not be included in the production build. Use complete known class mappings or CSS variables instead.

The objective is not to expose a styling framework to users. It is to provide a reliable implementation behind a simple interface.

---

# 7. Responsive Design

## 7.1 Agreed UX direction

Use **one page with breakpoint-specific editing**.

Users should be able to switch between desktop, tablet, and mobile views of the same page. The editor renders the actual responsive result rather than merely scaling a screenshot.

The default is one shared page and one shared set of content.

The user should not be required to design a separate mobile website unless their requirements genuinely call for a substantially different composition.

## 7.2 The problem

Responsive design is not always a matter of shrinking elements.

A desktop hero might place text and an image side by side. On mobile, the image might need to move below the text. A navigation bar might collapse. Some secondary content may become unnecessary. A mobile-specific composition might be more appropriate.

Automatic rules will cover many cases, but cannot anticipate every user's intent.

## 7.3 Three levels of responsive behavior

### Level 1: Automatic adaptation

This is the default.

The system handles common changes automatically:

- Multi-column layouts collapse or reflow.
- Widths adapt to available space.
- Text wraps naturally.
- Images fit their containers.
- Spacing and typography adjust sensibly.
- Overflow is handled predictably.

The user does not need to configure every breakpoint.

### Level 2: Breakpoint-specific overrides

Users can switch to mobile or tablet mode and adjust selected properties.

Supported overrides may include:

- Width and sizing.
- Alignment.
- Spacing.
- Column count.
- Element order.
- Typography.
- Image crop.
- Visibility.
- Supported positioning properties.

Only properties explicitly changed at a breakpoint should override the base value.

The inspector should clearly indicate when a property has an override and offer a way to reset it to inherited behavior.

### Level 3: Alternative compositions

Some users will need more than property overrides.

For example, a desktop hero might use a large illustration, while the mobile version needs a different composition and a different image.

The architecture should leave room for alternate compositions or viewport-specific elements. However, this should not be a prominent or mandatory part of the initial workflow.

Where possible, users should share content between layouts rather than maintain two completely independent pages.

## 7.4 Responsive editing interaction

The editor should provide a compact viewport switcher:

**Desktop | Tablet | Mobile**

When the user changes the viewport:

1. The canvas changes to the selected viewport width.
2. The actual layout is recalculated.
3. Existing responsive overrides are applied.
4. The user can select and edit elements.
5. New changes apply at the appropriate breakpoint.
6. A clear indicator identifies breakpoint-specific values.

The experience should feel like editing the same website through a different window.

It should not feel like entering a separate application.

## 7.5 Responsive grid behavior

The visual guides must adapt to the viewport.

A desktop layout might use twelve conceptual columns, while mobile uses fewer. Elements can span different proportions of the available width at different breakpoints.

However, the grid overlay is only an editing aid. The actual layout is determined by the component's layout rules.

Avoid a fixed physical cell size that makes mobile cells too narrow or causes horizontal scrolling.

Default to fluid widths and content-aware heights.

## 7.6 Responsive implementation principles

- The document model must support responsive properties from the beginning.
- Base values are inherited unless an override exists.
- Resetting an override restores inheritance; it does not copy the current desktop value into mobile.
- Only properties that meaningfully support responsive behavior should be responsive.
- Layout relationships may need structured breakpoint overrides rather than independent values for every property.
- The editor must preview the same responsive rules that the published website uses.

A conceptual type might look like:

```ts
type ResponsiveValue<T> = {
  base: T;
  tablet?: T;
  mobile?: T;
};
```

This is an illustration of the inheritance model, not a requirement that every property use this exact representation.

## 7.7 Responsive scope decision

The first version should support automatic adaptation and useful property overrides. More complex alternate compositions can be added after real user needs justify them.

This balances flexibility against the cognitive and engineering cost of maintaining multiple layouts.

---

# 8. Pages, Navigation, and Reusable Content

## 8.1 Pages are first-class entities

A website can contain multiple pages.

Each page should have its own:

- Stable ID.
- URL path.
- Content tree.
- Page title and metadata.
- Relevant publishing configuration.

The home page should have a predictable root route. Additional pages should be publishable at clean paths, such as `/about/` or `/contact/`.

## 8.2 Navigation

Links should reference a page ID where the destination is another page within the project.

External links should store a URL.

Internal navigation should not depend on fragile page names or hardcoded document positions.

Other supported references may include:

- Navigate to a page.
- Scroll to a specific element.
- Show or hide an element, if supported.

These references should be typed and validated. Deleting a target must not silently leave broken internal references.

## 8.3 Reusable compositions

Three concepts must remain distinct.

**Patterns:** Precomposed layouts inserted into a page as editable nodes.

**Shared symbols:** Reusable definitions referenced from multiple locations. Updating the shared definition updates its instances, with an option to detach an instance when independent editing is required.

**Variants:** Different supported appearances or configurations of the same component, such as primary and secondary button styles.

Patterns should be the primary reuse mechanism initially because they are easy to understand and can be implemented as ordinary page structures.

Shared symbols and richer variant management should be introduced only when their value outweighs their complexity.

## 8.4 Collections and lists

Lists and repeatable content should be first-class concepts.

A collection should define:

- Its items and order.
- The structure used to render each item.
- The configuration shared across items.

Initially, users can author collection items directly in the editor.

Later, collections may support data-driven content, but the first version does not need a general-purpose CMS.

---

# 9. Core Interaction Model

## 9.1 Selection

Clicking an element selects it and displays its selection outline and relevant inspector.

Nested elements should remain individually selectable.

The editor should not select or move a parent merely because the pointer passes through it.

Where overlapping elements make direct selection difficult, the layers panel should provide a reliable alternative.

## 9.2 Insertion and nesting

Insertion should be governed by a central set of rules.

The system determines:

- Which components may be inserted at the root.
- Which children a container may accept.
- Whether the current insertion target is valid.
- Whether the new element should be inserted inside, before, or after the current selection.

Invalid nesting should be prevented.

## 9.3 Dragging and reordering

The editor should distinguish between selecting, dragging, and resizing.

Dragging should show a clear destination indicator. Reordering should preserve the intended hierarchy.

If the user drags an element over a container, the editor should only show an inside insertion target if that container accepts the element.

The system should avoid ambiguous drop behavior.

## 9.4 Undo and redo

Meaningful editing operations should be reversible.

Examples include:

- Insert element.
- Remove element.
- Move element.
- Change property.
- Reorder collection item.
- Change responsive override.
- Insert pattern.

Undo and redo should operate on document operations, not arbitrary DOM mutations.

## 9.5 Editing and publishing states

The user should understand the difference between the current working version and the published version.

Recommended behavior:

- Changes update the local editor and preview immediately.
- Saving persists the document and its assets.
- Publishing produces a new deployable site and triggers deployment.
- Deployment status is visible.
- Errors explain what the user can do next.

The UI may combine Save and Publish into a simplified workflow, but the underlying operations should remain distinct.

---

# 10. Document Model and Architecture

## 10.1 Source of truth

The canonical source of truth is a versioned JSON document.

The editor must not treat generated JSX, DOM nodes, or published HTML as the authoritative representation of the website.

The JSON document represents the intended page structure, component instances, content, layout configuration, theme, responsive overrides, and references.

This makes it possible to edit, validate, migrate, serialize, and publish the website predictably.

## 10.2 Conceptual document structure

```text
WebsiteDocument
├── Schema version
├── Site metadata
├── Pages
│   ├── Page ID
│   ├── Path and metadata
│   └── Component tree
├── Theme tokens
├── Shared symbols (when supported)
├── Asset references
└── Publishing configuration
```

Each component instance should have a stable ID and typed properties.

Responsive overrides should be represented explicitly.

Relationships between components should use stable references, not arbitrary CSS selectors or positional assumptions.

## 10.3 Core definitions

The implementation should distinguish the following concepts.

| Concept | Responsibility |
|---|---|
| Website document | Canonical saved representation |
| Page | Route, metadata, and root component tree |
| Node | One instance of a component in a document |
| Component definition | Supported component type and its capabilities |
| Property definition | Value type, defaults, validation, and editor control |
| Behavior definition | Reusable interaction or layout capability |
| Pattern definition | Reusable composition |
| Theme | Design tokens and global style defaults |
| Asset | Image, video, or other referenced file |
| Responsive override | Property or layout variation at a breakpoint |

These concepts should have clear ownership and boundaries.

## 10.4 Component registry

The registry describes what the editor can insert and how it can be configured.

A component definition should include, as appropriate:

- Component type identifier.
- Human-readable name and category.
- Default properties.
- Property definitions.
- Allowed child types.
- Named slots.
- Supported behaviors.
- Validation rules.
- Rendering implementation.
- Migration support where necessary.

The generic editor should consume these definitions.

Adding a component should not require a new bespoke insertion menu, inspector, or rendering branch for every feature.

## 10.5 Allowed-child rules

Each component definition declares which children it accepts.

Examples:

- Page accepts supported root elements.
- Section accepts layout and content elements.
- Grid accepts permitted layout/content children.
- Stack accepts supported child elements.
- List accepts List items.
- Button accepts only the content structures it explicitly supports.
- Tabs accept tab panels; each panel is a free-form container for layout/content children.
- Carousel accepts slides; each slide is a free-form container.
- Marquee, accordion, dropdown, and other collection-backed components do not take canvas children — their items are inspector-edited data (§6.2).

Root-level insertion rules are distinct from rules for nested children.

These rules should be validated in the document engine and used by insertion and drag-and-drop interactions.

## 10.6 Document operations

All meaningful edits should pass through a central document operation layer.

Examples:

- `insertNode`
- `moveNode`
- `updateProps`
- `removeNode`
- `reorderCollectionItem`
- `setResponsiveOverride`
- `insertPattern`

Operations should validate changes, maintain stable references, and provide the information needed for undo and redo.

This avoids duplicating document mutation logic across the canvas, inspector, and insertion menu.

It also creates a foundation for future collaboration without requiring real-time collaboration in the initial release.

## 10.7 Validation and migrations

The document schema must be versioned.

Validation should check:

- Required fields and supported types.
- Stable IDs and reference integrity.
- Allowed parent-child relationships.
- Valid property values.
- Responsive override structures.
- Page paths and navigation targets.
- Asset references.
- Supported component and behavior combinations.

Schema migrations should handle changes to saved documents as the product evolves.

Unknown or invalid values should produce clear errors or controlled fallbacks, rather than silently corrupting a project.

---

# 11. Rendering and Publishing

## 11.1 Architecture overview

The editor and published website should use the same canonical document, but serve different purposes.

```text
                    Canonical JSON
                          |
             +------------+------------+
             |                         |
             v                         v
       Editor renderer           Publisher
             |                         |
             v                         v
       Live preview             Generate site
                                       |
                                       v
                                  Static build
                                       |
                                       v
                                  dist output
                                       |
                                       v
                                GitHub Pages
```

The live editor renderer prioritizes immediate feedback and editing interactions.

The publishing pipeline prioritizes valid, performant, production-ready output.

Both should use the same component definitions, design tokens, layout semantics, and supported behavior rules wherever practical.

## 11.2 Live rendering

The editor renders the current in-memory document.

Changes should be reflected immediately without requiring a build or deployment.

The editor may use overlays for selection, resize handles, guides, and other editing-only controls. These must not leak into the published website.

## 11.3 Static publishing

Publishing converts the canonical document into a deployable static website.

The initial approach is to generate the required project/source files from the document, then run a conventional frontend build.

The system may generate TSX or other project source internally. It does not need to generate human-readable JSX as a primary product feature.

The resulting site should contain static HTML, CSS, JavaScript, and assets.

## 11.4 GitHub integration

The initial persistence and deployment model uses a GitHub repository.

The repository stores the canonical JSON, required assets, and generated project/build configuration.

The intended workflow:

1. The user edits the document in the browser.
2. Saving persists the document and assets.
3. Publishing prepares the generated site.
4. The publishing workflow commits or updates the required files.
5. GitHub Actions installs dependencies and builds the site.
6. The workflow deploys the static output to GitHub Pages.
7. The editor reports the deployment status and resulting URL.

The exact authentication and repository provisioning flow remains an implementation decision.

The product should shield users from Git terminology and build configuration wherever possible.

## 11.5 Multi-page routes

Prefer actual static pages with clean routes when practical.

For example:

```text
dist/
├── index.html
├── about/
│   └── index.html
├── contact/
│   └── index.html
└── assets/
```

A client-side router with a fallback can be considered if the hosting setup requires it, but clean static routes are the preferred default for SEO, direct navigation, and predictable hosting behavior.

## 11.6 Build failures

Publishing failures should be visible and actionable.

Users should not have to read raw build logs to understand common issues.

The system should:

- Identify the failing stage.
- Present a concise error summary.
- Preserve the user's working document.
- Allow the user to retry after a fix.
- Keep the last successfully published site intact where deployment infrastructure permits.

Publishing must not destroy the editable source document.

---

# 12. Suggested Project Organization

The following is a conceptual organization, not a requirement to use these exact paths.

```text
src/
├── document/
│   ├── schema.ts
│   ├── validation.ts
│   ├── operations.ts
│   └── migrations/
│
├── registry/
│   ├── components/
│   ├── properties/
│   ├── behaviors/
│   └── patterns/
│
├── renderer/
│   ├── render-node.tsx
│   ├── render-page.tsx
│   ├── runtime/
│   └── styles/
│
├── editor/
│   ├── canvas/
│   ├── inspector/
│   ├── insert-panel/
│   ├── drag-drop/
│   ├── layers/
│   ├── responsive/
│   └── history/
│
├── publishing/
│   ├── build-site.ts
│   ├── routes.ts
│   └── assets.ts
│
└── theme/
    ├── tokens.ts
    └── responsive.ts
```

The purpose of this separation is to make the system easier to reason about and extend.

The editor should not own the document schema. The component registry should not depend on the insertion menu. The publisher should not invent its own interpretation of responsive behavior.

---

# 13. Non-Goals and Deliberate Constraints

The product should explicitly resist unnecessary complexity.

## 13.1 Not a general-purpose design tool

No requirement to reproduce every Figma capability.

The builder borrows useful concepts such as visual selection, guides, layout containers, and contextual controls, but does not aim to support arbitrary graphic design.

## 13.2 Not unrestricted pixel positioning

Arbitrary coordinate placement is not the default.

Most elements should participate in flow-based layouts. Free positioning is reserved for intentional overlaps and advanced cases.

## 13.3 Not a template-first product

Templates and patterns are useful shortcuts, but a blank page must remain a first-class starting point.

Users should not need to delete a prebuilt design before creating their own.

## 13.4 Not an unlimited component marketplace

Start with a small, useful catalog.

Avoid overwhelming users with many components that differ only superficially.

## 13.5 Not a full CMS initially

Authored lists and collections are sufficient for the initial product.

External data sources, complex content modeling, and sophisticated collection management are not required to validate the core experience.

## 13.6 Not a full custom-code environment

Users should not need to write code to use the product.

The internal architecture should remain extensible, but raw CSS and JavaScript are not part of the default editing experience.

## 13.7 Not two independent websites for responsive design

The default model is one page with inherited content and breakpoint-specific overrides.

A completely independent mobile composition is an escape hatch, not the initial workflow.

## 13.8 Not a complicated design system

Tokens and reusable components should support consistency behind the scenes.

Users should not have to create and manage a formal design system to publish a coherent website.

---

# 14. Functional Requirements

## 14.1 Editing

- The user can create a project and open a blank page.
- The user can add supported components at the root.
- The user can insert components into valid containers.
- The user can select nested elements.
- The user can change component properties through contextual controls.
- The user can drag, resize, and reorder supported elements.
- The user can undo and redo meaningful changes.
- The user can remove elements without corrupting the document.
- The canvas updates immediately after edits.

## 14.2 Insertion

- The insertion menu supports search and categories.
- Components are listed from registry definitions.
- Insertion respects selection and valid child rules.
- Invalid nesting is prevented.
- Patterns insert editable compositions.
- Empty collections expose an explicit Add item action.
- Contextual insertion and the persistent Add menu share the same insertion logic.

## 14.3 Layout and guides

- The canvas displays a clear page boundary.
- The editor provides alignment and snapping feedback during manipulation.
- Visual guides do not become published content.
- Normal flow-based layout preserves content sizing and reflow.
- Layout containers expose a small number of understandable controls.
- Free positioning does not become the default for every element.

## 14.4 Responsive editing

- Desktop, tablet, and mobile previews are available.
- The preview renders actual responsive behavior.
- The user can change supported properties at a breakpoint.
- The editor distinguishes inherited values from overrides.
- Overrides can be reset to inherited behavior.
- The document can store responsive properties without losing base values.
- The published site follows the same responsive semantics as the editor.

## 14.5 Pages and assets

- The project supports multiple pages.
- Pages have stable IDs and paths.
- Internal navigation uses page references.
- External links use URLs.
- Images and other supported media use asset references.
- Missing or invalid references are detected.
- Page metadata can be configured for publishing.

## 14.6 Persistence and publishing

- The canonical JSON document can be serialized and restored.
- Assets can be persisted alongside the project.
- Saving and publishing are logically distinct.
- Publishing generates a static site.
- Deployment failures are surfaced to the user.
- The last working editable document is preserved after a failed build.
- The published URL is shown when deployment succeeds.

---

# 15. Non-Functional Requirements

## 15.1 Reliability

Document operations must preserve structural validity.

The editor should recover from invalid operations gracefully, and failed publishing should not destroy the source document.

## 15.2 Performance

- Common canvas interactions should feel immediate.
- Selection and inspector updates should not require rebuilding the published site.
- The editor should remain usable with realistic multi-section pages.
- Expensive publishing operations should happen outside the interactive editing loop.
- Asset loading and rendering should avoid unnecessary work.

Exact performance budgets should be established through prototypes and measured against representative projects.

## 15.3 Accessibility

The editor should provide usable keyboard navigation for core workflows.

Published websites should use semantic HTML and support accessible labels, image alt text, readable contrast, and keyboard-operable interactions where appropriate.

Accessibility should be part of the component definitions and rendering contracts, not a last-minute styling pass.

## 15.4 Maintainability

- The document schema is versioned.
- Component definitions and implementations are separated.
- Property controls are generated from schemas where practical.
- Rendering semantics are shared between preview and publishing.
- Layout and responsive logic have explicit contracts.
- New components do not require rewriting the generic editor.
- Automated tests cover document validity and rendering behavior.

## 15.5 Security

- Treat document content and uploaded assets as untrusted input.
- Sanitize rich text and user-provided URLs.
- Avoid unsafe arbitrary code execution.
- Keep credentials and publishing tokens out of generated public assets.
- Validate repository and publishing operations.
- Ensure generated output does not accidentally expose secrets or internal editor data.

The exact GitHub authentication model and permission scope must be established before implementation.

---

# 16. Development Plan

The milestones below are ordered to reduce architectural risk. They are not fixed time estimates.

## Milestone 1: Document engine

Build the versioned document schema, validation, serialization, stable IDs, and central document operations.

Prove that basic elements can be inserted, moved, updated, removed, and restored.

**Exit criteria:** A valid document can be edited through operations, serialized, reloaded, and validated without losing its structure.

## Milestone 2: Core component registry and renderer

Implement the first set of structural and content components, along with their property definitions and default values.

Build a renderer that can display a document from the registry.

**Exit criteria:** A new component can be registered and rendered without adding component-specific code to the generic editor.

## Milestone 3: Blank canvas and insertion UX

Implement the empty canvas, selection, insertion menu, contextual insertion, property inspector, and basic drag-and-drop behavior.

Add alignment guides, snapping, and clear insertion indicators.

**Exit criteria:** A user can create a simple page from scratch without manually editing JSON or code.

## Milestone 4: Layout behavior

Implement Stack, Grid, Container, Section, and content-aware sizing.

Define predictable defaults for spacing, alignment, and responsive layout.

**Exit criteria:** Common layouts can be created and edited without requiring arbitrary coordinates or manual CSS.

## Milestone 5: Responsive editing

Add viewport switching, automatic responsive defaults, breakpoint-specific overrides, and reset-to-inherited behavior.

Ensure the preview reflects the same rules used by publishing.

**Exit criteria:** Users can refine a mobile layout without duplicating the entire page.

## Milestone 6: Static publishing

Implement project generation, asset handling, multi-page output, production builds, and GitHub Pages deployment.

**Exit criteria:** A saved document produces a functioning public static website, and deployment errors are recoverable.

## Milestone 7: Patterns and polish

Add a small library of useful patterns, improve empty states, refine keyboard interactions, and validate the end-to-end workflow with nontechnical users.

**Exit criteria:** Users can create and publish a representative website with minimal assistance.

---

# 17. Testing Strategy

## 17.1 Document tests

- Schema validation.
- Stable ID uniqueness.
- Serialization and deserialization round trips.
- Migration between schema versions.
- Parent-child constraint validation.
- Reference integrity.
- Responsive override inheritance.
- Undo and redo correctness.

## 17.2 Editor interaction tests

- Inserting at the page root.
- Inserting inside a valid container.
- Inserting before and after selected elements.
- Preventing invalid nesting.
- Selecting nested elements.
- Reordering elements.
- Resizing supported components.
- Undoing and redoing operations.
- Resetting responsive overrides.

## 17.3 Rendering tests

- Every registered component renders correctly.
- Missing optional properties fall back to sensible defaults.
- Text expansion does not unexpectedly clip subsequent content.
- Images preserve their intended fit and crop behavior.
- Layout containers respond correctly to content changes.
- Editor-only selection controls do not appear in published output.

## 17.4 Responsive tests

- Desktop layouts remain valid at tablet and mobile widths.
- Grid and Stack layouts reflow as expected.
- Breakpoint overrides apply only where intended.
- Resetting an override restores inherited behavior.
- No unintended horizontal overflow occurs in representative layouts.
- Mobile-specific ordering does not corrupt the base layout.
- Preview and published output agree.

## 17.5 Publishing tests

- A single-page website builds successfully.
- A multi-page website produces the correct routes.
- Internal links resolve correctly.
- Assets load from their deployed paths.
- A failed build preserves the editable document.
- A successful deployment returns a working URL.
- Generated output does not contain editor-only functionality or secrets.

---

# 18. Success Metrics

The product should be measured by how effectively users get a website published, not by the number of configuration options used.

Recommended metrics:

### Activation

- Percentage of new users who add their first element.
- Percentage who create a page with meaningful content.
- Time to first useful preview.

### Completion

- Percentage who publish their first website.
- Median time from project creation to first publication.
- Percentage who complete the workflow without assistance.

### Quality

- Percentage of published sites with valid layouts at common viewport widths.
- Incidence of unintended overflow or clipped content.
- Incidence of broken internal links and missing assets.

### Retention

- Percentage of users who return to edit an existing website.
- Percentage who successfully publish an update.
- Percentage who abandon projects before publishing.

### Complexity indicators

- Frequency of users opening advanced settings.
- Number of failed or undone drag-and-drop operations.
- Number of users who need help understanding insertion or responsive behavior.

These metrics should guide decisions about whether a new control is necessary. A feature that adds flexibility but increases abandonment may not be a net improvement.

---

# 19. Key Risks and Mitigations

## Risk 1: The canvas becomes too rigid

If the layout system is too restrictive, users may be unable to create distinctive compositions.

**Mitigation:** Support multiple understandable layout modes, meaningful patterns, and a controlled free-positioning capability for special cases.

## Risk 2: The canvas becomes too complex

Too many guides, handles, and configuration panels could make the editor feel like a professional design tool.

**Mitigation:** Keep guides contextual, use a small component catalog, and reveal advanced settings progressively.

## Risk 3: Responsive overrides become confusing

Users may not understand why a value differs on mobile.

**Mitigation:** Make inheritance explicit, visually identify overridden properties, and provide a clear reset action.

## Risk 4: The editor and published site diverge

If the live renderer and publishing pipeline interpret the document differently, users may publish something different from what they previewed.

**Mitigation:** Share component definitions, layout semantics, theme tokens, and responsive rules. Test preview-versus-published parity.

## Risk 5: Component-specific code proliferates

If each component requires custom editor and rendering logic, the codebase becomes difficult to extend.

**Mitigation:** Use a registry, typed property definitions, reusable inspector controls, explicit child rules, and central document operations.

## Risk 6: GitHub deployment leaks into the user experience

Repository terminology, build logs, and configuration may overwhelm the target audience.

**Mitigation:** Hide infrastructure details behind a simple project and publishing workflow. Surface technical details only when troubleshooting requires them.

## Risk 7: Too much architecture is built before product validation

A highly extensible system can become overengineered before the core UX is proven.

**Mitigation:** Build the smallest architecture that preserves the essential boundaries: canonical document, registry, renderer, editor operations, responsive model, and publisher. Defer collaboration, full CMS capabilities, and complex symbol management.

---

# 20. Decisions to Preserve

The following decisions represent the current product direction.

| Area | Agreed direction |
|---|---|
| Target user | Nontechnical users who want to publish with minimal friction |
| Product philosophy | Simplicity and good defaults over maximum control |
| Starting point | Blank page, not mandatory templates |
| Canvas | Visual canvas with contextual layout guides |
| Checkerboard | Not the foundational layout system; any grid overlay remains an editing aid |
| Layout | Flow-based by default, with Grid and other simple layout containers |
| Positioning | Direct manipulation where appropriate; free positioning is not the default |
| Insertion | Searchable Add menu plus contextual insertion affordances |
| Components | Small, useful catalog with editable patterns |
| Inspector | Context-sensitive and progressively disclosed |
| Component architecture | Registry-driven, with separate implementation, definition, and instance |
| Document source of truth | Versioned JSON |
| Editing | Central document operations with undo/redo support |
| Responsive UX | One page with desktop, tablet, and mobile editing modes |
| Responsive defaults | Automatic adaptation and inherited values |
| Mobile customization | Breakpoint-specific overrides, with more independent compositions deferred |
| Rendering | Interactive live renderer plus static publishing pipeline |
| Hosting | GitHub Pages as the initial publishing target |
| Scope | Common informational and landing-page websites before complex applications |
| Priorities | Ease of use, predictable behavior, visual quality, and maintainability |

---

# 21. Open Questions

These decisions should be resolved through prototyping or implementation, rather than prematurely expanding the scope.

1. **Canvas sizing:** Should the page boundary represent the full viewport, a centered maximum-width content region, or both?

2. **Drag behavior:** Which elements should be freely repositionable, and which should only be reordered within their layout?

3. **Grid implementation:** Which layout relationships should be exposed directly, and which should remain automatic?

4. **Responsive breakpoints:** What default breakpoint widths best fit the intended component library?

5. **Mobile-specific composition:** What is the simplest way to let users replace or rearrange a composition without creating duplicate content?

6. **Pattern editing:** Should patterns be inserted as ordinary editable nodes initially, with shared symbols added later?

7. **Project onboarding:** What minimum setup is needed before the first page can be edited?

8. **Publishing authentication:** What is the simplest secure way to connect a user to GitHub and provision or select a repository?

9. **Asset handling:** What file-size, format, and image optimization defaults are necessary for reliable publishing?

10. **Site configuration:** Which metadata, domain, and SEO controls belong in the initial release?

11. **User validation:** Which representative website types should be used to test whether the blank-canvas workflow is intuitive?

---

# 22. Final Product Direction

The product should feel like a simple visual workspace that happens to create real websites.

The canvas provides a direct way to work. Layout guides make alignment easier without introducing another system users need to configure. Components give meaningful structure to the page. Sensible defaults handle the technical details. Responsive editing lets users refine smaller screens without maintaining a second website. Publishing turns the result into a live static site.

The architecture should support that simplicity rather than leak its own complexity into the interface.

The core product promise is:

**Start with a blank page. Add what you need. Arrange it naturally. Let the builder handle the details. Publish when you're ready.**

Every major feature should be evaluated against that promise. If it gives users more control but makes the common workflow harder, it should not be included by default.