import { useState, useEffect } from 'react';
import { useEncounter } from './useEncounter';
import { CombatEncounterView } from './CombatEncounterView';
import { ParticipantDrawer } from './ParticipantDrawer';
import { QuickCreateParticipantFlow } from './QuickCreateParticipantFlow';
import type { EncounterParticipant } from '../../types/encounter';
import type { PartyMember } from '../../types/party';
import { getPartyByCampaign, getPartyMembers } from '../../storage/repositories/partyRepository';
import { getById as getCharacterById } from '../../storage/repositories/characterRepository';
import { cn } from '../../lib/utils';

interface EncounterScreenProps {
  encounterId: string;
  sessionId: string;
  campaignId: string;
  onClose: () => void;
}

const actionBtnClass = 'min-h-11 min-w-11 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] cursor-pointer text-sm font-medium';

/**
 * Full encounter view — shows participant list, notes feed, and actions.
 * For combat-type encounters, SS-07's CombatEncounterView will be rendered instead.
 */
export function EncounterScreen({ encounterId, sessionId, campaignId, onClose }: EncounterScreenProps) {
  const {
    encounter,
    participants,
    linkedNotes,
    endEncounter,
    addParticipantFromCharacter,
    quickCreateParticipant,
    updateParticipantState,
  } = useEncounter(encounterId, sessionId, campaignId);

  const [selectedParticipant, setSelectedParticipant] = useState<EncounterParticipant | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showPartyPicker, setShowPartyPicker] = useState(false);
  const [partyMembers, setPartyMembers] = useState<Array<PartyMember & { characterName?: string }>>([]);
  const [loadingParty, setLoadingParty] = useState(false);

  useEffect(() => {
    if (!showPartyPicker) return;
    let cancelled = false;
    (async () => {
      setLoadingParty(true);
      try {
        const party = await getPartyByCampaign(campaignId);
        if (!party || cancelled) { setPartyMembers([]); return; }
        const members = await getPartyMembers(party.id);
        const enriched = await Promise.all(
          members.map(async (m) => {
            if (m.linkedCharacterId) {
              const char = await getCharacterById(m.linkedCharacterId);
              return { ...m, characterName: char?.name };
            }
            return { ...m, characterName: undefined };
          })
        );
        if (!cancelled) setPartyMembers(enriched);
      } catch {
        if (!cancelled) setPartyMembers([]);
      } finally {
        if (!cancelled) setLoadingParty(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showPartyPicker, campaignId]);

  if (!encounter) {
    return (
      <div className="p-4 text-center text-[var(--color-text-muted)]">
        Loading encounter...
      </div>
    );
  }

  // Combat encounters use the dedicated CombatEncounterView
  if (encounter.type === 'combat') {
    return <CombatEncounterView encounter={encounter} onClose={onClose} />;
  }

  const handleEndEncounter = async () => {
    if (!confirm('End this encounter?')) return;
    await endEncounter();
    onClose();
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-[var(--color-text)] m-0">{encounter.title}</h3>
          <div className="text-xs text-[var(--color-text-muted)] capitalize">
            {encounter.type} &middot; {encounter.status}
            {encounter.startedAt && (
              <span> &middot; Started {new Date(encounter.startedAt).toLocaleTimeString()}</span>
            )}
          </div>
        </div>
        <button onClick={onClose} className={actionBtnClass}>
          Back
        </button>
      </div>

      {/* Participant list */}
      <div className="mb-4">
        <h4 className="text-[var(--color-text)] text-xs font-semibold uppercase tracking-wide mb-2">
          Participants ({participants.length})
        </h4>
        <div className="flex flex-col gap-1.5">
          {participants
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedParticipant(p)}
                className="w-full text-left bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg px-3 py-2 cursor-pointer hover:border-[var(--color-accent)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[var(--color-text)] text-sm font-semibold">
                      {p.name}
                    </span>
                    <span className="text-[var(--color-text-muted)] text-xs ml-2 capitalize">
                      {p.type}
                    </span>
                  </div>
                  {p.instanceState.currentHp !== undefined && (
                    <span className="text-[var(--color-text)] text-sm font-bold tabular-nums">
                      HP {p.instanceState.currentHp}
                    </span>
                  )}
                </div>
                {p.instanceState.conditions && p.instanceState.conditions.length > 0 && (
                  <div className="text-[var(--color-text-muted)] text-[10px] mt-0.5">
                    {p.instanceState.conditions.join(', ')}
                  </div>
                )}
              </button>
            ))}
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={() => setShowQuickCreate(true)} className={cn(actionBtnClass, 'flex-1')}>
            Quick Add
          </button>
          <button onClick={() => setShowPartyPicker(true)} className={cn(actionBtnClass, 'flex-1')}>
            Add from Party
          </button>
        </div>
      </div>

      {/* Notes feed (social/exploration encounters only — combat routed above) */}
      {linkedNotes.length > 0 && (
        <div className="mb-4">
          <h4 className="text-[var(--color-text)] text-xs font-semibold uppercase tracking-wide mb-2">
            Linked Notes ({linkedNotes.length})
          </h4>
          <div className="flex flex-col gap-1.5">
            {linkedNotes.map((note) => (
              <div
                key={note.id}
                className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg px-3 py-2"
              >
                <span className="text-[var(--color-text)] text-sm">{note.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* End encounter button */}
      {encounter.status === 'active' && (
        <button
          onClick={handleEndEncounter}
          className="w-full min-h-11 px-4 py-2 bg-red-600 text-white border-none rounded-lg text-sm font-semibold cursor-pointer"
        >
          End Encounter
        </button>
      )}

      {/* Participant drawer */}
      {selectedParticipant && (
        <ParticipantDrawer
          participant={selectedParticipant}
          onUpdateState={(patch) => updateParticipantState(selectedParticipant.id, patch)}
          onClose={() => setSelectedParticipant(null)}
        />
      )}

      {/* Quick create flow */}
      {showQuickCreate && (
        <QuickCreateParticipantFlow
          onSubmit={async (name, stats) => {
            await quickCreateParticipant(name, stats);
            setShowQuickCreate(false);
          }}
          onCancel={() => setShowQuickCreate(false)}
        />
      )}

      {/* Add from Party picker */}
      {showPartyPicker && (
        <div
          role="dialog"
          aria-label="Add from party"
          onClick={() => setShowPartyPicker(false)}
          className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--color-surface)] rounded-t-2xl w-full max-w-[480px] px-4 pt-5 pb-6"
          >
            <h3 className="text-[var(--color-text)] mb-3">Add from Party</h3>
            {loadingParty ? (
              <p className="text-[var(--color-text-muted)] text-sm text-center py-4">Loading party...</p>
            ) : partyMembers.length === 0 ? (
              <p className="text-[var(--color-text-muted)] text-sm text-center py-4">No party members found.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {partyMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg px-3 py-2"
                  >
                    <span className="text-[var(--color-text)] text-sm font-semibold">
                      {m.characterName ?? m.name ?? 'Unnamed'}
                    </span>
                    <button
                      onClick={async () => {
                        if (m.linkedCharacterId) {
                          await addParticipantFromCharacter(m.linkedCharacterId);
                        }
                        setShowPartyPicker(false);
                      }}
                      disabled={!m.linkedCharacterId}
                      className={cn(
                        'min-h-9 px-3 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-xs font-semibold cursor-pointer',
                        !m.linkedCharacterId && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowPartyPicker(false)}
              className="w-full mt-3 min-h-11 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
