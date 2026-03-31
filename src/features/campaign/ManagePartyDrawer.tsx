import { useState, useEffect } from 'react';
import { useCampaignContext } from './CampaignContext';
import { useToast } from '../../context/ToastContext';
import { getAll as getAllCharacters } from '../../storage/repositories/characterRepository';
import { createParty, addPartyMember, removePartyMember } from '../../storage/repositories/partyRepository';
import { updateCampaign } from '../../storage/repositories/campaignRepository';
import type { CharacterRecord } from '../../types/character';
import type { PartyMember } from '../../types/party';

interface ManagePartyDrawerProps {
  onClose: () => void;
}

export function ManagePartyDrawer({ onClose }: ManagePartyDrawerProps) {
  const { activeCampaign, activeParty, refreshParty } = useCampaignContext();
  const { showToast } = useToast();
  const [allCharacters, setAllCharacters] = useState<CharacterRecord[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    getAllCharacters().then(chars => {
      if (mounted) setAllCharacters(chars);
    });
    return () => { mounted = false; };
  }, []);

  const members: PartyMember[] = activeParty?.members ?? [];
  const memberCharacterIds = new Set(members.map(m => m.linkedCharacterId).filter(Boolean));
  const availableCharacters = allCharacters.filter(c => !memberCharacterIds.has(c.id));

  const handleAddMember = async (characterId: string) => {
    if (!activeCampaign) return;
    setSaving(true);
    try {
      let party = activeParty;
      if (!party) {
        // Lazy create party
        const newParty = await createParty({
          campaignId: activeCampaign.id,
          name: `${activeCampaign.name} Party`,
        });
        await updateCampaign(activeCampaign.id, { activePartyId: newParty.id });
        party = { ...newParty, members: [] };
      }

      const char = allCharacters.find(c => c.id === characterId);
      await addPartyMember({
        partyId: party.id,
        linkedCharacterId: characterId,
        name: char?.name,
        isActivePlayer: false,
      });
      await refreshParty();
    } catch (e) {
      showToast('Failed to add member');
      console.error('ManagePartyDrawer.handleAddMember failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setSaving(true);
    try {
      await removePartyMember(memberId);
      await refreshParty();
    } catch (e) {
      showToast('Failed to remove member');
      console.error('ManagePartyDrawer.handleRemoveMember failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleSetMyCharacter = async (memberId: string) => {
    if (!activeCampaign) return;
    setSaving(true);
    try {
      await updateCampaign(activeCampaign.id, { activeCharacterMemberId: memberId });
      await refreshParty();
      showToast('My character updated');
    } catch (e) {
      showToast('Failed to set my character');
      console.error('ManagePartyDrawer.handleSetMyCharacter failed:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Manage party"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: '16px 16px 0 0',
          width: '100%',
          maxWidth: 480,
          padding: '24px 16px 32px',
          maxHeight: '80dvh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ color: 'var(--color-text)' }}>Manage Party</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: '20px',
              cursor: 'pointer',
              minHeight: '44px',
              minWidth: '44px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Current members */}
        <h3 style={{ color: 'var(--color-text-muted)', fontSize: '12px', textTransform: 'uppercase', marginBottom: '8px' }}>
          Current Members
        </h3>
        {members.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }}>No members yet.</p>
        ) : (
          <div style={{ marginBottom: '16px' }}>
            {members.map(member => (
              <div
                key={member.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--color-border)',
                  minHeight: '44px',
                }}
              >
                <span style={{ flex: 1, color: 'var(--color-text)' }}>
                  {member.name ?? member.linkedCharacterId ?? member.id}
                  {activeCampaign?.activeCharacterMemberId === member.id && (
                    <span style={{ color: 'var(--color-accent)', marginLeft: '8px', fontSize: '12px' }}>
                      (my character)
                    </span>
                  )}
                </span>
                <button
                  onClick={() => handleSetMyCharacter(member.id)}
                  disabled={saving || activeCampaign?.activeCharacterMemberId === member.id}
                  style={{
                    minHeight: '36px',
                    padding: '0 10px',
                    background: 'none',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    marginRight: '8px',
                    opacity: activeCampaign?.activeCharacterMemberId === member.id ? 0.4 : 1,
                  }}
                >
                  Set mine
                </button>
                <button
                  onClick={() => handleRemoveMember(member.id)}
                  disabled={saving}
                  style={{
                    minHeight: '36px',
                    padding: '0 10px',
                    background: 'none',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add character */}
        <h3 style={{ color: 'var(--color-text-muted)', fontSize: '12px', textTransform: 'uppercase', marginBottom: '8px' }}>
          Add Character
        </h3>
        {availableCharacters.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No characters available to add.</p>
        ) : (
          <div>
            {availableCharacters.map(char => (
              <button
                key={char.id}
                onClick={() => handleAddMember(char.id)}
                disabled={saving}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  minHeight: '44px',
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  marginBottom: '8px',
                }}
              >
                {char.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
