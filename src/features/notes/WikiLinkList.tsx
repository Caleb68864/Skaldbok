/**
 * Autocomplete dropdown for wikilink suggestion results.
 *
 * @remarks
 * Used by the Tiptap suggestion plugin when `[[` is typed.
 * Supports keyboard navigation (ArrowUp/ArrowDown/Enter) and click selection.
 */

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

interface WikiLinkListProps {
  items: Array<{ id: string; label: string }>;
  command: (item: { id: string; label: string }) => void;
}

/**
 * Dropdown list component for wikilink autocomplete suggestions.
 */
export const WikiLinkList = forwardRef<unknown, WikiLinkListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          if (items[selectedIndex]) command(items[selectedIndex]);
          return true;
        }
        return false;
      },
    }));

    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded shadow-lg max-h-[200px] overflow-y-auto min-w-[180px]">
        {items.length === 0 ? (
          <div className="px-3 py-2 text-sm text-[var(--color-text-muted)]">
            No notes found
          </div>
        ) : (
          items.map((item, i) => (
            <button
              key={item.id}
              className={`block w-full text-left px-3 py-2 min-h-[44px] text-sm cursor-pointer border-none ${
                i === selectedIndex
                  ? 'bg-[var(--color-surface-raised)]'
                  : 'bg-transparent'
              } text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]`}
              onClick={() => command(item)}
            >
              {item.label}
            </button>
          ))
        )}
      </div>
    );
  }
);
WikiLinkList.displayName = 'WikiLinkList';
