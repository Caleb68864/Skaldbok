/**
 * Scannable card for a KB node in the Vault Browser.
 *
 * Displays: title, type badge, tag chips, link count, and updated timestamp.
 */

import type { KBNode } from '../../storage/db/client';

/** Color map for type badges. */
const TYPE_COLORS: Record<string, string> = {
  note: 'bg-blue-500/10 text-blue-500',
  character: 'bg-green-500/10 text-green-500',
  location: 'bg-amber-700/10 text-amber-700',
  item: 'bg-yellow-500/10 text-yellow-500',
  tag: 'bg-gray-500/10 text-gray-500',
  unresolved: 'bg-red-500/10 text-red-500',
};

interface VaultCardProps {
  node: KBNode;
  linkCount: number;
  tags?: string[];
  onClick: () => void;
}

/**
 * Formats an ISO timestamp as a relative time string.
 */
function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return '';
  }
}

export function VaultCard({ node, linkCount, tags, onClick }: VaultCardProps) {
  const typeColor = TYPE_COLORS[node.type] ?? TYPE_COLORS.note;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg cursor-pointer hover:bg-[var(--color-surface-raised)] transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-text)] truncate">
            {node.label}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${typeColor}`}
            >
              {node.type}
            </span>
            {linkCount > 0 && (
              <span className="text-xs text-[var(--color-text-muted)]">
                {linkCount} link{linkCount !== 1 ? 's' : ''}
              </span>
            )}
            <span className="text-xs text-[var(--color-text-muted)]">
              {formatRelativeTime(node.updatedAt)}
            </span>
          </div>
        </div>
      </div>
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-block px-1.5 py-0.5 rounded text-xs bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
