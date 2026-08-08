import { cn } from '../../lib/utils';
import { SectionPanel } from '../primitives/SectionPanel';
import { GameIcon } from '../primitives/GameIcon';
import type { AdvancementCandidate } from '../../features/characters/advancement';
import type { AdvancementModel } from '../../features/systems/engine/types';

export interface AdvancementPanelProps {
  advancement: AdvancementModel;
  /** Ticked state of each session event, keyed by event id. */
  checks: Record<string, boolean>;
  /** Marked skills to roll for. Empty when the system does not use marks. */
  candidates: AdvancementCandidate[];
  onToggleEvent: (eventId: string) => void;
  /** The roll beat the skill: raise it and clear the mark. */
  onAdvance: (skillId: string) => void;
  /** The roll failed: clear the mark, value unchanged. */
  onDecline: (skillId: string) => void;
  onResetChecklist: () => void;
  /**
   * Whether the session checklist may be ticked. Stays true in play mode: it
   * records what happened this session rather than changing the character.
   */
  checklistEditable: boolean;
  /**
   * Whether an advancement may be applied. False in play mode — raising a skill
   * is a build change, and a stray tap mid-session must not make one.
   */
  rollsEditable: boolean;
}

/**
 * End-of-session advancement: the session checklist, and a roll row per marked
 * skill.
 *
 * @remarks
 * The app does not roll dice — it tells you what to roll (`rollPrompt`, authored
 * by the system) and records what happened. So each marked skill offers two
 * outcomes rather than a button that rolls: the player rolls a real d20 and taps
 * the result. That matches every other probability surface here, which shows
 * odds and never resolves them.
 *
 * The checklist is a *tally*, not a marking UI. Each ticked box earns the right
 * to mark one skill, and marking already lives on the Skills screen where the
 * skills are; duplicating it here would give two places to do the same thing and
 * two chances to disagree about the count.
 */
export function AdvancementPanel({
  advancement,
  checks,
  candidates,
  onToggleEvent,
  onAdvance,
  onDecline,
  onResetChecklist,
  checklistEditable,
  rollsEditable,
}: AdvancementPanelProps) {
  const earned = advancement.sessionEvents.filter(e => checks[e.id]).length;

  return (
    <SectionPanel
      title="Advancement"
      icon={<GameIcon name="star" size={18} />}
      collapsible
      defaultOpen={candidates.length > 0}
    >
      <div className="flex flex-col gap-[var(--space-md)]">
        {advancement.sessionEvents.length > 0 && (
          <div>
            <p className="m-0 mb-[var(--space-xs)] text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
              At the end of the session — each box you tick earns one skill mark.
            </p>
            <div className="flex flex-col">
              {advancement.sessionEvents.map(event => (
                <label
                  key={event.id}
                  className={cn(
                    'flex items-center gap-[var(--space-sm)] min-h-[var(--touch-target-min)]',
                    checklistEditable ? 'cursor-pointer' : 'cursor-default opacity-70',
                  )}
                >
                  <input
                    type="checkbox"
                    className="w-5 h-5 shrink-0"
                    checked={checks[event.id] === true}
                    disabled={!checklistEditable}
                    onChange={() => onToggleEvent(event.id)}
                  />
                  <span className="text-[var(--color-text)] text-[length:var(--font-size-md)]">{event.label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 mt-[var(--space-xs)]">
              <span className="text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
                {earned === 0
                  ? 'No marks earned yet'
                  : `${earned} mark${earned === 1 ? '' : 's'} earned — mark ${earned === 1 ? 'a skill' : 'skills'} on the Skills screen`}
              </span>
              {checklistEditable && earned > 0 && (
                <button
                  type="button"
                  onClick={onResetChecklist}
                  className="shrink-0 min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] text-xs font-semibold cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {advancement.usesMarks && (
          <div>
            <p className="m-0 mb-[var(--space-xs)] text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
              {candidates.length === 0
                ? 'No marked skills. Mark a skill on the Skills screen when you roll a dragon or a demon.'
                : `${candidates.length} marked skill${candidates.length === 1 ? '' : 's'} to roll for.`}
            </p>
            <div className="flex flex-col">
              {candidates.map(candidate => (
                <div
                  key={candidate.id}
                  className="flex flex-wrap items-center gap-[var(--space-sm)] py-[var(--space-xs)] border-b border-[var(--color-border)] min-h-[var(--touch-target-min)]"
                >
                  <span className="flex-1 min-w-0 text-[var(--color-text)] text-[length:var(--font-size-md)] font-semibold">
                    {candidate.name}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                    {candidate.atCeiling ? 'Already at maximum' : candidate.prompt}
                  </span>
                  {rollsEditable && (
                    <div className="flex gap-[var(--space-xs)] shrink-0">
                      <button
                        type="button"
                        onClick={() => onAdvance(candidate.id)}
                        disabled={candidate.atCeiling}
                        title={candidate.atCeiling
                          ? `${candidate.name} is already at the maximum`
                          : `${candidate.name} advances to ${candidate.value + 1}`}
                        className={cn(
                          'min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border-none text-xs font-semibold',
                          candidate.atCeiling
                            ? 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] opacity-50 cursor-default'
                            : 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] cursor-pointer',
                        )}
                      >
                        Advanced
                      </button>
                      <button
                        type="button"
                        onClick={() => onDecline(candidate.id)}
                        title={`Clear the mark on ${candidate.name} without advancing`}
                        className="min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent text-[var(--color-text)] text-xs font-semibold cursor-pointer"
                      >
                        No change
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionPanel>
  );
}
