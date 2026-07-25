import { useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useAppState } from '../context/AppStateContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { useSheetTemplate } from '../features/systems/useSheetTemplate';
import { getEngine } from '../features/systems/engine';
import { CardRenderer } from '../features/systems/cards/CardRenderer';
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
import { StoryBankModule } from '../features/playDashboard/StoryBankModule';
import { DamageHealModule } from '../features/playDashboard/DamageHealModule';
import { CurrencyModule } from '../features/playDashboard/CurrencyModule';
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
  const { template } = useSheetTemplate(character?.systemId ?? 'classic-fantasy');
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

  // A rest-based system (Dragonbane) keeps the classic three-across top row —
  // Vitals · Derived · Rest — with Conditions full-width below. A system without
  // rest (Traveller) would leave that third column dead, so instead Vitals sits
  // on the left and Derived stacks over Conditions on the right, filling the
  // height beside the tall Vitals card rather than leaving a gap.
  const hasRest = (getEngine(system).rest?.length ?? 0) > 0;

  const playTemplate = template?.play;

  return (
    <div className="p-[var(--space-xs)] md:p-[var(--space-sm)]">
      {error && <div className="mb-[var(--space-sm)] text-[var(--color-danger)] text-[length:var(--font-size-sm)]">{error}</div>}
      <div className="flex flex-col gap-[var(--space-sm)] md:gap-[var(--space-md)]">
        {playTemplate ? (
          playTemplate.regions.map((region, index) =>
            Array.isArray(region) ? (
              // Full-width column: a vertical stack of cards.
              <div key={index} className="flex flex-col gap-[var(--space-xs)] md:gap-[var(--space-sm)]">
                {region.map((entry, entryIndex) => (
                  <CardRenderer key={entryIndex} entry={entry} {...moduleProps} />
                ))}
              </div>
            ) : (
              // Grid row: cells sit side by side at ≥640px (tablet+) and stack on
              // narrow screens, matching the original responsive dashboard grids.
              // `columns` maps to grid-template-columns via a CSS var.
              <div
                key={index}
                className="grid gap-[var(--space-xs)] items-start md:gap-[var(--space-sm)] min-[640px]:[grid-template-columns:var(--tpl-cols)]"
                // Default to one equal column per cell when a template omits
                // `columns`, so a missing value degrades to an even grid rather
                // than collapsing the whole row to a single column.
                style={{ '--tpl-cols': region.columns ?? `repeat(${region.cells.length}, minmax(0, 1fr))` } as CSSProperties}
              >
                {region.cells.map((cell, cellIndex) => (
                  // min-w-0 lets a `1fr` grid track shrink below its content's
                  // min-content width instead of forcing the row to overflow.
                  <div key={cellIndex} className="flex flex-col gap-[var(--space-xs)] md:gap-[var(--space-sm)] min-w-0">
                    {cell.map((entry, entryIndex) => (
                      <CardRenderer key={entryIndex} entry={entry} {...moduleProps} />
                    ))}
                  </div>
                ))}
              </div>
            ),
          )
        ) : hasRest ? (
          <>
            <div className="grid gap-[var(--space-xs)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr))] min-[640px]:[grid-template-columns:1fr_minmax(200px,1fr)_1fr]">
              <ResourceModule {...moduleProps} />
              <DerivedStatsModule {...moduleProps} />
              <RestModule {...moduleProps} />
            </div>
            <ConditionModule {...moduleProps} />
          </>
        ) : (
          <div className="grid gap-[var(--space-xs)] items-start [grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr))] min-[640px]:[grid-template-columns:1fr_2fr]">
            <div className="flex flex-col gap-[var(--space-xs)] md:gap-[var(--space-sm)]">
              <ResourceModule {...moduleProps} />
              <CurrencyModule {...moduleProps} />
            </div>
            <div className="flex flex-col gap-[var(--space-xs)] md:gap-[var(--space-sm)]">
              <DerivedStatsModule {...moduleProps} />
              <ConditionModule {...moduleProps} />
              <DamageHealModule {...moduleProps} />
            </div>
          </div>
        )}
        {!playTemplate && (
          <div className="grid gap-[var(--space-sm)] md:gap-[var(--space-md)] xl:grid-cols-2">
            <SkillModule {...moduleProps} />
            <CombatModule {...moduleProps} />
            <AbilityModule {...moduleProps} />
            <MagicModule {...moduleProps} />
          </div>
        )}
        {!playTemplate && <StoryBankModule {...moduleProps} />}
        {!playTemplate && <QuickReferenceModule {...moduleProps} />}
      </div>
    </div>
  );
}
