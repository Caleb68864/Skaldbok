import { useState, useMemo, useEffect } from 'react';
import { Modal } from '../primitives/Modal';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { useSystemDefinition } from '../../features/systems/useSystemDefinition';
import * as characterRepository from '../../storage/repositories/characterRepository';
import { nowISO } from '../../utils/dates';
import type { CharacterSkill } from '../../types/character';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SESSION_EVENTS = [
  { id: 'combat', label: '⚔️ Participated in combat' },
  { id: 'explore', label: '🗺️ Explored a new location' },
  { id: 'weakness', label: '💔 Role-played a weakness' },
  { id: 'heroic', label: '✨ Used a heroic ability' },
] as const;

interface RollResult {
  skillId: string;
  skillName: string;
  advanced: boolean;
  skipped: boolean;
  newValue: number;
}

const MAX_SKILL_VALUE = 18;

const btnStyle: React.CSSProperties = {
  minHeight: '44px',
  minWidth: '44px',
  padding: '0 var(--space-md)',
  borderRadius: 'var(--radius-sm)',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--size-md)',
  fontWeight: 'var(--weight-semibold)',
};

export function EndOfSessionModal({ open, onClose }: Props) {
  const { character, updateCharacter } = useActiveCharacter();
  const { system } = useSystemDefinition(character?.systemId ?? 'dragonbane');

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [bonusAssignments, setBonusAssignments] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [rollQueue, setRollQueue] = useState<string[]>([]);
  const [rollIndex, setRollIndex] = useState(0);
  const [results, setResults] = useState<RollResult[]>([]);
  const [skills, setSkills] = useState<Record<string, CharacterSkill>>({});

  // Reset when modal opens
  useEffect(() => {
    if (open && character) {
      setStep(1);
      setChecks({});
      setBonusAssignments([]);
      setShowAll(false);
      setRollQueue([]);
      setRollIndex(0);
      setResults([]);
      setSkills({ ...character.skills });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const allSkillDefs = useMemo(() => {
    if (!system) return [];
    return system.skillCategories.flatMap(cat => cat.skills);
  }, [system]);

  const markedIds = useMemo(
    () => Object.entries(skills).filter(([, cs]) => cs?.dragonMarked).map(([id]) => id),
    [skills],
  );

  const checkedCount = Object.values(checks).filter(Boolean).length;
  const hasAnythingToAdvance = markedIds.length > 0 || checkedCount > 0;

  const trainedSkillDefs = useMemo(
    () => allSkillDefs.filter(s => skills[s.id]?.trained),
    [allSkillDefs, skills],
  );
  const untrainedSkillDefs = useMemo(
    () => allSkillDefs.filter(s => !skills[s.id]?.trained),
    [allSkillDefs, skills],
  );

  function buildRollQueue(currentSkills: Record<string, CharacterSkill>, bonuses: string[]) {
    const unique = Array.from(new Set([...markedIds, ...bonuses.filter(Boolean)]));
    const queue: string[] = [];
    const autoResults: RollResult[] = [];
    for (const id of unique) {
      const cs = currentSkills[id];
      const def = allSkillDefs.find(s => s.id === id);
      if (cs && cs.value >= MAX_SKILL_VALUE) {
        autoResults.push({ skillId: id, skillName: def?.name ?? id, advanced: false, skipped: true, newValue: cs.value });
      } else {
        queue.push(id);
      }
    }
    return { queue, autoResults };
  }

  function handleStep1Next() {
    if (!hasAnythingToAdvance) { onClose(); return; }
    if (checkedCount > 0) {
      setBonusAssignments(Array(checkedCount).fill(''));
      setStep(2);
    } else {
      const { queue, autoResults } = buildRollQueue(skills, []);
      setResults(autoResults);
      if (queue.length === 0) {
        setStep(4);
      } else {
        setRollQueue(queue);
        setRollIndex(0);
        setStep(3);
      }
    }
  }

  function handleStep2Next() {
    const { queue, autoResults } = buildRollQueue(skills, bonusAssignments);
    setResults(autoResults);
    if (queue.length === 0) {
      setStep(4);
    } else {
      setRollQueue(queue);
      setRollIndex(0);
      setStep(3);
    }
  }

  function advanceRoll(newResult: RollResult) {
    const newResults = [...results, newResult];
    setResults(newResults);
    const next = rollIndex + 1;
    if (next >= rollQueue.length) {
      setStep(4);
    } else {
      setRollIndex(next);
    }
  }

  function handlePass() {
    if (!character) return;
    const skillId = rollQueue[rollIndex];
    const def = allSkillDefs.find(s => s.id === skillId);
    const cs = skills[skillId] ?? { value: 0, trained: false };
    const newValue = Math.min(cs.value + 1, MAX_SKILL_VALUE);
    const updatedSkill = { ...cs, value: newValue, dragonMarked: false };
    const updatedSkills = { ...skills, [skillId]: updatedSkill };
    setSkills(updatedSkills);
    updateCharacter({ skills: updatedSkills, updatedAt: nowISO() });
    // Persist immediately to IndexedDB
    characterRepository.save({ ...character, skills: updatedSkills, updatedAt: nowISO() }).catch(console.error);
    advanceRoll({ skillId, skillName: def?.name ?? skillId, advanced: true, skipped: false, newValue });
  }

  function handleFail() {
    if (!character) return;
    const skillId = rollQueue[rollIndex];
    const def = allSkillDefs.find(s => s.id === skillId);
    const cs = skills[skillId] ?? { value: 0, trained: false };
    const updatedSkill = { ...cs, dragonMarked: false };
    const updatedSkills = { ...skills, [skillId]: updatedSkill };
    setSkills(updatedSkills);
    updateCharacter({ skills: updatedSkills, updatedAt: nowISO() });
    advanceRoll({ skillId, skillName: def?.name ?? skillId, advanced: false, skipped: false, newValue: cs.value });
  }

  function handleDone() {
    if (!character) { onClose(); return; }
    const cleared = Object.fromEntries(
      Object.entries(skills).map(([id, cs]) => [id, { ...cs, dragonMarked: false }])
    );
    const updatedChar = { ...character, skills: cleared, advancementChecks: {}, updatedAt: nowISO() };
    updateCharacter({ skills: cleared, advancementChecks: {}, updatedAt: nowISO() });
    characterRepository.save(updatedChar).catch(console.error);
    onClose();
  }

  if (!character) {
    return (
      <Modal open={open} onClose={onClose} title="End of Session"
        actions={<button style={btnStyle} onClick={onClose}>Close</button>}>
        <p style={{ color: 'var(--color-text-muted)' }}>No active character loaded.</p>
      </Modal>
    );
  }

  // Step 1 — Session Checklist
  const step1 = (
    <div className="eos-step">
      <p className="eos-step__desc">Check each event that occurred this session. Each gives one bonus advancement roll.</p>
      {SESSION_EVENTS.map(evt => (
        <label key={evt.id} className="eos-check-row">
          <input
            type="checkbox"
            className="eos-checkbox"
            checked={checks[evt.id] ?? false}
            onChange={() => setChecks(prev => ({ ...prev, [evt.id]: !prev[evt.id] }))}
          />
          <span className="eos-check-label">{evt.label}</span>
        </label>
      ))}
      {markedIds.length > 0 && (
        <p className="eos-hint">
          🐉 {markedIds.length} dragon-marked skill{markedIds.length !== 1 ? 's' : ''} will be rolled.
        </p>
      )}
      {!hasAnythingToAdvance && (
        <p className="eos-empty">Nothing to advance this session.</p>
      )}
    </div>
  );

  // Step 2 — Assign Bonus Rolls
  const step2 = (
    <div className="eos-step">
      <p className="eos-step__desc">Assign each bonus roll to a skill. Trained skills appear first.</p>
      <label className="eos-check-row">
        <input
          type="checkbox"
          className="eos-checkbox"
          checked={showAll}
          onChange={() => setShowAll(v => !v)}
        />
        <span className="eos-check-label">Show all skills</span>
      </label>
      {bonusAssignments.map((assigned, idx) => (
        <div key={idx} className="eos-bonus-row">
          <span className="eos-bonus-label">Roll {idx + 1}:</span>
          <select
            className="eos-skill-select"
            value={assigned}
            onChange={e => {
              const next = [...bonusAssignments];
              next[idx] = e.target.value;
              setBonusAssignments(next);
            }}
          >
            <option value="">— pick a skill —</option>
            {trainedSkillDefs.length > 0 && (
              <optgroup label="Trained Skills">
                {trainedSkillDefs.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </optgroup>
            )}
            {showAll && untrainedSkillDefs.length > 0 && (
              <optgroup label="Other Skills">
                {untrainedSkillDefs.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      ))}
    </div>
  );

  // Step 3 — Roll Through
  const currentSkillId = rollQueue[rollIndex];
  const currentDef = allSkillDefs.find(s => s.id === currentSkillId);
  const currentCs = currentSkillId ? (skills[currentSkillId] ?? { value: 0, trained: false }) : null;
  const step3 = currentCs ? (
    <div className="eos-step eos-roll-card">
      <div className="eos-roll-progress">{rollIndex + 1} / {rollQueue.length}</div>
      <h3 className="eos-roll-skill">{currentDef?.name ?? currentSkillId}</h3>
      <div className="eos-roll-value">Current value: <strong>{currentCs.value}</strong></div>
      <div className="eos-roll-target">
        Roll above <strong>{currentCs.value}</strong> on a d20 to advance
      </div>
      <div className="eos-roll-btns">
        <button
          style={{ ...btnStyle, backgroundColor: 'var(--color-success)', color: '#fff', flex: 1 }}
          onClick={handlePass}
        >
          ✅ Pass
        </button>
        <button
          style={{ ...btnStyle, backgroundColor: 'var(--color-danger)', color: '#fff', flex: 1 }}
          onClick={handleFail}
        >
          ❌ Fail
        </button>
      </div>
    </div>
  ) : null;

  // Step 4 — Summary
  const step4 = (
    <div className="eos-step">
      <p className="eos-step__desc">Session advancement complete!</p>
      {results.length === 0 ? (
        <p className="eos-empty">No skills were rolled this session.</p>
      ) : (
        <ul className="eos-summary-list">
          {results.map((r, i) => (
            <li key={i} className="eos-summary-row">
              <span className="eos-summary-skill">{r.skillName}</span>
              {r.skipped ? (
                <span className="eos-summary-status eos-summary-status--skip">Already at maximum</span>
              ) : r.advanced ? (
                <span className="eos-summary-status eos-summary-status--pass">+1 → {r.newValue}</span>
              ) : (
                <span className="eos-summary-status eos-summary-status--fail">No advance</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const stepTitles: Record<number, string> = {
    1: 'Session Checklist',
    2: 'Assign Bonus Rolls',
    3: 'Roll Through',
    4: 'Summary',
  };

  const stepContent = step === 1 ? step1 : step === 2 ? step2 : step === 3 ? step3 : step4;

  const step1Actions = hasAnythingToAdvance
    ? <button style={{ ...btnStyle, backgroundColor: 'var(--color-accent)', color: '#fff' }} onClick={handleStep1Next}>Next →</button>
    : <button style={{ ...btnStyle, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} onClick={onClose}>Close</button>;

  const stepActions =
    step === 1 ? step1Actions :
    step === 2 ? <button style={{ ...btnStyle, backgroundColor: 'var(--color-accent)', color: '#fff' }} onClick={handleStep2Next}>Next →</button> :
    step === 3 ? null :
    <button style={{ ...btnStyle, backgroundColor: 'var(--color-accent)', color: '#fff' }} onClick={handleDone}>Done</button>;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${stepTitles[step]} (${step}/4)`}
      actions={stepActions ?? undefined}
    >
      {stepContent}
    </Modal>
  );
}
