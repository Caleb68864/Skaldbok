import { useCallback, useRef, useEffect } from 'react';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useNoteActions } from '../notes/useNoteActions';

/**
 * Hook for logging events to the active session from anywhere in the app.
 * Returns null-safe functions — calling them when no session is active is a no-op.
 */
interface CoinBuffer {
  character: string;
  changes: Record<string, number>;
  timer: ReturnType<typeof setTimeout> | null;
}

interface ResourceBuffer {
  character: string;
  resource: string;
  startValue: number;
  currentValue: number;
  maxValue: number;
  timer: ReturnType<typeof setTimeout> | null;
}

export function useSessionLog() {
  const { activeSession } = useCampaignContext();
  const { createNote } = useNoteActions();
  const coinBuffer = useRef<CoinBuffer>({ character: '', changes: {}, timer: null });
  const resourceBuffer = useRef<ResourceBuffer>({ character: '', resource: '', startValue: 0, currentValue: 0, maxValue: 0, timer: null });

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

  const flushResourceBuffer = useCallback(async () => {
    const buf = resourceBuffer.current;
    if (!buf.character || buf.startValue === buf.currentValue) {
      resourceBuffer.current = { character: '', resource: '', startValue: 0, currentValue: 0, maxValue: 0, timer: null };
      return;
    }
    const diff = buf.currentValue - buf.startValue;
    const resLabel = buf.resource.toUpperCase();
    const label = diff > 0
      ? `${buf.character}: Healed ${diff} ${resLabel} (${buf.currentValue}/${buf.maxValue})`
      : `${buf.character}: Took ${Math.abs(diff)} damage (${buf.currentValue}/${buf.maxValue})`;
    await logToSession(label);
    resourceBuffer.current = { character: '', resource: '', startValue: 0, currentValue: 0, maxValue: 0, timer: null };
  }, [logToSession]);

  const logHPChange = useCallback(async (
    characterName: string,
    oldHP: number,
    newHP: number,
    maxHP: number,
    resourceId: string = 'hp',
  ) => {
    if (!activeSession) return;
    const diff = newHP - oldHP;
    if (diff === 0) return;
    const buf = resourceBuffer.current;
    // If switching character or resource, flush previous
    if ((buf.character && buf.character !== characterName) || (buf.resource && buf.resource !== resourceId)) {
      await flushResourceBuffer();
    }
    // Initialize start value on first change in this batch
    if (!buf.character || buf.character !== characterName || buf.resource !== resourceId) {
      resourceBuffer.current = { character: characterName, resource: resourceId, startValue: oldHP, currentValue: newHP, maxValue: maxHP, timer: null };
    } else {
      resourceBuffer.current.currentValue = newHP;
      resourceBuffer.current.maxValue = maxHP;
    }
    // Reset debounce timer (3 seconds)
    if (resourceBuffer.current.timer !== null) clearTimeout(resourceBuffer.current.timer);
    resourceBuffer.current.timer = setTimeout(() => {
      flushResourceBuffer();
    }, 3000);
  }, [activeSession, flushResourceBuffer]);

  const logDeathRoll = useCallback(async (
    characterName: string,
    rollNumber: number,
    survived: boolean,
  ) => {
    const result = survived ? 'Survived' : 'Failed';
    await logToSession(`${characterName}: Death Roll #${rollNumber} — ${result}`);
  }, [logToSession]);

  const logRest = useCallback(async (characterName: string, restType: string, outcome: string) => {
    await logToSession(`${characterName}: ${restType} — ${outcome}`);
  }, [logToSession]);

  // Flush accumulated coin changes as a single log entry
  const flushCoinBuffer = useCallback(async () => {
    const buf = coinBuffer.current;
    if (!buf.character || Object.keys(buf.changes).length === 0) return;
    const parts: string[] = [];
    if (buf.changes.gold) parts.push(`${buf.changes.gold > 0 ? '+' : ''}${buf.changes.gold}g`);
    if (buf.changes.silver) parts.push(`${buf.changes.silver > 0 ? '+' : ''}${buf.changes.silver}s`);
    if (buf.changes.copper) parts.push(`${buf.changes.copper > 0 ? '+' : ''}${buf.changes.copper}c`);
    if (parts.length > 0) {
      await logToSession(`${buf.character}: Coins ${parts.join(' ')}`);
    }
    coinBuffer.current = { character: '', changes: {}, timer: null };
  }, [logToSession]);

  const logCoinChange = useCallback((characterName: string, coinType: 'gold' | 'silver' | 'copper', delta: number) => {
    const buf = coinBuffer.current;
    // If the character changes, flush previous buffer first
    if (buf.character && buf.character !== characterName) {
      flushCoinBuffer();
    }
    // Accumulate
    buf.character = characterName;
    buf.changes[coinType] = (buf.changes[coinType] ?? 0) + delta;
    // Reset debounce timer (3 seconds)
    if (buf.timer !== null) clearTimeout(buf.timer);
    buf.timer = setTimeout(() => {
      flushCoinBuffer();
    }, 3000);
  }, [flushCoinBuffer]);

  // Flush buffers when session ends
  useEffect(() => {
    if (!activeSession) {
      flushCoinBuffer();
      flushResourceBuffer();
    }
  }, [activeSession, flushCoinBuffer, flushResourceBuffer]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      const coinBuf = coinBuffer.current;
      if (coinBuf.timer !== null) clearTimeout(coinBuf.timer);
      flushCoinBuffer();
      const resBuf = resourceBuffer.current;
      if (resBuf.timer !== null) clearTimeout(resBuf.timer);
      flushResourceBuffer();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    hasActiveSession: !!activeSession,
    logToSession,
    logSkillCheck,
    logSpellCast,
    logAbilityUse,
    logHPChange,
    logDeathRoll,
    logRest,
    logCoinChange,
  };
}
