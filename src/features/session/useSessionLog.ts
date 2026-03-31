import { useCallback } from 'react';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useNoteActions } from '../notes/useNoteActions';

/**
 * Hook for logging events to the active session from anywhere in the app.
 * Returns null-safe functions — calling them when no session is active is a no-op.
 */
export function useSessionLog() {
  const { activeSession } = useCampaignContext();
  const { createNote } = useNoteActions();

  const logToSession = useCallback(async (
    title: string,
    type: 'skill-check' | 'generic' = 'generic',
    typeData: Record<string, unknown> = {},
  ) => {
    if (!activeSession) return;
    await createNote({
      title,
      type,
      body: null,
      pinned: false,
      status: 'active',
      typeData,
    });
  }, [activeSession, createNote]);

  const logSkillCheck = useCallback(async (
    characterName: string,
    skillName: string,
    result: 'success' | 'failure' | 'dragon' | 'demon',
    modifiers?: { boon?: boolean; bane?: boolean; pushed?: boolean },
  ) => {
    const tags: string[] = [];
    if (modifiers?.boon) tags.push('Boon');
    if (modifiers?.bane) tags.push('Bane');
    if (modifiers?.pushed) tags.push('Pushed');
    const modStr = tags.length > 0 ? ` (${tags.join(', ')})` : '';
    await logToSession(
      `${characterName}: ${skillName}${modStr} — ${result}`,
      'skill-check',
      { skill: skillName, result, character: characterName },
    );
  }, [logToSession]);

  const logSpellCast = useCallback(async (
    characterName: string,
    spellName: string,
    result: 'success' | 'failure' | 'dragon' | 'demon',
  ) => {
    await logToSession(`${characterName}: Cast ${spellName} — ${result}`);
  }, [logToSession]);

  const logAbilityUse = useCallback(async (
    characterName: string,
    abilityName: string,
  ) => {
    await logToSession(`${characterName}: Used ${abilityName}`);
  }, [logToSession]);

  const logHPChange = useCallback(async (
    characterName: string,
    oldHP: number,
    newHP: number,
    maxHP: number,
  ) => {
    if (!activeSession) return;
    const diff = newHP - oldHP;
    if (diff === 0) return;
    const label = diff > 0
      ? `${characterName}: Healed ${diff} HP (${newHP}/${maxHP})`
      : `${characterName}: Took ${Math.abs(diff)} damage (${newHP}/${maxHP})`;
    await logToSession(label);
  }, [activeSession, logToSession]);

  const logDeathRoll = useCallback(async (
    characterName: string,
    rollNumber: number,
    survived: boolean,
  ) => {
    const result = survived ? 'Survived' : 'Failed';
    await logToSession(`${characterName}: Death Roll #${rollNumber} — ${result}`);
  }, [logToSession]);

  return {
    hasActiveSession: !!activeSession,
    logToSession,
    logSkillCheck,
    logSpellCast,
    logAbilityUse,
    logHPChange,
    logDeathRoll,
  };
}
