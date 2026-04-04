import { useState, useEffect } from 'react';
import { useCampaignContext } from '../campaign/CampaignContext';
import { getById as getCharacterById } from '../../storage/repositories/characterRepository';
import type { CharacterRecord } from '../../types/character';
import { cn } from '../../lib/utils';

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
    return <p className="text-[var(--color-text-muted)] py-2">Loading...</p>;
  }

  return (
    <div>
      {partyWithChars.length === 0 && (
        <p className="text-[var(--color-text-muted)] text-sm mb-3">
          No party members with linked characters.
        </p>
      )}

      {partyWithChars.map(({ memberId, memberName, character, remainingWP }) => (
        <div key={memberId} className="mb-2">
          <div
            className="py-2 text-[var(--color-text)] text-sm font-semibold border-b border-[var(--color-border)]"
          >
            {memberName} — WP: {remainingWP}
          </div>
          {character.spells.length === 0 ? (
            <p className="text-[var(--color-text-muted)] py-1.5 text-sm">
              No spells.
            </p>
          ) : (
            character.spells.map(spell => (
              <button
                key={spell.id}
                onClick={() => { onSelect(spell.name, memberName); onClose(); }}
                className={cn(
                  'flex justify-between items-center w-full text-left py-2.5 px-0 min-h-11 bg-transparent border-0 border-b border-b-[var(--color-border)] text-[var(--color-text)] cursor-pointer text-base',
                  spell.wpCost > remainingWP ? 'opacity-40' : 'opacity-100'
                )}
              >
                <span>{spell.name}</span>
                <span className="text-[var(--color-text-muted)] text-sm">
                  {spell.wpCost} WP
                </span>
              </button>
            ))
          )}
        </div>
      ))}

      {/* Quick-add spell not on sheet */}
      <div className="pt-3 border-t-2 border-t-[var(--color-border)]">
        <p className="text-[var(--color-text-muted)] text-[13px] mb-2">
          Spell not on any sheet:
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Spell name..."
            value={quickAddValue}
            onChange={e => setQuickAddValue(e.target.value)}
            className="flex-1 px-3 py-2 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base box-border"
          />
          <button
            onClick={() => {
              if (quickAddValue.trim()) {
                onSelect(quickAddValue.trim(), 'Unknown');
                setQuickAddValue('');
                onClose();
              }
            }}
            className="min-h-11 px-4 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg cursor-pointer text-base font-semibold"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
