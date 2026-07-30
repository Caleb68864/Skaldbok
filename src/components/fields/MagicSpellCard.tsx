import { cn } from '../../lib/utils';
import type { Spell } from '../../types/character';
import { formatCastingTime, formatRequirements, getSpellRank } from '../../utils/spells';
import { Button } from '../primitives/Button';
import { Card } from '../primitives/Card';

/**
 * Props for {@link MagicSpellCard}.
 *
 * @remarks
 * `isGrimoireView` shows the whole spellbook (prepare/unprepare); otherwise only
 * prepared spells are castable. `preparedCount`/`maxPrepared` gate the prepare
 * toggle, and `currentResource` gates casting so an unaffordable cast is disabled.
 */
export interface MagicSpellCardProps {
  spell: Spell;
  isTrick: boolean;
  isGrimoireView: boolean;
  preparedCount: number;
  maxPrepared: number;
  /** Current value of the pool casting is paid from. */
  currentResource: number;
  powerLevel: number;
  /**
   * The active system's magic economy — selectable levels and their cost.
   *
   * @remarks
   * Passed in rather than read from a hook so this stays a presentational
   * component. It replaces the hardcoded `powerLevel * 2`, trick-costs-1 and
   * `[1, 2, 3]` that made every system pay Dragonbane's prices.
   */
  magic: { powerLevels: number[]; costPerLevel: number; trickCost: number };
  /** The system's name for that pool, e.g. `WP`. Was the literal "WP". */
  resourceTerm: string;
  onPowerLevelChange: (lvl: number) => void;
  onTogglePrepare: () => void;
  onCast?: (spell: Spell, cost: number) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * Interactive play card for a spell or magic trick: prepare toggle, power-level
 * selector, and cast button.
 *
 * @remarks
 * Cost scales with `powerLevel` via `magic.costPerLevel`; a trick costs
 * `magic.trickCost`. Magic tricks render a simplified layout. This is the
 * the only spell card in the app: a static read-only variant existed alongside
 * it with no callers and a hardcoded "WP Cost:" label, and was deleted.
 */
export function MagicSpellCard({
  spell, isTrick, isGrimoireView, preparedCount, maxPrepared, currentResource, powerLevel,
  magic, resourceTerm, onPowerLevelChange, onTogglePrepare, onCast, onEdit, onDelete,
}: MagicSpellCardProps) {
  const atLimit = preparedCount >= maxPrepared;
  const isReaction = spell.castingTime === 'reaction';
  const castCost = isTrick ? magic.trickCost : powerLevel * magic.costPerLevel;
  const rank = getSpellRank(spell);
  const requirements = formatRequirements(spell.requirements);
  const castingTime = formatCastingTime(spell.castingTime);

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
              Rank: {rank} · {magic.trickCost} {resourceTerm} · Always available · Auto-succeed
            </p>
            <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">
              Range: {spell.range} · Duration: {spell.duration} · Casting Time: {castingTime}
            </p>
            {requirements && (
              <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">
                Prerequisite: {requirements}
              </p>
            )}
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
              {isReaction && <span className="text-[length:var(--font-size-xs,0.75rem)] text-[var(--color-warning)] font-semibold border border-[var(--color-warning)] rounded-full px-2 py-0.5">Must be prepared</span>}
            </h3>
            <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">
              Rank: {rank}
            </p>
            <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">
              Range: {spell.range} · Duration: {spell.duration} · Casting Time: {castingTime}
            </p>
            {requirements && (
              <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">
                Prerequisite: {requirements}
              </p>
            )}
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
        <div className="flex items-center gap-[var(--space-2)]" role="group" aria-label="Power level">
          {magic.powerLevels.map((lvl) => {
            const cost = lvl * magic.costPerLevel;
            const insufficient = currentResource < cost;
            const isActive = lvl === powerLevel;
            return (
              <button
                key={lvl}
                type="button"
                className={cn(
                  "w-9 h-9 rounded-full text-[length:var(--font-size-sm)] font-semibold border transition-colors",
                  isActive
                    ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-accent)]",
                  insufficient && !isActive && "opacity-40 cursor-not-allowed"
                )}
                onClick={() => onPowerLevelChange(lvl)}
                aria-label={`Power level ${lvl} — ${cost} ${resourceTerm}`}
                aria-pressed={isActive}
              >
                {lvl}
              </button>
            );
          })}
          <span className="text-[length:var(--font-size-sm)] text-[var(--color-text-muted)] font-semibold ml-[var(--space-1)]">{castCost} {resourceTerm}</span>
          {spell.powerScaling && spell.powerScaling[powerLevel - 1] && (
            <span className="text-[length:var(--font-size-sm)] text-[var(--color-accent-alt)] ml-[var(--space-2)]">
              — {spell.powerScaling[powerLevel - 1]}
            </span>
          )}
        </div>

        {/* Prepare / Unprepare row */}
        <div className="flex items-center gap-[var(--space-sm)] flex-wrap">
          {spell.prepared ? (
            <button
              type="button"
              className="px-3 py-1.5 rounded-[var(--radius-sm)] text-[length:var(--font-size-sm)] font-semibold border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] transition-colors"
              onClick={onTogglePrepare}
            >
              Unprepare
            </button>
          ) : atLimit ? (
            <>
              <button
                type="button"
                className="px-3 py-1.5 rounded-[var(--radius-sm)] text-[length:var(--font-size-sm)] font-semibold border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] opacity-40 cursor-not-allowed"
                disabled
              >
                Prepare
              </button>
              <span className="text-[length:var(--font-size-xs,0.75rem)] text-[var(--color-text-muted)]">
                {preparedCount}/{maxPrepared} prepared. Unprepare a spell first.
              </span>
            </>
          ) : (
            <button
              type="button"
              className="px-3 py-1.5 rounded-[var(--radius-sm)] text-[length:var(--font-size-sm)] font-semibold border border-[var(--color-accent)] bg-[var(--color-accent)] text-white hover:opacity-90 transition-colors"
              onClick={onTogglePrepare}
            >
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
              className={cn(
                "px-3 py-1.5 rounded-[var(--radius-sm)] text-[length:var(--font-size-sm)] font-semibold border ml-auto transition-colors",
                currentResource < castCost
                  ? "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] opacity-40 cursor-not-allowed"
                  : "border-[var(--color-accent)] bg-[var(--color-accent)] text-white hover:opacity-90"
              )}
              disabled={currentResource < castCost}
              onClick={() => onCast(spell, castCost)}
            >
              Cast ({castCost} {resourceTerm})
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
