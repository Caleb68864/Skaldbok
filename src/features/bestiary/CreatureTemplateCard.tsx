import type { CreatureTemplate } from '../../types/creatureTemplate';
import type { CreatureStatField } from '../../types/system';
import { summariseCreatureStats } from './creatureStats';
import { cn } from '../../lib/utils';

export interface CreatureTemplateCardProps {
  template: CreatureTemplate;
  /**
   * The active ruleset's declared creature stats. Supplied by the caller —
   * this card named Dragonbane's three by hand, so a Traveller animal listed
   * as "HP / Armor / Mv" whatever its stat block actually was.
   */
  statFields: CreatureStatField[];
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
export function CreatureTemplateCard({ template, statFields, onClick }: CreatureTemplateCardProps) {
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
        {summariseCreatureStats(template, statFields)}
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
