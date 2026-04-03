import type { CharacterRecord } from '../../types/character';

/**
 * A resolved party member, combining the raw party member identity with the
 * optional linked {@link CharacterRecord} loaded from storage.
 *
 * Used as the item shape consumed by {@link PartyPicker} so callers don't have
 * to perform async lookups inside the component.
 */
export interface ResolvedMember {
  /** Unique identifier for the party member (matches `PartyMember.id`). */
  id: string;
  /** Display name of the member. Derived from the linked character or the raw party-member name. */
  name: string;
  /**
   * The full character record when the member has a linked character, or
   * `null` when the member is unlinked (e.g., a manually-added NPC slot).
   */
  character: CharacterRecord | null;
}

/** Base inline styles shared by every member chip button. */
const chipStyle = {
  minHeight: '44px',
  padding: '0 14px',
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: '22px',
  color: 'var(--color-text)',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 600,
  flexShrink: 0,
} as const;

/**
 * A sticky horizontal chip-row that lets the user pick which party member(s)
 * an action applies to.
 *
 * When `multiSelect` is `true` (the default) a special "Party" chip appears
 * (for groups of 2+) that selects or deselects all members at once.
 * Duplicate member names are automatically disambiguated by appending a
 * numeric rank suffix (e.g., "Raven (1)", "Raven (2)").
 *
 * @param members - The full list of resolved party members to display.
 * @param selected - Array of member `id`s that are currently selected.
 *   Pass `['__party__']`-equivalent behaviour by ensuring all ids are present.
 * @param onSelect - Callback invoked with the updated id array whenever the
 *   selection changes.
 * @param multiSelect - When `false`, clicking a chip replaces the entire
 *   selection with just that member. Defaults to `true`.
 *
 * @example
 * <PartyPicker
 *   members={resolvedMembers}
 *   selected={selectedIds}
 *   onSelect={setSelectedIds}
 * />
 */
export function PartyPicker({
  members,
  selected,
  onSelect,
  multiSelect,
}: {
  members: ResolvedMember[];
  selected: string[];
  onSelect: (ids: string[]) => void;
  multiSelect?: boolean;
}) {
  const isMulti = multiSelect !== false; // default true

  /**
   * Toggle selection for a single member id or the virtual `'__party__'` token.
   *
   * In multi-select mode `'__party__'` selects all members when not all are
   * selected, or clears the selection when all are already selected.
   * Individual ids are added/removed from the selection array.
   *
   * In single-select mode the selection is always replaced with `[id]`.
   *
   * @param id - Member id to toggle, or `'__party__'` for the whole-party shortcut.
   */
  const toggle = (id: string) => {
    if (isMulti) {
      if (id === '__party__') {
        // Select all or deselect all
        if (selected.length === members.length) onSelect([]);
        else onSelect(members.map(m => m.id));
      } else {
        if (selected.includes(id)) onSelect(selected.filter(s => s !== id));
        else onSelect([...selected.filter(s => s !== '__party__'), id]);
      }
    } else {
      onSelect([id]);
    }
  };

  /**
   * Returns whether a given chip should render in its selected state.
   *
   * The `'__party__'` virtual id is considered selected only when every
   * member in the list is individually selected.
   *
   * @param id - Member id or `'__party__'` to check.
   * @returns `true` if the chip should appear highlighted.
   */
  const isSelected = (id: string) => {
    if (id === '__party__') return selected.length === members.length && members.length > 0;
    return selected.includes(id);
  };

  // Disambiguate duplicate names by appending an index suffix
  const disambiguatedNames = members.map((m, idx) => {
    const sameNameCount = members.filter(other => other.name === m.name).length;
    if (sameNameCount > 1) {
      const rank = members.slice(0, idx + 1).filter(other => other.name === m.name).length;
      return { ...m, displayName: `${m.name} (${rank})` };
    }
    return { ...m, displayName: m.name };
  });

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        background: 'var(--color-surface)',
        paddingBottom: '8px',
        marginBottom: '4px',
        borderBottom: '1px solid var(--color-border)',
        zIndex: 1,
      }}
    >
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', marginTop: '0' }}>
        Who?
      </p>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {members.length > 1 && (
          <button
            onClick={() => toggle('__party__')}
            style={{
              ...chipStyle,
              background: isSelected('__party__') ? 'var(--color-accent)' : 'var(--color-surface-raised)',
              color: isSelected('__party__') ? 'var(--color-on-accent, #fff)' : 'var(--color-text)',
            }}
          >
            Party
          </button>
        )}
        {disambiguatedNames.map(m => (
          <button
            key={m.id}
            onClick={() => toggle(m.id)}
            style={{
              ...chipStyle,
              background: isSelected(m.id) ? 'var(--color-accent)' : 'var(--color-surface-raised)',
              color: isSelected(m.id) ? 'var(--color-on-accent, #fff)' : 'var(--color-text)',
            }}
          >
            {m.displayName}
          </button>
        ))}
      </div>
    </div>
  );
}
