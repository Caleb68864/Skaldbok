import { useState, useMemo } from 'react';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { useSystemDefinition } from '../../features/systems/useSystemDefinition';
import { useIsEditMode } from '../../utils/modeGuards';
import type { SkillDefinition } from '../../types/system';

interface PinnedSkillsProps {
  /** Override edit mode detection (optional; defaults to context-based detection). */
  isEditMode?: boolean;
}

export function PinnedSkillsPanel({ isEditMode: isEditModeProp }: PinnedSkillsProps = {}) {
  const { character, updateCharacter } = useActiveCharacter();
  const contextEditMode = useIsEditMode();
  const isEditMode = isEditModeProp ?? contextEditMode;
  const { system } = useSystemDefinition(character?.systemId ?? 'dragonbane');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [maxMessage, setMaxMessage] = useState(false);

  // Flat list of all system skill definitions
  const allSkills = useMemo<SkillDefinition[]>(() => {
    if (!system) return [];
    return system.skillCategories.flatMap(cat => cat.skills);
  }, [system]);

  // Map from skill ID → definition
  const skillDefMap = useMemo<Map<string, SkillDefinition>>(() => {
    const map = new Map<string, SkillDefinition>();
    for (const def of allSkills) {
      map.set(def.id, def);
    }
    return map;
  }, [allSkills]);

  if (!character) return null;

  const pinnedIds: string[] = character.uiState?.pinnedSkills ?? [];

  // Filter out IDs that no longer exist in the system (silently dropped)
  const validPinnedIds = pinnedIds.filter(id => skillDefMap.has(id));

  function persistPins(newPins: string[]) {
    if (!character) return;
    updateCharacter({
      uiState: { ...character.uiState, pinnedSkills: newPins },
    });
  }

  function handleTogglePin(skillId: string) {
    const isPinned = validPinnedIds.includes(skillId);
    if (isPinned) {
      // Remove
      persistPins(validPinnedIds.filter(id => id !== skillId));
      setMaxMessage(false);
    } else {
      // Add — enforce max 6
      if (validPinnedIds.length >= 6) {
        setMaxMessage(true);
        return;
      }
      setMaxMessage(false);
      persistPins([...validPinnedIds, skillId]);
    }
  }

  function handleOpenPicker() {
    setMaxMessage(false);
    setPickerOpen(true);
  }

  function handleClosePicker() {
    setPickerOpen(false);
    setMaxMessage(false);
  }

  // ── Pinned skills display ──────────────────────────────────────────────
  const pinnedSkillRows = validPinnedIds.map(id => {
    const def = skillDefMap.get(id)!;
    const charSkill = character.skills?.[id];
    const value = charSkill?.value ?? 0;
    const trained = charSkill?.trained ?? false;
    return { id, name: def.name, value, trained };
  });

  // ── Skill picker rows ─────────────────────────────────────────────────
  const atMax = validPinnedIds.length >= 6;

  return (
    <div className="pinned-skills-panel">
      <div className="pinned-skills-header">
        <span className="pinned-skills-title">Pinned Skills</span>
        {isEditMode && (
          <button
            className="pinned-skills-edit-btn"
            onClick={handleOpenPicker}
            aria-label="Edit pinned skills"
            type="button"
          >
            ＋ Edit Pins
          </button>
        )}
      </div>

      {/* Pinned skill list */}
      {pinnedSkillRows.length > 0 ? (
        <ul className="pinned-skill-list" role="list">
          {pinnedSkillRows.map(({ id, name, value, trained }) => (
            <li key={id} className="pinned-skill-item">
              <span className="pinned-skill-name">{name}</span>
              <span className="pinned-skill-value">{value}</span>
              <span
                className={`pinned-skill-trained ${trained ? 'is-trained' : 'is-untrained'}`}
                aria-label={trained ? 'Trained' : 'Untrained'}
                title={trained ? 'Trained' : 'Untrained'}
              >
                {trained ? '✓' : '○'}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        isEditMode && (
          <p className="pinned-skills-empty">
            Pin up to 6 skills for quick reference.
          </p>
        )
      )}

      {/* Skill picker modal */}
      {pickerOpen && (
        <div
          className="skill-picker-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Select pinned skills"
          onClick={e => {
            if (e.target === e.currentTarget) handleClosePicker();
          }}
        >
          <div className="skill-picker">
            <div className="skill-picker-header">
              <span className="skill-picker-title">Pin Skills</span>
              <button
                className="skill-picker-close"
                onClick={handleClosePicker}
                aria-label="Close skill picker"
                type="button"
              >
                ✕
              </button>
            </div>

            {maxMessage && (
              <p className="skill-picker-max-msg" role="alert">
                Maximum 6 pinned skills.
              </p>
            )}

            <ul className="skill-picker-list" role="list">
              {system?.skillCategories.map(cat => (
                <li key={cat.id} className="skill-picker-category">
                  <span className="skill-picker-category-name">{cat.name}</span>
                  <ul role="list">
                    {cat.skills.map(def => {
                      const isPinned = validPinnedIds.includes(def.id);
                      const isDisabled = !isPinned && atMax;
                      return (
                        <li key={def.id} className="skill-picker-row">
                          <label
                            className={`skill-picker-label ${isDisabled ? 'is-disabled' : ''}`}
                          >
                            <input
                              type="checkbox"
                              className="skill-picker-checkbox"
                              checked={isPinned}
                              disabled={isDisabled}
                              onChange={() => handleTogglePin(def.id)}
                              aria-label={`Pin ${def.name}`}
                            />
                            <span className="skill-picker-skill-name">{def.name}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>

            <div className="skill-picker-footer">
              <button
                className="skill-picker-done-btn"
                onClick={handleClosePicker}
                type="button"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
