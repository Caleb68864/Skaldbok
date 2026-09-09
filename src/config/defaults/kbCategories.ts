/** One tab in the Knowledge Base browser's category row. */
export interface KBCategoryTab {
  /** `'all'`, or a `kb_nodes.type` value. Stable; only `label` is display text. */
  id: string;
  label: string;
}

/**
 * Default category tabs of the Knowledge Base browser.
 *
 * @remarks
 * Was a literal inside `VaultBrowser` — a user-facing grouping *and* a set of
 * renamed labels ("People" for `character`), exactly what CLAUDE.md says must
 * live in configuration. Read through `useKBCategoryTabs()`.
 */
export const DEFAULT_KB_CATEGORY_TABS: KBCategoryTab[] = [
  { id: 'all', label: 'All' },
  { id: 'character', label: 'People' },
  { id: 'location', label: 'Places' },
  { id: 'item', label: 'Loot' },
  { id: 'note', label: 'Notes' },
];
