import { useState, useEffect } from 'react';
import { useEncounter } from './useEncounter';
import { CombatEncounterView } from './CombatEncounterView';
import { EncounterParticipantPicker } from './EncounterParticipantPicker';
import { TiptapNoteEditor } from '../../components/notes/TiptapNoteEditor';
import { useSessionEncounterContext } from '../session/SessionEncounterContext';
import { useSessionLog } from '../session/useSessionLog';
import type { Encounter } from '../../types/encounter';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useToast } from '../../context/ToastContext';
import { addPartyCharactersToEncounter } from './addPartyCharactersToEncounter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from '../../components/ui/dialog';
import { cn } from '../../lib/utils';

interface EncounterScreenProps {
  encounterId: string;
  sessionId: string;
  campaignId: string;
  onClose: () => void;
}

const actionBtnClass =
  'min-h-11 min-w-11 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] cursor-pointer text-sm font-medium';

/**
 * Full encounter view — restructured into four sections:
 *   1. Narrative (description / live notes / summary via TiptapNoteEditor)
 *   2. Participants (picker + CombatEncounterView for combat type)
 *   3. Attached log (contains-edge notes with reassign)
 *   4. Relations (happened_during parent + children)
 *
 * Lifecycle (start / end) is driven through SessionEncounterContext so the
 * same hook instance that powers SessionBar stays in sync.
 */
export function EncounterScreen({ encounterId, sessionId, campaignId, onClose }: EncounterScreenProps) {
  const {
    encounter,
    linkedNotes,
    removeParticipant,
    updateDescription,
    updateBody,
    updateSummary,
    addParticipantFromTemplate,
    getChildEncounters,
    getParentEncounter,
    refresh: refreshEncounter,
  } = useEncounter(encounterId, sessionId, campaignId);

  const { endEncounter, recentEnded, activeEncounter } = useSessionEncounterContext();
  const { reassignNote } = useSessionLog();
  const { activeParty } = useCampaignContext();
  const { showToast } = useToast();

  const [showParticipantPicker, setShowParticipantPicker] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [endSummary, setEndSummary] = useState<unknown>(null);
  const [submittingEnd, setSubmittingEnd] = useState(false);

  const [parentEncounter, setParentEncounter] = useState<Encounter | null>(null);
  const [childEncounters, setChildEncounters] = useState<Encounter[]>([]);

  // Load parent + children for the Relations section.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [parent, children] = await Promise.all([
          getParentEncounter(),
          getChildEncounters(),
        ]);
        if (cancelled) return;
        setParentEncounter(parent);
        setChildEncounters(children);
      } catch {
        if (!cancelled) {
          setParentEncounter(null);
          setChildEncounters([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [encounterId, getParentEncounter, getChildEncounters]);

  if (!encounter) {
    return (
      <div className="p-4 text-center text-[var(--color-text-muted)]">
        Loading encounter...
      </div>
    );
  }

  const participants = encounter.participants ?? [];
  const partyCharacterIds = (activeParty?.members ?? [])
    .map((member) => member.linkedCharacterId)
    .filter((id): id is string => Boolean(id));

  // In-session encounters available as Move-to targets. Union of
  // activeEncounter + recentEnded, minus the current encounter.
  const moveToTargets: Encounter[] = [];
  const moveToIds = new Set<string>();
  if (activeEncounter && activeEncounter.id !== encounterId) {
    moveToIds.add(activeEncounter.id);
    moveToTargets.push(activeEncounter);
  }
  for (const enc of recentEnded) {
    if (enc.id !== encounterId && !moveToIds.has(enc.id)) {
      moveToIds.add(enc.id);
      moveToTargets.push(enc);
    }
  }

  const handleEndSubmit = async () => {
    if (submittingEnd) return;
    setSubmittingEnd(true);
    try {
      await endEncounter(encounterId, endSummary ?? undefined);
      setShowEndDialog(false);
      setEndSummary(null);
      onClose();
    } finally {
      setSubmittingEnd(false);
    }
  };

  const handleAddWholeParty = async () => {
    if (partyCharacterIds.length === 0) {
      showToast('No linked party characters to add');
      return;
    }
    const addedCount = await addPartyCharactersToEncounter(encounterId, partyCharacterIds);
    await refreshEncounter();

    if (addedCount > 0) {
      showToast(
        addedCount === 1 ? 'Added 1 party character' : `Added ${addedCount} party characters`,
        'success',
        2000,
      );
      return;
    }

    showToast('Party is already in this encounter', 'info', 2000);
  };

  return (
    <div className="p-4 flex flex-col gap-6">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)] m-0">
            {encounter.title}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] capitalize m-0">
            {encounter.type} &middot; {encounter.status}
            {encounter.segments[0]?.startedAt && (
              <span>
                {' '}
                &middot; Started{' '}
                {new Date(encounter.segments[0].startedAt).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button type="button" onClick={onClose} className={actionBtnClass}>
          Back
        </button>
      </header>

      {/* Narrative */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
          Narrative
        </h2>
        <label className="block text-xs text-[var(--color-text-muted)] mb-1">
          Description (set at start)
        </label>
        <TiptapNoteEditor
          initialContent={encounter.description}
          onChange={updateDescription}
          campaignId={encounter.campaignId}
          placeholder="Scene-setting…"
          showToolbar={false}
          minHeight="80px"
        />
        <label className="block text-xs text-[var(--color-text-muted)] mt-4 mb-1">
          Live notes
        </label>
        <TiptapNoteEditor
          initialContent={encounter.body}
          onChange={updateBody}
          campaignId={encounter.campaignId}
          placeholder="Jot thoughts as the scene unfolds…"
          showToolbar
          minHeight="120px"
        />
        <label className="block text-xs text-[var(--color-text-muted)] mt-4 mb-1">
          Summary (write at end)
        </label>
        <TiptapNoteEditor
          initialContent={encounter.summary}
          onChange={updateSummary}
          campaignId={encounter.campaignId}
          placeholder="How did it end?"
          showToolbar={false}
          minHeight="80px"
        />
      </section>

      {/* Participants */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            {encounter.type === 'combat' ? 'Participants' : `Participants (${participants.length})`}
          </h2>
          <button
            type="button"
            onClick={() => setShowParticipantPicker(true)}
            className={actionBtnClass}
          >
            Add participant
          </button>
        </div>

        {encounter.type === 'combat' && (
          <p className="mb-3 text-sm text-[var(--color-text-muted)]">
            Add party characters or bestiary creatures here. One-off enemies can still be entered with Quick Add inside combat.
          </p>
        )}

        {/* Combat encounters get the combat view inline. Non-combat types get
            a simple participant list. */}
        {encounter.type === 'combat' ? (
          <CombatEncounterView encounter={encounter} onClose={onClose} />
        ) : (
          <div className="flex flex-col gap-1.5">
            {participants.length === 0 && (
              <p className="text-[var(--color-text-muted)] text-sm">
                No participants yet.
              </p>
            )}
            {participants
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg px-3 py-2"
                >
                  <div>
                    <span className="text-[var(--color-text)] text-sm font-semibold">
                      {p.name}
                    </span>
                    <span className="text-[var(--color-text-muted)] text-xs ml-2 capitalize">
                      {p.type}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeParticipant(p.id)}
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] min-h-11 px-2"
                  >
                    Remove
                  </button>
                </div>
              ))}
            {encounter.status === 'active' && partyCharacterIds.length > 0 && (
              <button
                type="button"
                onClick={handleAddWholeParty}
                className={cn(actionBtnClass, 'w-full mt-2')}
              >
                Add Entire Party
              </button>
            )}
          </div>
        )}
      </section>

      {/* Attached log */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
          Attached log
        </h2>
        {linkedNotes.length === 0 ? (
          <p className="text-[var(--color-text-muted)] text-sm">
            No notes attached yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {linkedNotes
              .slice()
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((n) => (
                <AttachedLogRow
                  key={n.id}
                  note={n}
                  moveToTargets={moveToTargets}
                  onMove={async (targetId) => {
                    await reassignNote(n.id, targetId);
                    await refreshEncounter();
                  }}
                />
              ))}
          </ul>
        )}
      </section>

      {/* Relations */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
          Relations
        </h2>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              Started during:
            </span>
            {parentEncounter ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--color-surface-raised)] text-[var(--color-text)] text-xs">
                {parentEncounter.title}
              </span>
            ) : (
              <span className="text-xs text-[var(--color-text-muted)]">—</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              Sub-encounters:
            </span>
            {childEncounters.length > 0 ? (
              childEncounters.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--color-surface-raised)] text-[var(--color-text)] text-xs"
                >
                  {c.title}
                </span>
              ))
            ) : (
              <span className="text-xs text-[var(--color-text-muted)]">—</span>
            )}
          </div>
        </div>
      </section>

      {/* End Encounter button */}
      {encounter.status === 'active' && (
        <footer>
          <button
            type="button"
            onClick={() => setShowEndDialog(true)}
            className="w-full min-h-11 px-4 py-2 bg-red-600 text-white border-none rounded-lg text-sm font-semibold cursor-pointer"
          >
            End Encounter
          </button>
        </footer>
      )}

      {/* Participant picker modal */}
      {showParticipantPicker && (
        <div
          role="dialog"
          aria-label="Add participant"
          onClick={() => setShowParticipantPicker(false)}
          className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--color-surface)] rounded-t-2xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto"
          >
            <EncounterParticipantPicker
              campaignId={encounter.campaignId}
              onSelect={async (entity) => {
                await addParticipantFromTemplate(entity);
              }}
              onClose={() => setShowParticipantPicker(false)}
            />
          </div>
        </div>
      )}

      {/* End encounter dialog — dismiss does NOT end the encounter. */}
      <Dialog
        open={showEndDialog}
        onOpenChange={(open) => {
          if (!open && !submittingEnd) {
            setShowEndDialog(false);
            setEndSummary(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Encounter</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              Optional summary — what happened?
            </p>
            <TiptapNoteEditor
              initialContent={endSummary}
              onChange={setEndSummary}
              campaignId={encounter.campaignId}
              placeholder="Wrap-up…"
              showToolbar={false}
              minHeight="120px"
            />
          </DialogBody>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                if (!submittingEnd) {
                  setShowEndDialog(false);
                  setEndSummary(null);
                }
              }}
              className={actionBtnClass}
              disabled={submittingEnd}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEndSubmit}
              disabled={submittingEnd}
              className={cn(
                'min-h-11 px-4 py-2 bg-red-600 text-white border-none rounded-lg text-sm font-semibold cursor-pointer',
                submittingEnd && 'opacity-60',
              )}
            >
              {submittingEnd ? 'Ending…' : 'End Encounter'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * One row in the Attached log list. Tracks its own open/closed state for the
 * Move-to inline picker so a click on one row doesn't disturb others.
 */
function AttachedLogRow({
  note,
  moveToTargets,
  onMove,
}: {
  note: { id: string; title: string; type: string; createdAt: string };
  moveToTargets: Encounter[];
  onMove: (targetId: string | null) => Promise<void>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <li className="flex flex-col gap-1 px-2 py-1 bg-[var(--color-surface-raised)] rounded">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--color-text)]">
          <strong className="uppercase text-[10px] tracking-wide text-[var(--color-text-muted)] mr-2">
            {note.type}
          </strong>
          {note.title}
          <span className="text-xs text-[var(--color-text-muted)] ml-2">
            {new Date(note.createdAt).toLocaleTimeString()}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] min-h-11 px-2"
        >
          Move to…
        </button>
      </div>
      {pickerOpen && (
        <div className="flex flex-col gap-1 pt-1 pl-2 border-l border-[var(--color-border)]">
          <button
            type="button"
            onClick={async () => {
              setPickerOpen(false);
              await onMove(null);
            }}
            className="text-left text-xs text-[var(--color-text)] hover:text-[var(--color-accent)] min-h-9"
          >
            Detach (session-level)
          </button>
          {moveToTargets.length === 0 && (
            <span className="text-xs text-[var(--color-text-muted)]">
              No other in-session encounters.
            </span>
          )}
          {moveToTargets.map((enc) => (
            <button
              key={enc.id}
              type="button"
              onClick={async () => {
                setPickerOpen(false);
                await onMove(enc.id);
              }}
              className="text-left text-xs text-[var(--color-text)] hover:text-[var(--color-accent)] min-h-9"
            >
              {enc.title}{' '}
              <span className="text-[var(--color-text-muted)]">
                ({enc.status})
              </span>
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
