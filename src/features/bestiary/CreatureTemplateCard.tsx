import type { CreatureTemplate } from '../../types/creatureTemplate';
import { cn } from '../../lib/utils';

interface CreatureTemplateCardProps {
  template: CreatureTemplate;
  onClick: () => void;
}

const categoryColors: Record<string, string> = {
  monster: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  npc: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  animal: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

/**
 * Compact card displaying a creature template's summary for the bestiary list.
 * Tapping opens the full stat block view.
 */
export function CreatureTemplateCard({ template, onClick }: CreatureTemplateCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-3 cursor-pointer hover:border-[var(--color-accent)] transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-[var(--color-text)] font-semibold text-sm truncate">
          {template.name}
        </span>
        <span
          className={cn(
            'shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
            categoryColors[template.category] ?? 'bg-gray-100 text-gray-700'
          )}
        >
          {template.category}
        </span>
      </div>
      <div className="text-[var(--color-text-muted)] text-xs mb-1.5">
        HP {template.stats.hp} &middot; Armor {template.stats.armor} &middot; Mv {template.stats.movement}
      </div>
      {template.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {template.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 bg-[var(--color-surface)] rounded text-[10px] text-[var(--color-text-muted)]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
