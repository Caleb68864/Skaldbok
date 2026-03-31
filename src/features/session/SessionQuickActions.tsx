import React, { useState, useEffect } from 'react';
import { Drawer } from '../../components/primitives/Drawer';
import { useNoteActions } from '../notes/useNoteActions';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useToast } from '../../context/ToastContext';
import { getById as getCharacterById, save as saveCharacter } from '../../storage/repositories/characterRepository';
import type { CharacterRecord } from '../../types/character';
import type { PartyMember } from '../../types/party';
import { getNotesByCampaign } from '../../storage/repositories/noteRepository';
import type { Note } from '../../types/note';
import { PartyPicker } from '../../components/fields/PartyPicker';
import type { ResolvedMember } from '../../components/fields/PartyPicker';
import { CounterControl } from '../../components/primitives/CounterControl';

// ── Dragonbane Data ──────────────────────────────────────────────

const CORE_SKILLS = [
  'ACROBATICS', 'AWARENESS', 'BARTERING', 'BEAST LORE', 'BLUFFING',
  'BUSHCRAFT', 'CRAFTING', 'EVADE', 'HEALING', 'HUNTING & FISHING',
  'LANGUAGES', 'MYTHS & LEGENDS', 'PERFORMANCE', 'PERSUASION',
  'RIDING', 'SEAMANSHIP', 'SLEIGHT OF HAND', 'SNEAKING',
  'SPOT HIDDEN', 'SWIMMING',
] as const;

const WEAPON_SKILLS = [
  'Axes', 'Bows', 'Brawling', 'Crossbows', 'Hammers',
  'Knives', 'Slings', 'Spears', 'Staves', 'Swords',
] as const;

const CONDITIONS = [
  { name: 'Exhausted', attr: 'STR' },
  { name: 'Sickly', attr: 'CON' },
  { name: 'Dazed', attr: 'AGL' },
  { name: 'Angry', attr: 'INT' },
  { name: 'Scared', attr: 'WIL' },
  { name: 'Disheartened', attr: 'CHA' },
] as const;

const REST_TYPES = [
  { name: 'Round Rest', effect: 'Recover D6 WP' },
  { name: 'Stretch Rest', effect: 'Heal D6 HP, D6 WP, heal one condition' },
  { name: 'Shift Rest', effect: 'Recover all HP, WP, and conditions' },
] as const;

const RESULTS = ['success', 'failure', 'dragon', 'demon'] as const;

const TAG_OPTIONS = [
  'combat', 'exploration', 'social', 'mystery',
  'tense', 'funny', 'dramatic', 'sad', 'victorious',
  'important',
] as const;

// ── Styles ──────────────────────────────────────────────────────

const chipStyle = {
  minHeight: '44px',
  padding: '0 14px',
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: '22px',
  color: 'var(--color-text)',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 600,
  flexShrink: 0,
} as const;

const listBtnStyle = {
  display: 'block',
  width: '100%',
  textAlign: 'left' as const,
  padding: '12px 0',
  minHeight: '44px',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid var(--color-border)',
  color: 'var(--color-text)',
  cursor: 'pointer',
  fontSize: '16px',
};

const resultChipBase = {
  minHeight: '44px',
  minWidth: '44px',
  padding: '0 16px',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 600,
} as const;

// ── Roll Modifiers (Boon / Bane / Push) ─────────────────────────

function RollModifiers({
  mods,
  onToggle,
}: {
  mods: { boon: boolean; bane: boolean; pushed: boolean };
  onToggle: (key: 'boon' | 'bane' | 'pushed') => void;
}) {
  const modChip = (key: 'boon' | 'bane' | 'pushed', label: string, activeColor: string) => (
    <button
      key={key}
      onClick={() => onToggle(key)}
      style={{
        ...chipStyle,
        background: mods[key] ? activeColor : 'var(--color-surface-raised)',
        color: mods[key] ? '#fff' : 'var(--color-text)',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ marginBottom: '12px' }}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
        Modifiers
      </p>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {modChip('boon', 'Boon', '#27ae60')}
        {modChip('bane', 'Bane', '#c0392b')}
        {modChip('pushed', 'Pushed', '#8e44ad')}
      </div>
    </div>
  );
}

function TagPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
        Tags
      </p>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {TAG_OPTIONS.map(tag => (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            style={{
              minHeight: '44px',
              minWidth: '44px',
              padding: '0 10px',
              borderRadius: '16px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              background: selected.includes(tag) ? 'var(--color-accent)' : 'var(--color-surface-raised)',
              color: selected.includes(tag) ? 'var(--color-on-accent, #fff)' : 'var(--color-text-muted)',
            }}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatModTags(mods: { boon: boolean; bane: boolean; pushed: boolean }): string {
  const tags: string[] = [];
  if (mods.boon) tags.push('Boon');
  if (mods.bane) tags.push('Bane');
  if (mods.pushed) tags.push('Pushed');
  return tags.length > 0 ? ` (${tags.join(', ')})` : '';
}

// ── Main Component ──────────────────────────────────────────────

export function SessionQuickActions() {
  const { createNote } = useNoteActions();
  const { character } = useActiveCharacter();
  const { activeCampaign, activeParty, activeCharacterInCampaign } = useCampaignContext();
  const { showToast } = useToast();

  const [activeDrawer, setActiveDrawer] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedSpell, setSelectedSpell] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [resolvedMembers, setResolvedMembers] = useState<ResolvedMember[]>([]);
  const [lootName, setLootName] = useState('');
  const [quoteText, setQuoteText] = useState('');
  const [rumorText, setRumorText] = useState('');
  const [rumorSource, setRumorSource] = useState('');
  const [npcNotes, setNpcNotes] = useState<Note[]>([]);
  const [rollMods, setRollMods] = useState<{ boon: boolean; bane: boolean; pushed: boolean }>({ boon: false, bane: false, pushed: false });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [shopItem, setShopItem] = useState('');
  const [shopAction, setShopAction] = useState<'buy' | 'sell'>('buy');
  const [shopGold, setShopGold] = useState(0);
  const [shopSilver, setShopSilver] = useState(0);
  const [shopCopper, setShopCopper] = useState(0);
  const [shopQuantity, setShopQuantity] = useState(1);

  // Resolve party member names from linked characters
  useEffect(() => {
    const members = activeParty?.members ?? [];
    if (members.length === 0) {
      // Fallback: use active character if available
      if (character) {
        setResolvedMembers([{ id: '__self__', name: character.name, character }]);
        setSelectedMembers(['__self__']);
      }
      return;
    }

    let mounted = true;
    Promise.all(
      members.map(async (m: PartyMember) => {
        if (m.linkedCharacterId) {
          const char = await getCharacterById(m.linkedCharacterId);
          if (char) return { id: m.id, name: char.name, character: char };
        }
        return { id: m.id, name: m.name ?? 'Unknown', character: null };
      })
    ).then(results => {
      if (!mounted) return;
      setResolvedMembers(results);
      // Default: select active character's member, or first member
      const activeId = activeCharacterInCampaign?.id;
      if (activeId && results.some(r => r.id === activeId)) {
        setSelectedMembers([activeId]);
      } else if (results.length > 0) {
        setSelectedMembers([results[0].id]);
      }
    });
    return () => { mounted = false; };
  }, [activeParty, character, activeCharacterInCampaign]);

  // Load NPC notes for rumor source picker
  useEffect(() => {
    if (activeDrawer !== 'rumor' || !activeCampaign) return;
    let mounted = true;
    getNotesByCampaign(activeCampaign.id).then(notes => {
      if (mounted) setNpcNotes(notes.filter(n => n && n.type === 'npc') as Note[]);
    });
    return () => { mounted = false; };
  }, [activeDrawer, activeCampaign]);

  // Re-select active character when a drawer opens (AC2.2)
  useEffect(() => {
    if (!activeDrawer) return;
    const activeId = activeCharacterInCampaign?.id;
    if (activeId && resolvedMembers.some(r => r.id === activeId)) {
      setSelectedMembers([activeId]);
    } else if (character && resolvedMembers.length === 0) {
      setSelectedMembers(['__self__']);
    } else if (resolvedMembers.length > 0) {
      setSelectedMembers([resolvedMembers[0].id]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDrawer]);

  const close = () => {
    setActiveDrawer(null);
    setSelectedSkill(null);
    setSelectedSpell(null);
    setLootName('');
    setQuoteText('');
    setRumorText('');
    setRumorSource('');
    setRollMods({ boon: false, bane: false, pushed: false });
    setSelectedTags([]);
    setShopItem('');
    setShopAction('buy');
    setShopGold(0);
    setShopSilver(0);
    setShopCopper(0);
    setShopQuantity(1);
  };

  // Get display name for selected members
  const selectedNames = (): string => {
    if (selectedMembers.length === 0) return character?.name ?? 'Unknown';
    if (selectedMembers.length === resolvedMembers.length && resolvedMembers.length > 1) return 'Party';
    return selectedMembers
      .map(id => resolvedMembers.find(m => m.id === id)?.name ?? 'Unknown')
      .join(', ');
  };

  // Get character record for first selected member (for spells/abilities)
  const selectedCharacter = (): CharacterRecord | null => {
    if (selectedMembers.length === 0) return character ?? null;
    const member = resolvedMembers.find(m => m.id === selectedMembers[0]);
    return member?.character ?? character ?? null;
  };

  const logEvent = async (type: string, title: string, typeData: Record<string, unknown>) => {
    const who = selectedNames();
    const fullTitle = who ? `${who}: ${title}` : title;
    await createNote({
      title: fullTitle,
      type: type as 'skill-check' | 'generic' | 'loot' | 'quote' | 'rumor',
      body: null,
      pinned: false,
      status: 'active',
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      typeData,
    });
    showToast(`Logged: ${fullTitle}`);
    close();
  };

  // ── Skill Check Flow ──────────────────────────────────────────

  const renderSkillPicker = () => {
    if (selectedSkill) {
      const modTag = formatModTags(rollMods);
      return (
        <div>
          <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
          <p style={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: '12px', fontSize: '16px' }}>
            {selectedSkill}{modTag}
          </p>
          <RollModifiers mods={rollMods} onToggle={key => setRollMods(m => ({ ...m, [key]: !m[key] }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {RESULTS.map(result => (
              <button
                key={result}
                onClick={() => logEvent('skill-check', `${selectedSkill}${formatModTags(rollMods)} — ${result}`, {
                  skill: selectedSkill,
                  result,
                  character: selectedNames(),
                })}
                style={{
                  ...resultChipBase,
                  background: result === 'dragon' ? 'var(--color-accent)'
                    : result === 'demon' ? '#c0392b'
                    : result === 'success' ? '#27ae60'
                    : 'var(--color-surface-raised)',
                  color: result === 'failure' ? 'var(--color-text)' : '#fff',
                }}
              >
                {result === 'dragon' ? 'Dragon (1)' : result === 'demon' ? 'Demon (20)' : result.charAt(0).toUpperCase() + result.slice(1)}
              </button>
            ))}
          </div>
        </div>
      );
    }

    const char = selectedCharacter();
    const charSkills = char?.skills ? Object.keys(char.skills) : [];

    return (
      <div>
        <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
        {charSkills.length > 0 && (
          <>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              {selectedNames()}'s Skills
            </p>
            {charSkills.map(skill => (
              <button key={`char-${skill}`} onClick={() => setSelectedSkill(skill)} style={listBtnStyle}>
                {skill}
              </button>
            ))}
            <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '12px 0 4px' }}>
              All Skills
            </p>
          </>
        )}
        {[...CORE_SKILLS, ...WEAPON_SKILLS].map(skill => (
          <button key={skill} onClick={() => setSelectedSkill(skill)} style={listBtnStyle}>
            {skill}
          </button>
        ))}
      </div>
    );
  };

  // ── Spell Cast Flow ───────────────────────────────────────────

  const renderSpellPicker = () => {
    if (selectedSpell) {
      const modTag = formatModTags(rollMods);
      return (
        <div>
          <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
          <p style={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: '12px', fontSize: '16px' }}>
            Cast: {selectedSpell}{modTag}
          </p>
          <RollModifiers mods={rollMods} onToggle={key => setRollMods(m => ({ ...m, [key]: !m[key] }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {RESULTS.map(result => (
              <button
                key={result}
                onClick={() => logEvent('generic', `Cast ${selectedSpell}${formatModTags(rollMods)} — ${result}`, {})}
                style={{
                  ...resultChipBase,
                  background: result === 'dragon' ? 'var(--color-accent)'
                    : result === 'demon' ? '#c0392b'
                    : result === 'success' ? '#27ae60'
                    : 'var(--color-surface-raised)',
                  color: result === 'failure' ? 'var(--color-text)' : '#fff',
                }}
              >
                {result === 'dragon' ? 'Dragon (1)' : result === 'demon' ? 'Demon (20)' : result.charAt(0).toUpperCase() + result.slice(1)}
              </button>
            ))}
          </div>
        </div>
      );
    }

    const char = selectedCharacter();
    const spells = char?.spells ?? [];
    return (
      <div>
        <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
        {spells.length > 0 ? (
          spells.map(spell => (
            <button key={spell.id} onClick={() => setSelectedSpell(spell.name)} style={listBtnStyle}>
              <span>{spell.name}</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginLeft: '8px' }}>
                ({spell.wpCost} WP)
              </span>
            </button>
          ))
        ) : (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>No spells on {selectedNames() || 'active character'}.</p>
        )}
        <button
          onClick={() => {
            const name = prompt('Spell name:');
            if (name?.trim()) setSelectedSpell(name.trim());
          }}
          style={{ ...listBtnStyle, color: 'var(--color-accent)', fontWeight: 600, borderBottom: 'none' }}
        >
          + Quick-add spell
        </button>
      </div>
    );
  };

  // ── Heroic Ability Flow ───────────────────────────────────────

  const renderAbilityPicker = () => {
    const char = selectedCharacter();
    const abilities = char?.heroicAbilities ?? [];
    return (
      <div>
        <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
        {abilities.length > 0 ? (
          abilities.map(a => (
            <button
              key={a.id}
              onClick={() => logEvent('generic', `Used ${a.name}`, {})}
              style={listBtnStyle}
            >
              <span>{a.name}</span>
              {a.wpCost !== undefined && (
                <span style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginLeft: '8px' }}>
                  ({a.wpCost} WP)
                </span>
              )}
            </button>
          ))
        ) : (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>No heroic abilities on {selectedNames() || 'active character'}.</p>
        )}
      </div>
    );
  };

  // ── Condition Flow ────────────────────────────────────────────

  const renderConditionPicker = () => (
    <div>
      <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} multiSelect />
      {CONDITIONS.map(c => (
        <div key={c.name} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
          <button
            onClick={() => logEvent('generic', `Gained ${c.name}`, {})}
            style={{ ...listBtnStyle, flex: 1, color: '#c0392b', borderBottom: 'none', padding: '8px 0', fontWeight: 600 }}
          >
            + {c.name} ({c.attr})
          </button>
          <button
            onClick={() => logEvent('generic', `Healed ${c.name}`, {})}
            style={{ ...listBtnStyle, flex: 1, color: '#27ae60', borderBottom: 'none', padding: '8px 0', fontWeight: 600 }}
          >
            - {c.name}
          </button>
        </div>
      ))}
    </div>
  );

  // ── Rest Flow ─────────────────────────────────────────────────

  const renderRestPicker = () => (
    <div>
      <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} multiSelect />
      {REST_TYPES.map(r => (
        <button
          key={r.name}
          onClick={() => logEvent('generic', r.name, {})}
          style={listBtnStyle}
        >
          <span style={{ fontWeight: 600 }}>{r.name}</span>
          <br />
          <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{r.effect}</span>
        </button>
      ))}
    </div>
  );

  // ── Damage Flow ───────────────────────────────────────────────

  const applyDamage = async (amount: number) => {
    // Update HP on each selected character's sheet
    for (const memberId of selectedMembers) {
      const member = resolvedMembers.find(m => m.id === memberId);
      if (!member?.character) continue;
      const fresh = await getCharacterById(member.character.id);
      if (!fresh) continue;
      const hp = fresh.resources['hp'];
      if (!hp) continue;
      const newCurrent = Math.max(0, hp.current - amount);
      await saveCharacter({
        ...fresh,
        resources: { ...fresh.resources, hp: { ...hp, current: newCurrent } },
        updatedAt: new Date().toISOString(),
      });
    }
    await logEvent('generic', `Took ${amount} damage`, { damage: amount });
  };

  const applyHealing = async (amount: number) => {
    // Update HP on each selected character's sheet
    for (const memberId of selectedMembers) {
      const member = resolvedMembers.find(m => m.id === memberId);
      if (!member?.character) continue;
      const fresh = await getCharacterById(member.character.id);
      if (!fresh) continue;
      const hp = fresh.resources['hp'];
      if (!hp) continue;
      const newCurrent = Math.min(hp.max, hp.current + amount);
      await saveCharacter({
        ...fresh,
        resources: { ...fresh.resources, hp: { ...hp, current: newCurrent } },
        updatedAt: new Date().toISOString(),
      });
    }
    await logEvent('generic', `Healed ${amount} HP`, { healing: amount });
  };

  const renderDamagePicker = () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20];
    return (
      <div>
        <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '8px' }}>Damage taken (updates HP):</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
          {values.map(v => (
            <button
              key={`t${v}`}
              onClick={() => applyDamage(v)}
              style={{ ...chipStyle, background: '#c0392b', color: '#fff', minWidth: '50px' }}
            >
              {v}
            </button>
          ))}
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '8px' }}>Healing (updates HP):</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
          {values.map(v => (
            <button
              key={`h${v}`}
              onClick={() => applyHealing(v)}
              style={{ ...chipStyle, background: '#27ae60', color: '#fff', minWidth: '50px' }}
            >
              {v}
            </button>
          ))}
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '8px' }}>Damage dealt (log only):</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {values.map(v => (
            <button
              key={`d${v}`}
              onClick={() => logEvent('generic', `Dealt ${v} damage`, {})}
              style={{ ...chipStyle, background: 'var(--color-surface-raised)', color: 'var(--color-text)', minWidth: '50px' }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ── Loot Flow ─────────────────────────────────────────────────

  const renderLootPicker = () => (
    <div>
      <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
      <input
        type="text"
        placeholder="What did you find?"
        value={lootName}
        onChange={e => setLootName(e.target.value)}
        autoFocus
        style={{
          width: '100%',
          padding: '10px 12px',
          minHeight: '44px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          color: 'var(--color-text)',
          fontSize: '16px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      />
      <button
        onClick={() => {
          if (lootName.trim()) {
            logEvent('loot', `Loot: ${lootName.trim()}`, { holder: selectedNames() });
            setLootName('');
          }
        }}
        disabled={!lootName.trim()}
        style={{
          width: '100%',
          minHeight: '44px',
          background: 'var(--color-accent)',
          color: 'var(--color-on-accent, #fff)',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
          opacity: !lootName.trim() ? 0.6 : 1,
        }}
      >
        Log Loot
      </button>
    </div>
  );

  // ── Camp Flow ──────────────────────────────────────────────────

  const renderCampPicker = () => (
    <div>
      <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} multiSelect />
      <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '8px' }}>
        What kind of camp?
      </p>
      {[
        { name: 'Make Camp', desc: 'Set up camp for the shift' },
        { name: 'Forage', desc: 'Hunt or gather food' },
        { name: 'Keep Watch', desc: 'Stand guard during rest' },
        { name: 'Cook Meal', desc: 'Prepare food for the party' },
      ].map(item => (
        <button
          key={item.name}
          onClick={() => logEvent('generic', item.name, {})}
          style={listBtnStyle}
        >
          <span style={{ fontWeight: 600 }}>{item.name}</span>
          <br />
          <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{item.desc}</span>
        </button>
      ))}
    </div>
  );

  // ── Travel Flow ───────────────────────────────────────────────

  const [travelNote, setTravelNote] = useState('');

  const renderTravelPicker = () => (
    <div>
      <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} multiSelect />
      <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '8px' }}>
        Shifts traveled:
      </p>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {[1, 2, 3, 4].map(shifts => (
          <button
            key={shifts}
            onClick={() => logEvent('generic', `Traveled ${shifts} shift${shifts > 1 ? 's' : ''}`, {})}
            style={{ ...chipStyle, minWidth: '70px' }}
          >
            {shifts} shift{shifts > 1 ? 's' : ''}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Destination or route (optional)"
        value={travelNote}
        onChange={e => setTravelNote(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 12px',
          minHeight: '44px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          color: 'var(--color-text)',
          fontSize: '16px',
          marginBottom: '8px',
          boxSizing: 'border-box',
        }}
      />
      {travelNote.trim() && (
        <button
          onClick={() => { logEvent('generic', `Traveled to ${travelNote.trim()}`, {}); setTravelNote(''); }}
          style={{
            width: '100%',
            minHeight: '44px',
            background: 'var(--color-accent)',
            color: 'var(--color-on-accent, #fff)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Log Travel
        </button>
      )}
    </div>
  );

  // ── Random Encounter Flow ─────────────────────────────────────

  const [encounterDesc, setEncounterDesc] = useState('');

  const renderEncounterPicker = () => (
    <div>
      <button
        onClick={() => logEvent('generic', 'Random Encounter!', {})}
        style={{
          width: '100%',
          minHeight: '44px',
          background: '#c0392b',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: '12px',
        }}
      >
        Log Random Encounter
      </button>
      <input
        type="text"
        placeholder="What was it? (optional)"
        value={encounterDesc}
        onChange={e => setEncounterDesc(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 12px',
          minHeight: '44px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          color: 'var(--color-text)',
          fontSize: '16px',
          marginBottom: '8px',
          boxSizing: 'border-box',
        }}
      />
      {encounterDesc.trim() && (
        <button
          onClick={() => { logEvent('generic', `Encounter: ${encounterDesc.trim()}`, {}); setEncounterDesc(''); }}
          style={{
            width: '100%',
            minHeight: '44px',
            background: 'var(--color-accent)',
            color: 'var(--color-on-accent, #fff)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Log with Description
        </button>
      )}
    </div>
  );

  // ── Death Roll Flow ───────────────────────────────────────────

  const renderDeathRollPicker = () => (
    <div>
      <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
      <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '8px' }}>
        Death Roll result:
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button
          onClick={() => logEvent('generic', 'Death Roll — Survived', {})}
          style={{ ...resultChipBase, background: '#27ae60', color: '#fff' }}
        >
          Survived
        </button>
        <button
          onClick={() => logEvent('generic', 'Death Roll — Failed', {})}
          style={{ ...resultChipBase, background: '#c0392b', color: '#fff' }}
        >
          Failed
        </button>
        <button
          onClick={() => logEvent('generic', 'Death Roll — Dragon (1)', {})}
          style={{ ...resultChipBase, background: 'var(--color-accent)', color: '#fff' }}
        >
          Dragon (1)
        </button>
        <button
          onClick={() => logEvent('generic', 'Death Roll — Dead', {})}
          style={{ ...resultChipBase, background: '#2c3e50', color: '#fff' }}
        >
          Dead
        </button>
      </div>
    </div>
  );

  // ── Quick Quote Flow ───────────────────────────────────────────

  const renderQuotePicker = () => (
    <div>
      <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
      <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginBottom: '8px' }}>
        Who said it? (selected above) — or type an NPC name:
      </p>
      <input
        type="text"
        placeholder="What did they say?"
        value={quoteText}
        onChange={e => setQuoteText(e.target.value)}
        autoFocus
        style={{
          width: '100%',
          padding: '10px 12px',
          minHeight: '44px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          color: 'var(--color-text)',
          fontSize: '16px',
          marginBottom: '12px',
          boxSizing: 'border-box',
          fontStyle: 'italic',
        }}
      />
      <button
        onClick={() => {
          if (quoteText.trim()) {
            logEvent('quote', `"${quoteText.trim()}"`, { speaker: selectedNames() });
            setQuoteText('');
          }
        }}
        disabled={!quoteText.trim()}
        style={{
          width: '100%',
          minHeight: '44px',
          background: 'var(--color-accent)',
          color: 'var(--color-on-accent, #fff)',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
          opacity: !quoteText.trim() ? 0.6 : 1,
        }}
      >
        Log Quote
      </button>
    </div>
  );

  // ── Rumor Flow ────────────────────────────────────────────────

  const renderRumorPicker = () => (
    <div>
      <input
        type="text"
        placeholder="What's the rumor?"
        value={rumorText}
        onChange={e => setRumorText(e.target.value)}
        autoFocus
        style={{
          width: '100%',
          padding: '10px 12px',
          minHeight: '44px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          color: 'var(--color-text)',
          fontSize: '16px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      />
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
        Source (optional)
      </p>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button
          onClick={() => setRumorSource('')}
          style={{
            ...chipStyle,
            background: rumorSource === '' ? 'var(--color-accent)' : 'var(--color-surface-raised)',
            color: rumorSource === '' ? 'var(--color-on-accent, #fff)' : 'var(--color-text)',
          }}
        >
          Unknown
        </button>
        {npcNotes.map(npc => (
          <button
            key={npc.id}
            onClick={() => setRumorSource(npc.title)}
            style={{
              ...chipStyle,
              background: rumorSource === npc.title ? 'var(--color-accent)' : 'var(--color-surface-raised)',
              color: rumorSource === npc.title ? 'var(--color-on-accent, #fff)' : 'var(--color-text)',
            }}
          >
            {npc.title}
          </button>
        ))}
      </div>
      <button
        onClick={() => {
          if (rumorText.trim()) {
            const src = rumorSource || undefined;
            logEvent('rumor', `Rumor: ${rumorText.trim()}`, { source: src, threadStatus: 'open' });
            setRumorText('');
            setRumorSource('');
          }
        }}
        disabled={!rumorText.trim()}
        style={{
          width: '100%',
          minHeight: '44px',
          background: 'var(--color-accent)',
          color: 'var(--color-on-accent, #fff)',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
          opacity: !rumorText.trim() ? 0.6 : 1,
        }}
      >
        Log Rumor
      </button>
    </div>
  );

  // ── Shopping Flow ──────────────────────────────────────────────

  const renderShoppingPicker = () => {
    const totalGold = shopGold * shopQuantity;
    const totalSilver = shopSilver * shopQuantity;
    const totalCopper = shopCopper * shopQuantity;
    const hasAnyCoin = shopGold > 0 || shopSilver > 0 || shopCopper > 0;
    const totalStr = hasAnyCoin
      ? [
          totalGold > 0 ? `${totalGold}g` : '',
          totalSilver > 0 ? `${totalSilver}s` : '',
          totalCopper > 0 ? `${totalCopper}c` : '',
        ].filter(Boolean).join(' ')
      : '';

    return (
      <div>
        <PartyPicker members={resolvedMembers} selected={selectedMembers} onSelect={setSelectedMembers} />
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          <button
            onClick={() => setShopAction('buy')}
            style={{
              ...chipStyle,
              flex: 1,
              background: shopAction === 'buy' ? '#27ae60' : 'var(--color-surface-raised)',
              color: shopAction === 'buy' ? '#fff' : 'var(--color-text)',
            }}
          >
            Buy
          </button>
          <button
            onClick={() => setShopAction('sell')}
            style={{
              ...chipStyle,
              flex: 1,
              background: shopAction === 'sell' ? 'var(--color-accent)' : 'var(--color-surface-raised)',
              color: shopAction === 'sell' ? 'var(--color-on-accent, #fff)' : 'var(--color-text)',
            }}
          >
            Sell
          </button>
        </div>
        <input
          type="text"
          placeholder="Item name (optional)"
          value={shopItem}
          onChange={e => setShopItem(e.target.value)}
          autoFocus
          style={{
            width: '100%',
            padding: '10px 12px',
            minHeight: '44px',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            color: 'var(--color-text)',
            fontSize: '16px',
            marginBottom: '12px',
            boxSizing: 'border-box',
          }}
        />
        <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Cost per item
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          <CounterControl label="Gold" value={shopGold} min={0} onChange={setShopGold} />
          <CounterControl label="Silver" value={shopSilver} min={0} onChange={setShopSilver} />
          <CounterControl label="Copper" value={shopCopper} min={0} onChange={setShopCopper} />
          <CounterControl label="Qty" value={shopQuantity} min={1} onChange={setShopQuantity} />
        </div>
        {hasAnyCoin && shopQuantity > 1 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '12px' }}>
            Total: {totalStr}
          </p>
        )}
        <button
          onClick={() => {
            const verb = shopAction === 'buy' ? 'Bought' : 'Sold';
            const itemPart = shopItem.trim() ? ` ${shopItem.trim()}` : '';
            const coinPart = totalStr ? ` for ${totalStr}` : '';
            const qtyPart = shopQuantity > 1 ? ` ×${shopQuantity}` : '';
            logEvent('generic', `${verb}${itemPart}${qtyPart}${coinPart}`, {
              action: shopAction,
              item: shopItem.trim() || undefined,
              quantity: shopQuantity,
              costGold: shopGold,
              costSilver: shopSilver,
              costCopper: shopCopper,
              totalGold,
              totalSilver,
              totalCopper,
            });
            setShopItem('');
            setShopGold(0);
            setShopSilver(0);
            setShopCopper(0);
            setShopQuantity(1);
          }}
          style={{
            width: '100%',
            minHeight: '44px',
            background: shopAction === 'buy' ? '#27ae60' : 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Log {shopAction === 'buy' ? 'Purchase' : 'Sale'}
        </button>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────

  const actions = [
    { id: 'skill', label: 'Skill Check' },
    { id: 'spell', label: 'Cast Spell' },
    { id: 'ability', label: 'Ability' },
    { id: 'condition', label: 'Condition' },
    { id: 'damage', label: 'Damage' },
    { id: 'death', label: 'Death Roll' },
    { id: 'rest', label: 'Rest' },
    { id: 'camp', label: 'Camp' },
    { id: 'travel', label: 'Travel' },
    { id: 'quote', label: 'Quote' },
    { id: 'rumor', label: 'Rumor' },
    { id: 'shopping', label: 'Shopping' },
    { id: 'encounter', label: 'Encounter' },
    { id: 'loot', label: 'Loot' },
  ];

  const drawerContent: Record<string, { title: string; render: () => React.JSX.Element }> = {
    skill: { title: 'Skill Check', render: renderSkillPicker },
    spell: { title: 'Cast Spell', render: renderSpellPicker },
    ability: { title: 'Heroic Ability', render: renderAbilityPicker },
    condition: { title: 'Condition', render: renderConditionPicker },
    rest: { title: 'Rest', render: renderRestPicker },
    damage: { title: 'Damage', render: renderDamagePicker },
    death: { title: 'Death Roll', render: renderDeathRollPicker },
    camp: { title: 'Camp', render: renderCampPicker },
    travel: { title: 'Travel', render: renderTravelPicker },
    quote: { title: 'Quick Quote', render: renderQuotePicker },
    rumor: { title: 'Rumor Heard', render: renderRumorPicker },
    shopping: { title: 'Shopping', render: renderShoppingPicker },
    encounter: { title: 'Random Encounter', render: renderEncounterPicker },
    loot: { title: 'Loot Found', render: renderLootPicker },
  };

  return (
    <>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
        Quick Log
      </p>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {actions.map(a => (
          <button key={a.id} onClick={() => setActiveDrawer(a.id)} style={chipStyle}>
            {a.label}
          </button>
        ))}
      </div>

      {activeDrawer && drawerContent[activeDrawer] && (
        <Drawer
          open={true}
          onClose={close}
          title={drawerContent[activeDrawer].title}
        >
          {drawerContent[activeDrawer].render()}
          <TagPicker
            selected={selectedTags}
            onToggle={tag => setSelectedTags(prev =>
              prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
            )}
          />
        </Drawer>
      )}
    </>
  );
}
