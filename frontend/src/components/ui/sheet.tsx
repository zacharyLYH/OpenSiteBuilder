/**
 * Editor re-export: the canvas settings panel keeps importing the shadcn
 * path (`components/ui/sheet`), but the implementation lives once in
 * `osb/OSBSheet` — the same file publish ships. No drift, no dup.
 */
export * from '../../osb/OSBSheet'
