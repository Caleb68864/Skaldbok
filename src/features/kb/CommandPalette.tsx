/**
 * Full-screen search overlay for instant note/entity navigation.
 *
 * @remarks
 * Renders via React portal to avoid z-index conflicts with ShellLayout.
 * Auto-focuses the search input on open. Supports fuzzy search via MiniSearch,
 * tap to navigate, swipe-down dismiss, and quick actions.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useKBSearch } from './useKBSearch';
import type { KBNode } from '../../storage/db/client';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
}

/** Color map for type badges in search results. */
const TYPE_COLORS: Record<string, string> = {
  note: 'bg-blue-500/10 text-blue-500',
  character: 'bg-green-500/10 text-green-500',
  location: 'bg-amber-700/10 text-amber-700',
  item: 'bg-yellow-500/10 text-yellow-500',
  tag: 'bg-gray-500/10 text-gray-500',
  unresolved: 'bg-red-500/10 text-red-500',
};

export function CommandPalette({ isOpen, onClose, campaignId }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const results = useKBSearch(query, campaignId);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
    }
  }, [isOpen]);

  // Swipe-down dismissal
  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 80) onClose();
  };

  if (!isOpen) return null;

  const handleResultTap = (node: KBNode) => {
    navigate(`/kb/${node.id}`);
    onClose();
  };

  const quickActions = [
    {
      label: 'New note',
      action: () => {
        navigate('/note/new');
        onClose();
      },
    },
    {
      label: 'Graph view',
      action: () => {
        navigate('/kb?view=graph');
        onClose();
      },
    },
    {
      label: 'Export all',
      action: () => {
        // Export functionality is handled elsewhere — just close
        onClose();
      },
    },
  ];

  const content = (
    <div
      className="fixed inset-0 z-[500] flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Palette panel */}
      <div className="relative mt-auto md:mt-16 mx-auto w-full max-w-[480px] bg-[var(--color-surface)] rounded-t-xl md:rounded-xl shadow-2xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-2 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
        </div>

        {/* Search input */}
        <div className="px-4 pt-2 pb-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, characters, locations..."
            className="w-full px-3 py-2 min-h-[44px] bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
          />
        </div>

        {/* Results or quick actions */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {query.trim() === '' ? (
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-2">
                Quick actions
              </p>
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={action.action}
                  className="block w-full text-left px-3 py-2 min-h-[44px] text-sm text-[var(--color-text)] bg-transparent border-none cursor-pointer rounded hover:bg-[var(--color-surface-raised)]"
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="py-4 text-center text-sm text-[var(--color-text-muted)]">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <ul className="list-none m-0 p-0">
              {results.map((node) => (
                <li key={node.id}>
                  <button
                    onClick={() => handleResultTap(node)}
                    className="flex items-center justify-between w-full text-left px-3 py-2 min-h-[44px] text-sm bg-transparent border-none cursor-pointer rounded hover:bg-[var(--color-surface-raised)]"
                  >
                    <span className="text-[var(--color-text)] truncate">
                      {node.label}
                    </span>
                    <span
                      className={`flex-shrink-0 ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                        TYPE_COLORS[node.type] ?? TYPE_COLORS.note
                      }`}
                    >
                      {node.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
