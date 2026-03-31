import { useState, useEffect } from 'react';
import { useCampaignContext } from '../../features/campaign/CampaignContext';
import { useToast } from '../../context/ToastContext';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { getById as getCharacterById } from '../../storage/repositories/characterRepository';
import type { PartyMember } from '../../types/party';
import { SkillCheckDrawer } from '../../features/session/actions/SkillCheckDrawer';
import { ShoppingDrawer } from '../../features/session/actions/ShoppingDrawer';
import { LootDrawer } from '../../features/session/actions/LootDrawer';
import { QuoteDrawer } from '../../features/session/actions/QuoteDrawer';
import { RumorDrawer } from '../../features/session/actions/RumorDrawer';
import type { ResolvedMember } from '../fields/PartyPicker';

type ActionType = 'skill-check' | 'shopping' | 'loot' | 'quote' | 'rumor';

const ACTION_ITEMS: { id: ActionType; label: string }[] = [
  { id: 'skill-check', label: 'Skill Check' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'loot', label: 'Loot' },
  { id: 'quote', label: 'Quote' },
  { id: 'rumor', label: 'Rumor' },
];

export function GlobalFAB() {
  const { activeSession, activeParty, activeCharacterInCampaign } = useCampaignContext();
  const { character } = useActiveCharacter();
  const { showToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<ActionType | null>(null);
  const [resolvedMembers, setResolvedMembers] = useState<ResolvedMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Resolve party members
  useEffect(() => {
    const members = activeParty?.members ?? [];
    if (members.length === 0) {
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
      const activeId = activeCharacterInCampaign?.id;
      if (activeId && results.some(r => r.id === activeId)) {
        setSelectedMembers([activeId]);
      } else if (results.length > 0) {
        setSelectedMembers([results[0].id]);
      }
    });
    return () => { mounted = false; };
  }, [activeParty, character, activeCharacterInCampaign]);

  // Re-select active character when drawer opens
  useEffect(() => {
    if (!activeDrawer) return;
    const activeId = activeCharacterInCampaign?.id;
    if (activeId && resolvedMembers.some(r => r.id === activeId)) {
      setSelectedMembers([activeId]);
    } else if (resolvedMembers.length > 0) {
      setSelectedMembers([resolvedMembers[0].id]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDrawer]);

  const handleFABPress = () => {
    if (!activeSession) {
      showToast('Start a session first');
      return;
    }
    setMenuOpen(v => !v);
  };

  const handleActionSelect = (id: ActionType) => {
    setMenuOpen(false);
    setActiveDrawer(id);
  };

  const closeDrawer = () => {
    setActiveDrawer(null);
  };

  const sharedProps = {
    members: resolvedMembers,
    selectedMembers,
    onSelectMembers: setSelectedMembers,
    onLogged: closeDrawer,
  };

  return (
    <>
      {/* Backdrop to close menu */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99,
          }}
        />
      )}

      {/* Action menu */}
      {menuOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '136px',
            right: '16px',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'flex-end',
          }}
        >
          {ACTION_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => handleActionSelect(item.id)}
              style={{
                minHeight: '44px',
                padding: '0 16px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '22px',
                color: 'var(--color-text)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={handleFABPress}
        aria-label={activeSession ? 'Open quick actions' : 'Start a session first'}
        style={{
          position: 'fixed',
          bottom: '68px',
          right: '16px',
          zIndex: 100,
          width: '56px',
          height: '56px',
          borderRadius: '28px',
          background: 'var(--color-accent)',
          color: 'var(--color-on-accent, #fff)',
          border: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          fontSize: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {menuOpen ? '×' : '+'}
      </button>

      {/* Action drawers */}
      <SkillCheckDrawer
        open={activeDrawer === 'skill-check'}
        onClose={closeDrawer}
        {...sharedProps}
      />
      <ShoppingDrawer
        open={activeDrawer === 'shopping'}
        onClose={closeDrawer}
        {...sharedProps}
      />
      <LootDrawer
        open={activeDrawer === 'loot'}
        onClose={closeDrawer}
        {...sharedProps}
      />
      <QuoteDrawer
        open={activeDrawer === 'quote'}
        onClose={closeDrawer}
        {...sharedProps}
      />
      <RumorDrawer
        open={activeDrawer === 'rumor'}
        onClose={closeDrawer}
        onLogged={closeDrawer}
      />
    </>
  );
}
