import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useAppState } from '../context/AppStateContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { getEngine } from '../features/systems/engine';
import { resolveDerivedField } from '../utils/derivedValues';
import * as characterRepository from '../storage/repositories/characterRepository';
import type { CharacterRecord } from '../types/character';
import PrintableSheet from '../components/PrintableSheet';
import '../styles/print-sheet.css';

/** Derived stats resolved once for the printout, after per-character overrides. */
interface PrintDerivedValues {
  damageBonus: string;
  aglDamageBonus: string;
  movement: number;
  encumbranceLimit: number;
  hpMax: number;
  wpMax: number;
}

/**
 * Shell-less print route: renders {@link PrintableSheet} for the active character
 * plus a floating toolbar (Back / Print / color toggle) that is hidden at print time.
 *
 * @remarks
 * Derived numbers are pulled from the {@link getEngine | system engine} rather than
 * the Dragonbane formulas, so a non-classic ruleset prints its own values; manual
 * `derivedOverrides` still win, matching the on-screen sheet. The color/B&W toggle
 * only swaps a render mode — the print stylesheet in `print-sheet.css` hides the
 * toolbar itself. Redirect-to-library gating mirrors the play dashboard: wait for
 * both loads to settle before concluding there is no character.
 */
export default function PrintableSheetScreen() {
  const navigate = useNavigate();
  const { isLoading: settingsLoading, settings } = useAppState();
  const { character: activeCharacter, isLoading: activeLoading } = useActiveCharacter();
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get('characterId');

  /**
   * Character named by `?characterId=`, when one is given.
   *
   * @remarks
   * The route accepted this parameter and then ignored it, always printing the
   * active character — so printing a party member meant switching the active
   * character first and switching back afterwards. Loaded directly rather than
   * through `ActiveCharacterContext`, so printing someone else's sheet does not
   * disturb whoever is active.
   */
  const [requested, setRequested] = useState<CharacterRecord | null>(null);
  const [requestedLoading, setRequestedLoading] = useState(Boolean(requestedId));

  useEffect(() => {
    if (!requestedId) {
      setRequested(null);
      setRequestedLoading(false);
      return;
    }
    let cancelled = false;
    setRequestedLoading(true);
    characterRepository
      .getById(requestedId)
      .then(found => {
        if (!cancelled) setRequested(found ?? null);
      })
      .catch(() => {
        // Fall back to the active character rather than blocking the print.
        if (!cancelled) setRequested(null);
      })
      .finally(() => {
        if (!cancelled) setRequestedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestedId]);

  const character = requestedId ? requested : activeCharacter;
  const characterLoading = requestedId ? requestedLoading : activeLoading;
  const { system } = useSystemDefinition(character?.systemId ?? 'classic-fantasy');
  const [colorMode, setColorMode] = useState<'color' | 'bw'>('color');

  // Wait for settings to load, then wait for character to load.
  // The character provider re-fires when activeCharacterId changes,
  // so we must wait for both to settle before deciding "no character."
  const stillLoading = settingsLoading || characterLoading;
  const waitingForCharacter =
    !requestedId && !settingsLoading && !characterLoading && !!settings.activeCharacterId && !character;

  // Redirect to library only when fully settled with no character
  useEffect(() => {
    if (!stillLoading && !waitingForCharacter && !character) {
      navigate('/library');
    }
  }, [stillLoading, waitingForCharacter, character, navigate]);

  if (stillLoading || waitingForCharacter) return <div>Loading...</div>;
  if (!character) return null;

  // Derived values come from the system engine rather than the classic-fantasy
  // formulas, so a non-Dragonbane ruleset prints its own numbers.
  const engine = getEngine(system);
  const engineDerived = engine.derivedStats(character, system ?? undefined);

  // Spread the FULL engine-derived map first so any print-surfaced field the
  // engine declares survives (Savage Worlds' Pace/Parry/Toughness, Traveller's
  // Initiative DM) — previously these were silently dropped because this struct
  // only carried the six Dragonbane keys.
  //
  // The resolved values are then overlaid by looping over `engine.derivedFields`
  // rather than naming six Dragonbane keys by hand. That hardcoded list was why
  // a new overridable stat printed its computed value and ignored its override:
  // it was only ever folded if it happened to be one of the six. The shared
  // resolver also folds temp modifiers, which no surface previously did.
  const resolvedEntries = engine.derivedFields.map(field => {
    const resolved = resolveDerivedField(
      character,
      engineDerived as unknown as Record<string, string | number | undefined>,
      field,
    );
    return [field.key, resolved.display] as const;
  });

  const derived = {
    ...(engineDerived as unknown as Record<string, string | number | undefined>),
    ...Object.fromEntries(resolvedEntries.filter(([, value]) => value !== undefined)),
  } as unknown as PrintDerivedValues;

  return (
    <>
      <PrintableSheet
        character={character}
        system={system}
        derived={derived}
        colorMode={colorMode}
        engine={engine}
      />
      {/* Floating toolbar — hidden via @media print in print-sheet.css */}
      <div className="print-toolbar">
        <button onClick={() => navigate(-1)}>← Back</button>
        <button onClick={() => window.print()}>Print</button>
        <button onClick={() => setColorMode(colorMode === 'color' ? 'bw' : 'color')}>
          {colorMode === 'color' ? 'B&W' : 'Color'}
        </button>
      </div>
    </>
  );
}
