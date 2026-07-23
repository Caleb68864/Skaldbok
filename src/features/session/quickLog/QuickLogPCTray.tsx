import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Zap, Dices, ChevronLeft } from 'lucide-react';
import { useCampaignContext } from '../../campaign/CampaignContext';
import { useToast } from '../../../context/ToastContext';
import { useAppState } from '../../../context/AppStateContext';
import { useSystemDefinition } from '../../systems/useSystemDefinition';
import { useSystemEngine } from '../../systems/engine';
import { DEFAULT_SYSTEM_ID } from '../../../systems/registry';
import { useSessionLog } from '../useSessionLog';
import { useSessionEncounterContextSafe } from '../SessionEncounterContext';
import { getById as getCharacterById } from '../../../storage/repositories/characterRepository';
import {
  AttachToControl,
  resolveAttach,
  type AttachToValue,
} from '../quickActions/AttachToControl';
import {
  formatOutcomeTitle,
  type OutcomeMods,
  type OutcomeResult,
} from '../actions/formatSkillCheckTitle';
import type { CharacterRecord } from '../../../types/character';
import { cn } from '../../../lib/utils';

type TrayStep =
  | { kind: 'tray' }
  | { kind: 'palette'; pcId: string }
  | {
      kind: 'outcome';
      pcId: string;
      subjectKind: 'skill' | 'spell' | 'ability';
      subject: string;
      summary?: string;
    }
  | { kind: 'skills'; pcId: string };

const RESULTS: OutcomeResult[] = ['success', 'failure', 'dragon', 'demon'];

export interface QuickLogPCTrayProps {
  onLogged: () => void;
  onClose: () => void;
}

/**
 * PC-first Quick Log flow. Three steps inside one drawer body:
 *   1. Pick a PC (tray).
 *   2. Pick what they did — skill check, a heroic ability, or a prepared /
 *      pinned spell.
 *   3. Pick the outcome (Success / Failure / Dragon / Demon) plus optional
 *      modifier chips (Boon / Bane / Pushed).
 *
 * Mounted as drawer content — callers provide the drawer shell. An `X` in
 * the drawer shell already covers step 3's cancel path; each step renders
 * its own back arrow.
 */
export function QuickLogPCTray({ onLogged, onClose }: QuickLogPCTrayProps) {
  const { activeCampaign, activeParty } = useCampaignContext();
  const { logToSession } = useSessionLog();
  const { showToast } = useToast();
  const { sessionState } = useAppState();
  const sessionEncounterCtx = useSessionEncounterContextSafe();
  const engine = useSystemEngine();

  const [step, setStep] = useState<TrayStep>({ kind: 'tray' });
  const [characters, setCharacters] = useState<Record<string, CharacterRecord>>({});
  const [mods, setMods] = useState<OutcomeMods>({ boon: false, bane: false, pushed: false });
  const [attachTo, setAttachTo] = useState<AttachToValue>('auto');
  const [saving, setSaving] = useState(false);

  // Resolve PCs from the active party.
  useEffect(() => {
    const members = activeParty?.members ?? [];
    const withLinks = members.filter(m => !m.deletedAt && m.linkedCharacterId);
    if (withLinks.length === 0) {
      setCharacters({});
      return;
    }
    let cancelled = false;
    Promise.all(withLinks.map(m => getCharacterById(m.linkedCharacterId!))).then(records => {
      if (cancelled) return;
      const map: Record<string, CharacterRecord> = {};
      for (let i = 0; i < withLinks.length; i += 1) {
        const char = records[i];
        if (char) map[withLinks[i].id] = char;
      }
      setCharacters(map);
    });
    return () => {
      cancelled = true;
    };
  }, [activeParty]);

  const pcList = useMemo(() => {
    const members = activeParty?.members ?? [];
    return members
      .filter(m => !m.deletedAt && m.linkedCharacterId && characters[m.id])
      .map(m => ({
        memberId: m.id,
        character: characters[m.id]!,
      }));
  }, [activeParty, characters]);

  const activePC = step.kind !== 'tray' ? characters[step.pcId] : undefined;

  // Mid-sentence forms of the system's vocabulary (headings use the term as
  // declared; running copy lowercases it).
  const abilityTerm = engine.terms.abilities.toLowerCase();
  const spellTerm = engine.terms.spells.toLowerCase();

  // Pre-select modifier chips from session-state boon/bane when stepping into
  // outcome. Spells/abilities default to neutral (no pre-selection).
  useEffect(() => {
    if (step.kind !== 'outcome') return;
    if (step.subjectKind === 'skill') {
      const global = sessionState.globalBoonBane;
      setMods({
        boon: global === 'boon',
        bane: global === 'bane',
        pushed: false,
      });
    } else {
      setMods({ boon: false, bane: false, pushed: false });
    }
  }, [step, sessionState.globalBoonBane]);

  async function logOutcome(result: OutcomeResult) {
    if (step.kind !== 'outcome' || !activePC || saving) return;
    setSaving(true);
    try {
      const actor = activePC.name;
      const subject = step.subject;
      const title = formatOutcomeTitle({ actor, subject, result, mods });
      const type =
        step.subjectKind === 'skill'
          ? 'skill-check'
          : step.subjectKind === 'spell'
            ? 'spell-cast'
            : 'ability-use';
      const typeData: Record<string, unknown> = {
        subject,
        actor,
        result,
        mods: { ...mods },
      };
      if (step.summary) typeData.summary = step.summary;
      const target = resolveAttach(attachTo);
      await logToSession(title, type, typeData, { targetEncounterId: target });

      let encounterTitle: string | null = null;
      if (attachTo === 'auto') {
        encounterTitle = sessionEncounterCtx?.activeEncounter?.title ?? null;
      } else if (typeof attachTo === 'string') {
        encounterTitle = 'encounter';
      }
      showToast(
        encounterTitle ? `Logged to ${encounterTitle}` : 'Logged to session',
        'success',
        2000,
      );
      onLogged();
      onClose();
    } catch (e) {
      console.error('QuickLogPCTray log failed', e);
      showToast('Could not log entry', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  if (!activeCampaign) {
    return (
      <p className="text-[var(--color-text-muted)] text-sm">No active campaign.</p>
    );
  }

  if (pcList.length === 0) {
    return (
      <p className="text-[var(--color-text-muted)] text-sm">
        No party members with linked characters yet. Add PCs to the active party first.
      </p>
    );
  }

  if (step.kind === 'tray') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide">
          Who did something?
        </p>
        <div className="flex flex-col gap-2">
          {pcList.map(({ memberId, character }) => {
            const abilityCount = character.heroicAbilities.length;
            const preparedCount = character.spells.filter(s => s.prepared).length;
            const showCounts =
              abilityCount > 0 || (engine.hasMagic && character.spells.length > 0);
            const counts = engine.hasMagic
              ? `${abilityCount} ${abilityTerm}, ${preparedCount} prepared ${spellTerm}`
              : `${abilityCount} ${abilityTerm}`;
            return (
              <button
                key={memberId}
                type="button"
                onClick={() => setStep({ kind: 'palette', pcId: memberId })}
                className="flex items-center gap-3 p-3 min-h-[56px] rounded-[var(--radius-md)] bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-left text-[var(--color-text)] cursor-pointer"
              >
                <span className="text-2xl">🧝</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base truncate">{character.name}</div>
                  <div className="text-xs text-[var(--color-text-muted)] truncate">
                    {character.metadata?.profession ?? engine.terms.roleFallback}
                    {showCounts ? ` · ${counts}` : ''}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (step.kind === 'palette' && activePC) {
    const preparedSpells = engine.hasMagic
      ? activePC.spells.filter(s => s.prepared || s.pinnedAsStamp)
      : [];
    const abilities = activePC.heroicAbilities;
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStep({ kind: 'tray' })}
            aria-label="Back"
            className="min-w-[40px] min-h-[40px] bg-transparent border-none text-[var(--color-text)] cursor-pointer flex items-center justify-center"
          >
            <ChevronLeft size={20} />
          </button>
          <p className="text-base font-semibold text-[var(--color-text)] flex-1">
            {activePC.name} — what did they do?
          </p>
        </div>

        {/* Skill check entry */}
        <button
          type="button"
          onClick={() => setStep({ kind: 'skills', pcId: step.pcId })}
          className="flex items-center gap-3 p-3 min-h-[48px] rounded-[var(--radius-md)] bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-left text-[var(--color-text)] cursor-pointer"
        >
          <Dices size={18} className="text-[var(--color-accent)]" />
          <span className="font-semibold">Skill check…</span>
        </button>

        {/* Heroic abilities */}
        {abilities.length > 0 && (
          <div>
            <div className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-1.5">
              {engine.terms.abilities}
            </div>
            <div className="flex flex-col gap-2">
              {abilities.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() =>
                    setStep({
                      kind: 'outcome',
                      pcId: step.pcId,
                      subjectKind: 'ability',
                      subject: a.name,
                      summary: a.summary,
                    })
                  }
                  className="flex items-center gap-3 p-2 min-h-[44px] rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-left text-[var(--color-text)] cursor-pointer"
                >
                  <Zap size={14} className="text-[#b08d57]" />
                  <span className="flex-1 text-sm">{a.name}</span>
                  {typeof a.wpCost === 'number' && a.wpCost > 0 && (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {a.wpCost} {engine.terms.magicResource}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Spells */}
        {engine.hasMagic && preparedSpells.length > 0 && (
          <div>
            <div className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-1.5">
              {engine.terms.spells}
            </div>
            <div className="flex flex-col gap-2">
              {preparedSpells.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    setStep({
                      kind: 'outcome',
                      pcId: step.pcId,
                      subjectKind: 'spell',
                      subject: s.name,
                      summary: s.summary,
                    })
                  }
                  className="flex items-center gap-3 p-2 min-h-[44px] rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-left text-[var(--color-text)] cursor-pointer"
                >
                  <Sparkles size={14} className="text-[#7a5cff]" />
                  <span className="flex-1 text-sm">{s.name}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {s.wpCost} {engine.terms.magicResource}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {abilities.length === 0 && preparedSpells.length === 0 && (
          <p className="text-[var(--color-text-muted)] text-sm">
            {engine.hasMagic ? (
              <>
                No {abilityTerm} or prepared {spellTerm} on this character. Use "Skill
                check…" above, or prepare {spellTerm} on the character sheet.
              </>
            ) : (
              <>
                No {abilityTerm} on this character. Use "Skill check…" above.
              </>
            )}
          </p>
        )}
      </div>
    );
  }

  if (step.kind === 'skills' && activePC) {
    return (
      <SkillsSubStep
        character={activePC}
        onBack={() => setStep({ kind: 'palette', pcId: step.pcId })}
        onPick={skillName =>
          setStep({
            kind: 'outcome',
            pcId: step.pcId,
            subjectKind: 'skill',
            subject: skillName,
          })
        }
      />
    );
  }

  if (step.kind === 'outcome' && activePC) {
    const subjectLabel =
      step.subjectKind === 'spell'
        ? 'Spell'
        : step.subjectKind === 'ability'
          ? 'Ability'
          : 'Skill';
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStep({ kind: 'palette', pcId: step.pcId })}
            aria-label="Back"
            className="min-w-[40px] min-h-[40px] bg-transparent border-none text-[var(--color-text)] cursor-pointer flex items-center justify-center"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide">
              {activePC.name} · {subjectLabel}
            </div>
            <div className="text-base font-semibold text-[var(--color-text)] truncate">
              {step.subject}
            </div>
          </div>
        </div>

        {step.summary && (
          <p className="text-[var(--color-text-muted)] text-sm italic">{step.summary}</p>
        )}

        <div>
          <div className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-2">
            Modifiers
          </div>
          <div className="flex gap-2 flex-wrap">
            {(
              [
                ['boon', 'Boon', '#27ae60'],
                ['bane', 'Bane', '#c0392b'],
                ['pushed', 'Pushed', '#8e44ad'],
              ] as const
            ).map(([key, label, color]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMods(m => ({ ...m, [key]: !m[key] }))}
                className={cn(
                  'min-h-11 px-3.5 rounded-full border-none cursor-pointer text-sm font-semibold shrink-0',
                  mods[key]
                    ? `bg-[${color}] text-white`
                    : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <AttachToControl value={attachTo} onChange={setAttachTo} />

        <div>
          <div className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-2">
            Result
          </div>
          <div className="grid grid-cols-2 gap-2">
            {RESULTS.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => logOutcome(r)}
                disabled={saving}
                className={cn(
                  'min-h-11 px-4 border-none rounded-lg cursor-pointer text-sm font-semibold disabled:opacity-60',
                  r === 'dragon'
                    ? 'bg-[var(--color-accent)] text-white'
                    : r === 'demon'
                      ? 'bg-[#c0392b] text-white'
                      : r === 'success'
                        ? 'bg-[#27ae60] text-white'
                        : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]',
                )}
              >
                {r === 'dragon' ? 'Dragon (1)' : r === 'demon' ? 'Demon (20)' : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── Skills sub-step ───────────────────────────────────────────────

function SkillsSubStep({
  character,
  onBack,
  onPick,
}: {
  character: CharacterRecord;
  onBack: () => void;
  onPick: (skillName: string) => void;
}) {
  const { system, isLoading, error } = useSystemDefinition(character.systemId ?? DEFAULT_SYSTEM_ID);
  // No cross-system fallback list: until the character's own system loads there
  // is no honest answer, so the list renders empty rather than another ruleset's
  // skills.
  const skillNames = useMemo(
    () => system?.skillCategories.flatMap(c => c.skills.map(s => s.name)) ?? [],
    [system],
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="min-w-[40px] min-h-[40px] bg-transparent border-none text-[var(--color-text)] cursor-pointer flex items-center justify-center"
        >
          <ChevronLeft size={20} />
        </button>
        <p className="text-base font-semibold text-[var(--color-text)] flex-1">
          {character.name} — which skill?
        </p>
      </div>
      {skillNames.length === 0 && (
        <p className="text-[var(--color-text-muted)] text-sm">
          {isLoading
            ? 'Loading skills…'
            : error
              ? `Could not load skills for this character's system (${error}).`
              : 'This system defines no skills.'}
        </p>
      )}
      <div className="flex flex-col">
        {skillNames.map(name => (
          <button
            key={name}
            type="button"
            onClick={() => onPick(name)}
            className="text-left py-3 min-h-11 bg-transparent border-0 border-b border-b-[var(--color-border)] text-[var(--color-text)] cursor-pointer text-base"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
