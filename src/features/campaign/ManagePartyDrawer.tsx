import { useState, useEffect } from 'react';
import { useCampaignContext } from './CampaignContext';
import { useToast } from '../../context/ToastContext';
import { getAll as getAllCharacters } from '../../storage/repositories/characterRepository';
import { createParty, addPartyMember, removePartyMember } from '../../storage/repositories/partyRepository';
import { updateCampaign } from '../../storage/repositories/campaignRepository';
import type { CharacterRecord } from '../../types/character';
import type { PartyMember } from '../../types/party';
import { cn } from '../../lib/utils';

/**
 * Props for the {@link ManagePartyDrawer} component.
 */
interface ManagePartyDrawerProps {
  /** Called when the drawer should be closed (backdrop tap or close button). */
  onClose: () => void;
}

/**
 * Bottom-sheet drawer for managing the active campaign's party.
 *
 * @remarks
 * Allows the GM to:
 * - Add any existing {@link CharacterRecord} to the party (creates the party on
 *   first add if none exists yet).
 * - Remove a member from the party.
 * - Designate one member as "my character" (stored on the campaign as
 *   `activeCharacterMemberId`).
 *
 * The component guards against a missing active campaign: if none is set it shows
 * a toast, calls `onClose`, and renders nothing.
 *
 * @param props - {@link ManagePartyDrawerProps}
 *
 * @example
 * ```tsx
 * {showPartyDrawer && <ManagePartyDrawer onClose={() => setShowPartyDrawer(false)} />}
 * ```
 */
export function ManagePartyDrawer({ onClose }: ManagePartyDrawerProps) {
  const { activeCampaign, activeParty, refreshParty } = useCampaignContext();
  const { showToast } = useToast();
  const [allCharacters, setAllCharacters] = useState<CharacterRecord[]>([]);
  const [saving, setSaving] = useState(false);

  // Guard: show toast and close if no active campaign
  useEffect(() => {
    if (!activeCampaign) {
      showToast('Create a campaign first');
      onClose();
    }
  }, [activeCampaign, showToast, onClose]);

  useEffect(() => {
    let mounted = true;
    getAllCharacters().then(chars => {
      if (mounted) setAllCharacters(chars);
    });
    return () => { mounted = false; };
  }, []);

  if (!activeCampaign) return null;

  const members: PartyMember[] = activeParty?.members ?? [];
  const memberCharacterIds = new Set(members.map(m => m.linkedCharacterId).filter(Boolean));
  const availableCharacters = allCharacters.filter(c => !memberCharacterIds.has(c.id));

  /**
   * Adds a character to the party as a new member. Lazily creates a party for
   * the campaign if one does not yet exist.
   *
   * @param characterId - ID of the {@link CharacterRecord} to add.
   */
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

  /**
   * Removes a member from the party by their party-member ID.
   *
   * @param memberId - ID of the {@link PartyMember} row to delete.
   */
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

  /**
   * Sets a party member as the local user's active character for this campaign.
   * Persists the selection to `campaign.activeCharacterMemberId`.
   *
   * @param memberId - ID of the {@link PartyMember} to designate as "my character".
   */
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
      className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[var(--color-surface)] rounded-t-2xl w-full max-w-[480px] px-4 pt-6 pb-8 max-h-[80dvh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[var(--color-text)]">Manage Party</h2>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-[var(--color-text-muted)] text-xl cursor-pointer min-h-11 min-w-11"
          >
            ✕
          </button>
        </div>

        {/* Current members */}
        <h3 className="text-[var(--color-text-muted)] text-xs uppercase mb-2">
          Current Members
        </h3>
        {members.length === 0 ? (
          <p className="text-[var(--color-text-muted)] mb-4">No members yet.</p>
        ) : (
          <div className="mb-4">
            {members.map(member => (
              <div
                key={member.id}
                className="flex items-center py-2 border-b border-[var(--color-border)] min-h-11"
              >
                <span className="flex-1 text-[var(--color-text)]">
                  {member.name ?? 'Unknown character'}
                  {activeCampaign?.activeCharacterMemberId === member.id && (
                    <span className="text-[var(--color-accent)] ml-2 text-xs">
                      (my character)
                    </span>
                  )}
                </span>
                <button
                  onClick={() => handleSetMyCharacter(member.id)}
                  disabled={saving || activeCampaign?.activeCharacterMemberId === member.id}
                  className={cn(
                    'min-h-11 px-2.5 bg-transparent border border-[var(--color-border)] rounded-md text-[var(--color-text-muted)] cursor-pointer text-xs mr-2',
                    activeCampaign?.activeCharacterMemberId === member.id ? 'opacity-40' : 'opacity-100'
                  )}
                >
                  Set mine
                </button>
                <button
                  onClick={() => handleRemoveMember(member.id)}
                  disabled={saving}
                  className="min-h-11 px-2.5 bg-transparent border border-[var(--color-border)] rounded-md text-[var(--color-text-muted)] cursor-pointer text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add character */}
        <h3 className="text-[var(--color-text-muted)] text-xs uppercase mb-2">
          Add Character
        </h3>
        {availableCharacters.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">No characters available to add.</p>
        ) : (
          <div>
            {availableCharacters.map(char => (
              <button
                key={char.id}
                onClick={() => handleAddMember(char.id)}
                disabled={saving}
                className="block w-full text-left px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] cursor-pointer mb-2"
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
