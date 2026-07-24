import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useAppState } from '../context/AppStateContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { getEngine } from '../features/systems/engine';
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
  const { character, isLoading: characterLoading } = useActiveCharacter();
  const { system } = useSystemDefinition(character?.systemId ?? 'classic-fantasy');
  const [colorMode, setColorMode] = useState<'color' | 'bw'>('color');

  // Wait for settings to load, then wait for character to load.
  // The character provider re-fires when activeCharacterId changes,
  // so we must wait for both to settle before deciding "no character."
  const stillLoading = settingsLoading || characterLoading;
  const waitingForCharacter = !settingsLoading && !characterLoading && !!settings.activeCharacterId && !character;

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

  // Manual per-character overrides still win, matching `getDerivedValue`.
  const override = (key: keyof PrintDerivedValues): number | null =>
    character.derivedOverrides?.[key] ?? null;

  const derived: PrintDerivedValues = {
    damageBonus: String(override('damageBonus') ?? engineDerived.damageBonus),
    aglDamageBonus: String(override('aglDamageBonus') ?? engineDerived.aglDamageBonus),
    movement: Number(override('movement') ?? engineDerived.movement),
    encumbranceLimit: Number(override('encumbranceLimit') ?? engineDerived.encumbranceLimit),
    hpMax: Number(override('hpMax') ?? engineDerived.hpMax),
    wpMax: Number(override('wpMax') ?? engineDerived.wpMax),
  };

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
