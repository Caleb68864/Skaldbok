import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { useToast } from '../context/ToastContext';
import { TRASH_ENTITY_TYPES, type TrashRow } from '../features/trash/trashRegistry';

interface TrashSection {
  id: string;
  heading: string;
  rows: TrashRow[];
}

/**
 * Everything that has been soft-deleted, with a per-row Restore.
 *
 * @remarks
 * Started as a creatures-only list under the bestiary, and grew by having each
 * new entity type hand-written into this file. Four types made it in; nine did
 * not, and every one of those nine already had a working `restore` sitting in
 * its repository with no caller. Deleting a ship, the party's shared container,
 * a ledger entry or a reference card destroyed it as far as the user was
 * concerned — some of those without even a confirmation.
 *
 * The list now lives in `features/trash/trashRegistry.ts`, and a test fails if
 * a repository grows a `getDeleted` without an entry there. This screen is only
 * the rendering.
 *
 * Restore goes through each repository's `restore`, which brings back whatever
 * that entity's delete cascaded to — a character's party seat and encounter
 * edges, a note's links and KB node, a reference card's sections.
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
      // A campaign-scoped listing needs an id, so those entries are skipped
      // rather than called with `undefined` when no campaign is active.
      const applicable = TRASH_ENTITY_TYPES.filter(
        (entity) => entity.scope === 'global' || campaignId !== undefined,
      );
      // `allSettled`, not `all`: one repository throwing must not blank the
      // whole Trash and strand every other restorable row with it.
      const results = await Promise.allSettled(
        applicable.map((entity) => entity.load(campaignId)),
      );

      const next: TrashSection[] = [];
      const failed: string[] = [];
      results.forEach((result, index) => {
        const entity = applicable[index]!;
        if (result.status === 'fulfilled') {
          next.push({ id: entity.key, heading: entity.heading, rows: result.value });
        } else {
          failed.push(entity.heading);
          console.error(`TrashScreen: ${entity.key} failed to load`, result.reason);
        }
      });

      setSections(next.filter((section) => section.rows.length > 0));
      if (failed.length > 0) {
        showToast(`Could not load: ${failed.join(', ')}`, 'error');
      }
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
          Nothing deleted. Anything you delete shows up here with a Restore button.
          {!activeCampaign && ' Select a campaign to see everything scoped to it.'}
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
