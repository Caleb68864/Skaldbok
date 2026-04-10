import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useAppState } from '../context/AppStateContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { getDerivedValue } from '../utils/derivedValues';
import PrintableSheet from '../components/PrintableSheet';
import '../styles/print-sheet.css';

interface PrintDerivedValues {
  damageBonus: string;
  aglDamageBonus: string;
  movement: number;
  encumbranceLimit: number;
  hpMax: number;
  wpMax: number;
}

export default function PrintableSheetScreen() {
  const navigate = useNavigate();
  const { isLoading: settingsLoading, settings } = useAppState();
  const { character, isLoading: characterLoading } = useActiveCharacter();
  const { system } = useSystemDefinition(character?.systemId ?? 'dragonbane');
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

  // Compute derived values
  const derived: PrintDerivedValues = {
    damageBonus: String(getDerivedValue(character, 'damageBonus').effective),
    aglDamageBonus: String(getDerivedValue(character, 'aglDamageBonus').effective),
    movement: Number(getDerivedValue(character, 'movement').effective),
    encumbranceLimit: Number(getDerivedValue(character, 'encumbranceLimit').effective),
    hpMax: Number(getDerivedValue(character, 'hpMax').effective),
    wpMax: Number(getDerivedValue(character, 'wpMax').effective),
  };

  return (
    <>
      <PrintableSheet
        character={character}
        system={system}
        derived={derived}
        colorMode={colorMode}
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
