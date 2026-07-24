import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useAppState } from '../context/AppStateContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { useAutosave } from '../hooks/useAutosave';
import * as characterRepository from '../storage/repositories/characterRepository';
import { ResourceModule } from '../features/playDashboard/ResourceModule';
import { ConditionModule } from '../features/playDashboard/ConditionModule';
import { SkillModule } from '../features/playDashboard/SkillModule';
import { CombatModule } from '../features/playDashboard/CombatModule';
import { AbilityModule } from '../features/playDashboard/AbilityModule';
import { MagicModule } from '../features/playDashboard/MagicModule';
import { RestModule } from '../features/playDashboard/RestModule';
import { DerivedStatsModule } from '../features/playDashboard/DerivedStatsModule';
import { QuickReferenceModule } from '../features/playDashboard/QuickReferenceModule';
import { useSyncedResourceMaxima } from '../features/characters/useSyncedResourceMaxima';

/**
 * At-the-table dashboard for the active character: a dense grid of play modules
 * (resources, conditions, skills, combat, abilities, magic, rest, derived stats).
 *
 * @remarks
 * Every module is fed the same `{ character, system, updateCharacter }` props and
 * writes through the active-character autosave, so edits made mid-session persist
 * without an explicit save. The redirect to `/library` is deliberately gated on
 * both settings and character loading having settled *and* no pending
 * `activeCharacterId` — the character provider re-fires when that id changes, so
 * bailing early would bounce the user out while the character is still resolving.
 * {@link useSyncedResourceMaxima} keeps resource caps in step with attribute edits.
 */
export default function PlayDashboardScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const { settings, isLoading: settingsLoading } = useAppState();
  const { system } = useSystemDefinition(character?.systemId ?? 'classic-fantasy');
  const { error } = useAutosave(character, characterRepository.save, 500);
  useSyncedResourceMaxima(character, system, updateCharacter);

  useEffect(() => {
    const stillLoading = settingsLoading || isLoading;
    const waitingForCharacter = !settingsLoading && !isLoading && !!settings.activeCharacterId && !character;
    if (!stillLoading && !waitingForCharacter && !character) {
      navigate('/library');
    }
  }, [settingsLoading, isLoading, settings.activeCharacterId, character, navigate]);

  const stillLoading = settingsLoading || isLoading;
  const waitingForCharacter = !settingsLoading && !isLoading && !!settings.activeCharacterId && !character;

  if (stillLoading || waitingForCharacter) return <div className="p-[var(--space-md)] text-[var(--color-text)]">Loading...</div>;
  if (!character) return null;

  const moduleProps = { character, system, updateCharacter };

  return (
    <div className="p-[var(--space-xs)] md:p-[var(--space-sm)]">
      {error && <div className="mb-[var(--space-sm)] text-[var(--color-danger)] text-[length:var(--font-size-sm)]">{error}</div>}
      <div className="flex flex-col gap-[var(--space-sm)] md:gap-[var(--space-md)]">
        <div className="grid gap-[var(--space-xs)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr))] min-[640px]:[grid-template-columns:1fr_minmax(200px,1fr)_1fr]">
          <ResourceModule {...moduleProps} />
          <DerivedStatsModule {...moduleProps} />
          <RestModule {...moduleProps} />
        </div>
        <ConditionModule {...moduleProps} />
        <div className="grid gap-[var(--space-sm)] md:gap-[var(--space-md)] xl:grid-cols-2">
          <SkillModule {...moduleProps} />
          <CombatModule {...moduleProps} />
          <AbilityModule {...moduleProps} />
          <MagicModule {...moduleProps} />
        </div>
        <QuickReferenceModule {...moduleProps} />
      </div>
    </div>
  );
}
