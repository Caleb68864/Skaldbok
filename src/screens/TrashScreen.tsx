import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as creatureTemplateRepository from '../storage/repositories/creatureTemplateRepository';
import * as characterRepository from '../storage/repositories/characterRepository';
import * as sessionRepository from '../storage/repositories/sessionRepository';
import * as noteRepository from '../storage/repositories/noteRepository';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { useToast } from '../context/ToastContext';
import { docToText } from '../features/notes/textToDoc';
import type { CreatureTemplate } from '../types/creatureTemplate';
import type { CharacterRecord } from '../types/character';
import type { Session } from '../types/session';
import type { Note } from '../types/note';

/** One restorable row, whatever table it came from. */
interface TrashRow {
  id: string;
  title: string;
  detail: string;
  deletedAt?: string;
  restore: () => Promise<void>;
}

interface TrashSection {
  id: string;
  heading: string;
  rows: TrashRow[];
}

/** Leading characters of a note body used as a title fallback. */
const TITLE_FALLBACK_LENGTH = 40;

function noteTitle(note: Note): string {
  if (note.title?.trim()) return note.title;
  const text = docToText(note.body).trim();
  return text ? text.slice(0, TITLE_FALLBACK_LENGTH) + (text.length > TITLE_FALLBACK_LENGTH ? '…' : '') : 'Untitled note';
}

/**
 * Everything that has been soft-deleted, with a per-row Restore.
 *
 * @remarks
 * Started as a creatures-only list under the bestiary; characters were the
 * one entity with no way back at all once their delete became a soft delete.
 * Characters are global, so they always show; sessions and notes are scoped to
 * the active campaign, because that is the only campaign whose trash the rest
 * of the UI can make sense of.
 *
 * Restore goes through each repository's `restore`, which brings back whatever
 * that entity's delete cascaded to (a character's party seat and encounter
 * edges; a note's links and KB node).
 */
export default function TrashScreen() {
  const navigate = useNavigate();
  const { activeCampaign } = useCampaignContext();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<TrashSection[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const campaignId = activeCampaign?.id;
      const [characters, creatures, sessions, notes] = await Promise.all([
        characterRepository.getDeleted(),
        creatureTemplateRepository.getDeleted(),
        campaignId ? sessionRepository.getDeleted(campaignId) : Promise.resolve([] as Session[]),
        campaignId ? noteRepository.getDeleted(campaignId) : Promise.resolve([] as Note[]),
      ]);
      const next: TrashSection[] = [
        {
          id: 'characters',
          heading: 'Characters',
          rows: characters.map((c: CharacterRecord) => ({
            id: c.id,
            title: c.name,
            detail: c.systemId,
            deletedAt: c.deletedAt,
            restore: () => characterRepository.restore(c.id),
          })),
        },
        {
          id: 'sessions',
          heading: 'Sessions',
          rows: sessions.map((s: Session) => ({
            id: s.id,
            title: s.title,
            detail: s.date,
            deletedAt: s.deletedAt,
            restore: () => sessionRepository.restore(s.id),
          })),
        },
        {
          id: 'notes',
          heading: 'Notes',
          rows: notes.map((n: Note) => ({
            id: n.id,
            title: noteTitle(n),
            detail: n.type,
            deletedAt: n.deletedAt,
            restore: () => noteRepository.restore(n.id),
          })),
        },
        {
          id: 'creatures',
          heading: 'Creatures',
          rows: creatures.map((c: CreatureTemplate) => ({
            id: c.id,
            title: c.name,
            detail: c.category,
            deletedAt: c.deletedAt,
            restore: () => creatureTemplateRepository.restore(c.id),
          })),
        },
      ];
      setSections(next.filter((section) => section.rows.length > 0));
    } catch (e) {
      console.error('TrashScreen.refresh failed:', e);
      showToast('Could not load the trash', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeCampaign?.id, showToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleRestore(row: TrashRow) {
    setBusyId(row.id);
    try {
      await row.restore();
      showToast(`Restored ${row.title}`, 'success');
      await refresh();
    } catch (e) {
      console.error('TrashScreen.handleRestore failed:', e);
      showToast(`Could not restore ${row.title}`, 'error');
    } finally {
      setBusyId(null);
    }
  }

  const header = (
    <div className="flex items-center justify-between mb-4">
      <button
        onClick={() => navigate(-1)}
        className="min-h-11 px-3 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-xs cursor-pointer"
      >
        ← Back
      </button>
      <h1 className="text-[var(--color-text)] text-lg m-0">Trash</h1>
    </div>
  );

  if (loading) {
    return (
      <div className="p-4">
        {header}
        <p className="text-[var(--color-text-muted)] text-sm text-center py-8" role="status">
          Loading deleted items…
        </p>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="p-4">
        {header}
        <div className="mt-6 p-6 border border-[var(--color-border)] rounded-lg text-center text-[var(--color-text-muted)] text-sm">
          Nothing deleted. Deleted characters, sessions, notes and creatures show up here with a Restore button.
          {!activeCampaign && ' Select a campaign to see its sessions and notes.'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {header}
      {sections.map((section) => (
        <section key={section.id} className="mb-6" aria-labelledby={`trash-${section.id}`}>
          <h2 id={`trash-${section.id}`} className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-2">
            {section.heading} ({section.rows.length})
          </h2>
          <ul className="flex flex-col gap-2 list-none p-0 m-0">
            {section.rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="text-[var(--color-text)] font-medium truncate">{row.title}</div>
                  <div className="text-[var(--color-text-muted)] text-xs">
                    <span className="capitalize">{row.detail}</span>
                    {row.deletedAt && <> · Deleted {new Date(row.deletedAt).toLocaleString()}</>}
                  </div>
                </div>
                <button
                  onClick={() => handleRestore(row)}
                  disabled={busyId === row.id}
                  className="shrink-0 min-h-11 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60"
                >
                  {busyId === row.id ? 'Restoring…' : 'Restore'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
