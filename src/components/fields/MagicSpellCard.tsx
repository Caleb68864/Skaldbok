import { cn } from '../../lib/utils';
import type { Spell } from '../../types/character';
import { Button } from '../primitives/Button';
import { Card } from '../primitives/Card';

interface MagicSpellCardProps {
  spell: Spell;
  isTrick: boolean;
  isGrimoireView: boolean;
  preparedCount: number;
  maxPrepared: number;
  currentWP: number;
  powerLevel: number;
  onPowerLevelChange: (lvl: number) => void;
  onTogglePrepare: () => void;
  onCast?: (spell: Spell, wpCost: number) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MagicSpellCard({
  spell, isTrick, isGrimoireView, preparedCount, maxPrepared, currentWP, powerLevel,
  onPowerLevelChange, onTogglePrepare, onCast, onEdit, onDelete,
}: MagicSpellCardProps) {
  const atLimit = preparedCount >= maxPrepared;
  const isReaction = spell.castingTime === 'reaction';
  const wpCost = isTrick ? 1 : powerLevel * 2;

  const editButtons = (onEdit || onDelete) ? (
    <div className="flex gap-3 shrink-0">
      {onEdit && <Button size="sm" onClick={onEdit}>Edit</Button>}
      {onDelete && <Button size="sm" variant="danger" onClick={onDelete}>Delete</Button>}
    </div>
  ) : null;

  // ── Magic Trick card ─────────────────────────────────────────────
  if (isTrick) {
    return (
      <Card>
        <div className="flex justify-between items-start gap-[var(--space-sm)] flex-wrap">
          <div className="flex-1">
            <h3 className="text-[var(--color-text)] text-[length:var(--font-size-md)] mb-[var(--space-xs)]">
              {spell.name}
              <span className="text-[var(--color-accent)] text-[length:var(--font-size-sm)] ml-[var(--space-sm)]">{spell.school}</span>
            </h3>
            <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">
              1 WP · Always available · Auto-succeed
            </p>
            {spell.summary && (
              <p className="text-[var(--color-text)] text-[length:var(--font-size-sm)]">{spell.summary}</p>
            )}
          </div>
          {editButtons}
        </div>
      </Card>
    );
  }

  // ── Regular spell card ───────────────────────────────────────────
  const notCastable = isGrimoireView && isReaction && !spell.prepared;

  return (
    <Card>
      <div className="flex flex-col gap-[var(--space-sm)]">
        {/* Header row */}
        <div className="flex justify-between items-start gap-[var(--space-sm)] flex-wrap">
          <div className="flex-1">
            <h3 className="text-[var(--color-text)] text-[length:var(--font-size-md)] mb-[var(--space-xs)] flex items-center gap-[var(--space-xs)] flex-wrap">
              {spell.name}
              <span className="text-[var(--color-accent)] text-[length:var(--font-size-sm)]">{spell.school}</span>
              {isReaction && <span className="reaction-badge">Must be prepared</span>}
            </h3>
            <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">
              Range: {spell.range} · Duration: {spell.duration}
            </p>
            {spell.summary && (
              <p className={cn(
                "text-[length:var(--font-size-sm)]",
                notCastable ? "text-[var(--color-text-muted)] opacity-60" : "text-[var(--color-text)] opacity-100"
              )}>
                {spell.summary}
              </p>
            )}
          </div>
          {editButtons}
        </div>

        {/* Power level selector */}
        <div className="power-level-selector" role="group" aria-label="Power level">
          {([1, 2, 3] as const).map((lvl) => {
            const cost = lvl * 2;
            const insufficient = currentWP < cost;
            const isActive = lvl === powerLevel;
            return (
              <button
                key={lvl}
                type="button"
                className={[
                  'power-level-btn',
                  isActive ? 'power-level-btn--active' : '',
                  insufficient ? 'power-level-disabled' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => onPowerLevelChange(lvl)}
                aria-label={`Power level ${lvl} — ${cost} WP`}
                aria-pressed={isActive}
              >
                {lvl}
              </button>
            );
          })}
          <span className="power-level-cost">{wpCost} WP</span>
        </div>

        {/* Prepare / Unprepare row */}
        <div className="flex items-center gap-[var(--space-sm)] flex-wrap">
          {spell.prepared ? (
            <button type="button" className="prepare-button prepare-button--unprepare" onClick={onTogglePrepare}>
              Unprepare
            </button>
          ) : atLimit ? (
            <>
              <button type="button" className="prepare-button prepare-button--disabled" disabled>
                Prepare
              </button>
              <span className="text-[length:var(--font-size-xs,0.75rem)] text-[var(--color-text-muted)]">
                {preparedCount}/{maxPrepared} prepared. Unprepare a spell first.
              </span>
            </>
          ) : (
            <button type="button" className="prepare-button prepare-button--prepare" onClick={onTogglePrepare}>
              Prepare
            </button>
          )}
          {notCastable && (
            <span className="text-[length:var(--font-size-xs,0.75rem)] text-[var(--color-danger,#c0392b)] font-semibold">
              Cannot cast — must be prepared first
            </span>
          )}
          {onCast && !notCastable && (
            <button
              type="button"
              className="prepare-button prepare-button--prepare ml-auto"
              disabled={currentWP < wpCost}
              onClick={() => onCast(spell, wpCost)}
            >
              Cast ({wpCost} WP)
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
