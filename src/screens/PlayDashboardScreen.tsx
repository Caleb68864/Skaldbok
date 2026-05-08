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

export default function PlayDashboardScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const { settings, isLoading: settingsLoading } = useAppState();
  const { system } = useSystemDefinition(character?.systemId ?? 'default');
  const { error } = useAutosave(character, characterRepository.save, 500);

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
    <div className="p-[var(--space-md)]">
      <div className="mb-[var(--space-md)]">
        <h1 className="m-0 text-[length:var(--font-size-xl)] text-[var(--color-text)]">Play Dashboard</h1>
        <p className="mt-1 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">{character.name}</p>
      </div>
      {error && <div className="mb-[var(--space-sm)] text-[var(--color-danger)] text-[length:var(--font-size-sm)]">{error}</div>}
      <div className="grid gap-[var(--space-md)] xl:grid-cols-2">
        <div className="flex flex-col gap-[var(--space-md)]">
          <ResourceModule {...moduleProps} />
          <ConditionModule {...moduleProps} />
          <RestModule {...moduleProps} />
        </div>
        <div className="flex flex-col gap-[var(--space-md)]">
          <SkillModule {...moduleProps} />
          <CombatModule {...moduleProps} />
          <AbilityModule {...moduleProps} />
          <MagicModule {...moduleProps} />
        </div>
      </div>
    </div>
  );
}
