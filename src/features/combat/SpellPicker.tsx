import { useState, useEffect } from 'react';
import { useCampaignContext } from '../campaign/CampaignContext';
import { getById as getCharacterById } from '../../storage/repositories/characterRepository';
import type { CharacterRecord } from '../../types/character';

interface SpellPickerProps {
  onSelect: (spellName: string, characterName: string) => void;
  onClose: () => void;
}

interface PartyMemberWithCharacter {
  memberId: string;
  memberName: string;
  character: CharacterRecord;
  remainingWP: number;
}

export function SpellPicker({ onSelect, onClose }: SpellPickerProps) {
  const { activeParty } = useCampaignContext();
  const [partyWithChars, setPartyWithChars] = useState<PartyMemberWithCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickAddValue, setQuickAddValue] = useState('');

  useEffect(() => {
    const members = activeParty?.members ?? [];
    if (members.length === 0) { setLoading(false); return; }

    let mounted = true;
    Promise.all(
      members
        .filter(m => m.linkedCharacterId)
        .map(async m => {
          const char = await getCharacterById(m.linkedCharacterId!);
          if (!char) return null;
          const currentWP = char.resources?.['willpower']?.current ?? 0;
          return {
            memberId: m.id,
            memberName: char.name,
            character: char,
            remainingWP: currentWP,
          } as PartyMemberWithCharacter;
        })
    ).then(results => {
      if (!mounted) return;
      setPartyWithChars(results.filter((r): r is PartyMemberWithCharacter => r !== null));
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [activeParty]);

  if (loading) {
    return <p style={{ color: 'var(--color-text-muted)', padding: '8px 0' }}>Loading...</p>;
  }

  return (
    <div>
      {partyWithChars.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '12px' }}>
          No party members with linked characters.
        </p>
      )}

      {partyWithChars.map(({ memberId, memberName, character, remainingWP }) => (
        <div key={memberId} style={{ marginBottom: '8px' }}>
          <div
            style={{
              padding: '8px 0',
              color: 'var(--color-text)',
              fontSize: '14px',
              fontWeight: 600,
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            {memberName} — WP: {remainingWP}
          </div>
          {character.spells.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', padding: '6px 0', fontSize: '14px' }}>
              No spells.
            </p>
          ) : (
            character.spells.map(spell => (
              <button
                key={spell.id}
                onClick={() => { onSelect(spell.name, memberName); onClose(); }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 0',
                  minHeight: '44px',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  opacity: spell.wpCost > remainingWP ? 0.4 : 1,
                }}
              >
                <span>{spell.name}</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
                  {spell.wpCost} WP
                </span>
              </button>
            ))
          )}
        </div>
      ))}

      {/* Quick-add spell not on sheet */}
      <div style={{ paddingTop: '12px', borderTop: '2px solid var(--color-border)' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '6px' }}>
          Spell not on any sheet:
        </p>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            placeholder="Spell name..."
            value={quickAddValue}
            onChange={e => setQuickAddValue(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              minHeight: '44px',
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text)',
              fontSize: '16px',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={() => {
              if (quickAddValue.trim()) {
                onSelect(quickAddValue.trim(), 'Unknown');
                setQuickAddValue('');
                onClose();
              }
            }}
            style={{
              minHeight: '44px',
              padding: '0 16px',
              background: 'var(--color-accent)',
              color: 'var(--color-on-accent, #fff)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
