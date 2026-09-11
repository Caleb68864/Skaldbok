import { useCallback } from 'react';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useToast } from '../../context/ToastContext';
import { useAppState } from '../../context/AppStateContext';
import { getNoteById, getNotesByCampaign, getNotesBySession } from '../../storage/repositories/noteRepository';
import { getLinksFrom } from '../../storage/repositories/entityLinkRepository';
import { getSessionById, getSessionsByCampaign } from '../../storage/repositories/sessionRepository';
import { getAttachmentsByNote } from '../../storage/repositories/attachmentRepository';
import { renderNoteToMarkdown } from '../../utils/export/renderNote';
import { buildAttachmentFiles } from '../../utils/export/attachmentFiles';
import { safeAttachmentFilename } from '../../utils/attachmentFilename';
import { renderSessionBundle } from '../../utils/export/renderSession';
import { renderCampaignIndex } from '../../utils/export/renderCampaignIndex';
import { bundleToZip } from '../../utils/export/bundleToZip';
import { shareFile, copyToClipboard } from '../../utils/export/delivery';
import { generateFilename, generateEntityFilename } from '../../utils/export/generateFilename';
import * as ledgerRepository from '../../storage/repositories/ledgerRepository';
import * as ledgerAccountRepository from '../../storage/repositories/ledgerAccountRepository';
import * as recurringBillRepository from '../../storage/repositories/recurringBillRepository';
import * as routeRepository from '../../storage/repositories/routeRepository';
import * as systemRepository from '../../storage/repositories/systemRepository';
import { getEngine } from '../systems/engine';
import { renderLedgerToMarkdown } from '../../utils/export/renderLedger';
import { renderRouteToMarkdown } from '../../utils/export/renderRoute';
import { collectCharacterBundle, collectSessionBundle, collectCampaignBundle } from '../../utils/export/collectors';
import { excludePrivateNotes, PrivacyLeakError } from '../../utils/export/privacyFilter';
import { serializeBundle, deliverBundle } from '../../utils/export/bundleSerializer';
import type { Note } from '../../types/note';
import type { EntityLink } from '../../types/entityLink';
import type { Campaign } from '../../types/campaign';

/**
 * Hook that provides all note and session export actions for the active campaign.
 *
 * @remarks
 * Every action is null-safe with respect to the active campaign — calling any
 * function when `activeCampaign` is null shows a toast and returns early.
 * Errors are caught internally; the caller never needs to handle rejections.
 *
 * @returns An object containing five export helpers:
 * - `exportNote` — share a single note as Markdown (or ZIP if it has attachments)
 * - `exportSessionMarkdown` — share a session's index Markdown file
 * - `exportSessionBundle` — share all session notes + attachments as a ZIP
 * - `exportAllNotes` — share every campaign note as a ZIP
 * - `copyNoteAsMarkdown` — copy a single note's Markdown to the clipboard
 *
 * @example
 * ```tsx
 * const { exportNote, copyNoteAsMarkdown } = useExportActions();
 * <button onClick={() => exportNote(note.id)}>Export</button>
 * ```
 */
/**
 * Renders the campaign's cashbook as Markdown, or `null` when it is empty.
 *
 * @remarks
 * Shared by the standalone ledger export and by both session exports, so the
 * books read identically wherever they surface. Returns `null` rather than an
 * empty document — a session bundle should not carry a `ledger.md` that only
 * says "no entries yet".
 */
async function buildLedgerMarkdown(campaign: Campaign): Promise<string | null> {
  const entries = await ledgerRepository.listByCampaign(campaign.id);
  if (entries.length === 0) return null;
  const system = await systemRepository.getById(campaign.system);
  const engine = system ? getEngine(system) : null;
  const formatMoney = engine?.currency.formatAmount ?? ((baseUnits: number) => String(baseUnits));
  // Accounts and bills as well as entries: the export used to carry the
  // movements alone, which lost the mortgage, the escrow and the monthly nut —
  // and folded a Balance column that no longer matched the screen.
  const [accounts, bills] = await Promise.all([
    ledgerAccountRepository.listByCampaign(campaign.id),
    recurringBillRepository.listByCampaign(campaign.id),
  ]);
  return renderLedgerToMarkdown(campaign.name, entries, formatMoney, {
    accounts,
    bills,
    campaignDate: campaign.campaignDate,
    calendar: system?.calendar ?? system?.routePlanner?.calendar,
    reservePotLabel: engine?.terms.reservePot,
  });
}

/**
 * The toast for an export the privacy check refused, or `null` for anything else.
 *
 * @remarks
 * `serializeBundle` fails closed when a private note is still referenced by the
 * bundle it was about to produce. That is not "try again" — retrying produces
 * the same refusal — and it is the one export failure whose cause the user needs
 * to know, because the alternative outcome was their private note leaving the
 * device. So it gets its own message instead of the generic one.
 */
function privacyBlockedMessage(err: unknown): string | null {
  if (!(err instanceof PrivacyLeakError)) return null;
  return 'Export stopped: a private note could not be fully excluded. Nothing was saved.';
}

export function useExportActions() {
  const { activeCampaign } = useCampaignContext();
  const { showToast } = useToast();
  const { updateSettings } = useAppState();

  /**
   * Exports a single note as a Markdown file, or as a ZIP archive when the note
   * has one or more attachments (images are placed in an `attachments/` folder
   * alongside auto-generated sidecar Markdown files).
   *
   * @param noteId - ID of the note to export.
   * @returns A promise that resolves when the file has been handed to the share
   * sheet / download mechanism, or immediately on early-exit conditions.
   */
  const exportNote = useCallback(async (noteId: string): Promise<void> => {
    if (!activeCampaign) {
      showToast('No active campaign');
      return;
    }
    try {
      const note = await getNoteById(noteId);
      if (!note) { showToast('Note not found'); return; }

      const links = [
        ...(await getLinksFrom(noteId, 'introduced_in')),
        ...(await getLinksFrom(noteId, 'contains')),
      ] as EntityLink[];
      // The wiki-link resolution corpus, privacy-filtered like every other
      // shareable render. `exportAllNotes` already filtered it and these two
      // single-note paths did not, so a mention of a private note resolved to
      // `[[Its Real Title]]` here and degraded to plain text there — the same
      // rule at two exits, disagreeing. Unresolved is the correct outcome: the
      // target is not in the export.
      const allNotes = excludePrivateNotes(await getNotesByCampaign(activeCampaign.id));
      const attachments = await getAttachmentsByNote(noteId);
      // Must match the ZIP entry names, which are sanitised — see
      // safeAttachmentFilename — or the wiki-links point at files that are not there.
      const attachmentFilenames = attachments.map(a => safeAttachmentFilename(a.filename));
      const markdown = renderNoteToMarkdown(note, links, allNotes, attachmentFilenames);

      if (attachments.length === 0) {
        const blob = new Blob([markdown], { type: 'text/markdown' });
        await shareFile(blob, generateFilename(note));
      } else {
        const filesMap = new Map<string, string | Blob>();
        filesMap.set(generateFilename(note), markdown);
        for (const [path, contents] of await buildAttachmentFiles([note], async () => attachments, 'attachments')) {
          filesMap.set(path, contents);
        }
        const zipBlob = await bundleToZip(filesMap);
        await shareFile(zipBlob, generateFilename(note).replace('.md', '.zip'));
      }
    } catch (e) {
      showToast('Export failed');
      console.error('useExportActions.exportNote failed:', e);
    }
  }, [activeCampaign, showToast]);

  /**
   * Exports the index Markdown file for a single session (the top-level summary
   * document without individual note files).
   *
   * @remarks
   * Notes are resolved by `sessionId` first; any additional notes linked to the
   * session via `contains` entity-links are merged in without duplication.
   *
   * @param sessionId - ID of the session to export.
   * @returns A promise that resolves when the file has been shared, or immediately
   * on early-exit conditions.
   */
  const exportSessionMarkdown = useCallback(async (sessionId: string): Promise<void> => {
    if (!activeCampaign) {
      showToast('No active campaign');
      return;
    }
    try {
      const session = await getSessionById(sessionId);
      if (!session) { showToast('Session not found'); return; }

      // Get notes by sessionId (primary) + any entity-linked notes as fallback
      const sessionNotes = await getNotesBySession(sessionId);
      const containsLinks = await getLinksFrom(sessionId, 'contains');
      const linkedNoteIds = containsLinks.map(l => l.toEntityId);
      const linkedNotes: Note[] = [...sessionNotes];
      const seenIds = new Set(sessionNotes.map(n => n.id));
      for (const nid of linkedNoteIds) {
        if (seenIds.has(nid)) continue;
        const n = await getNoteById(nid);
        if (n) linkedNotes.push(n);
      }

      // Shareable output: drop explicitly-private notes before rendering, and
      // gather links only for what survives, so a private note leaves no trace
      // in the front matter either. The JSON bundle paths already do this via
      // applyPrivacyFilter; these Markdown paths had no filtering at all.
      const shareableNotes = excludePrivateNotes(linkedNotes);

      const allEntityLinks: EntityLink[] = [];
      for (const note of shareableNotes) {
        const noteLinks = await getLinksFrom(note.id, 'introduced_in');
        allEntityLinks.push(...noteLinks);
      }

      const filesMap = renderSessionBundle(session, shareableNotes, allEntityLinks);
      // Export just the session index
      const sessionFilename = generateFilename({ title: session.title, id: session.id });
      const sessionMarkdown = filesMap.get(sessionFilename) ?? filesMap.values().next().value ?? '';

      // This path is a single file, so the cashbook is appended rather than
      // shipped alongside — the zip path gets its own `ledger.md` instead.
      const ledger = await buildLedgerMarkdown(activeCampaign);
      const combined = ledger
        ? `${sessionMarkdown}\n\n---\n\n${ledger.replace(/^---\n[\s\S]*?\n---\n/, '')}`
        : sessionMarkdown;

      const blob = new Blob([combined], { type: 'text/markdown' });
      await shareFile(blob, sessionFilename);
    } catch (e) {
      showToast('Export failed');
      console.error('useExportActions.exportSessionMarkdown failed:', e);
    }
  }, [activeCampaign, showToast]);

  /**
   * Exports a full session bundle as a ZIP archive: the session index, individual
   * note Markdown files, and any attachment images with their sidecar files.
   * Attachments are placed under `attachments/<session-slug>/`.
   *
   * @remarks
   * Notes are resolved by `sessionId` first; notes linked via `contains`
   * entity-links are merged in without duplication.
   *
   * @param sessionId - ID of the session to export.
   * @returns A promise that resolves when the ZIP has been shared, or immediately
   * on early-exit conditions.
   */
  const exportSessionBundle = useCallback(async (sessionId: string): Promise<void> => {
    if (!activeCampaign) {
      showToast('No active campaign');
      return;
    }
    try {
      const session = await getSessionById(sessionId);
      if (!session) { showToast('Session not found'); return; }

      // Get notes by sessionId (primary) + any entity-linked notes as fallback
      const sessionNotes = await getNotesBySession(sessionId);
      const containsLinks = await getLinksFrom(sessionId, 'contains');
      const linkedNoteIds = containsLinks.map(l => l.toEntityId);
      const linkedNotes: Note[] = [...sessionNotes];
      const seenIds = new Set(sessionNotes.map(n => n.id));
      for (const nid of linkedNoteIds) {
        if (seenIds.has(nid)) continue;
        const n = await getNoteById(nid);
        if (n) linkedNotes.push(n);
      }

      // Shareable output: drop explicitly-private notes before rendering, and
      // gather links only for what survives, so a private note leaves no trace
      // in the front matter either. The JSON bundle paths already do this via
      // applyPrivacyFilter; these Markdown paths had no filtering at all.
      const shareableNotes = excludePrivateNotes(linkedNotes);

      const allEntityLinks: EntityLink[] = [];
      for (const note of shareableNotes) {
        const noteLinks = await getLinksFrom(note.id, 'introduced_in');
        allEntityLinks.push(...noteLinks);
      }

      const textFilesMap = renderSessionBundle(session, shareableNotes, allEntityLinks);
      const filesMap = new Map<string, string | Blob>(textFilesMap);
      const sessionSlug = session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');

      // The cashbook ships with the session it was written during. A session
      // bundle is the record of an evening at the table, and "what did this
      // cost us" is part of that record — asking the reader to fetch a second
      // export to answer it defeats the point of a bundle.
      const ledger = await buildLedgerMarkdown(activeCampaign);
      if (ledger) filesMap.set('ledger.md', ledger);

      // shareableNotes, not linkedNotes: a private note's photos and their
      // sidecars (which carry the note's title) were being written into the ZIP
      // even though the note's text was filtered out of the Markdown above.
      const attachmentFiles = await buildAttachmentFiles(
        shareableNotes,
        getAttachmentsByNote,
        `attachments/${sessionSlug}`,
      );
      for (const [path, contents] of attachmentFiles) filesMap.set(path, contents);

      const zipBlob = await bundleToZip(filesMap);
      const zipFilename = generateFilename({ title: session.title, id: session.id }).replace('.md', '.zip');
      await shareFile(zipBlob, zipFilename);
    } catch (e) {
      showToast('Export failed');
      console.error('useExportActions.exportSessionBundle failed:', e);
    }
  }, [activeCampaign, showToast]);

  /**
   * Copies the Markdown representation of a single note to the system clipboard.
   * Shows a "Copied to clipboard" toast on success.
   *
   * @param noteId - ID of the note to copy.
   * @returns A promise that resolves when the clipboard write completes, or
   * immediately on early-exit conditions.
   */
  const copyNoteAsMarkdown = useCallback(async (noteId: string): Promise<void> => {
    if (!activeCampaign) {
      showToast('No active campaign');
      return;
    }
    try {
      const note = await getNoteById(noteId);
      if (!note) { showToast('Note not found'); return; }

      const links = [
        ...(await getLinksFrom(noteId, 'introduced_in')),
        ...(await getLinksFrom(noteId, 'contains')),
      ] as EntityLink[];
      // Privacy-filtered corpus, for the same reason as `exportNote` above.
      const allNotes = excludePrivateNotes(await getNotesByCampaign(activeCampaign.id));

      const markdown = renderNoteToMarkdown(note, links, allNotes);
      await copyToClipboard(markdown);
      showToast('Copied to clipboard');
    } catch (e) {
      showToast('Copy failed');
      console.error('useExportActions.copyNoteAsMarkdown failed:', e);
    }
  }, [activeCampaign, showToast]);

  /**
   * Exports every note in the active campaign as a single ZIP archive.
   * Each note becomes a Markdown file; attachments are placed in
   * `attachments/<session-prefix>/` (or `attachments/unsorted/` for session-less notes)
   * alongside auto-generated sidecar files.
   *
   * @remarks
   * Shows a "No notes to export" toast when the campaign has no notes yet.
   *
   * @returns A promise that resolves when the ZIP has been shared, or immediately
   * on early-exit conditions.
   */
  const exportAllNotes = useCallback(async (): Promise<void> => {
    if (!activeCampaign) {
      showToast('No active campaign');
      return;
    }
    try {
      // Private notes are excluded: this writes a shareable ZIP, and the JSON
       // bundle paths below already filter. Without this the two export routes
       // disagreed about what "private" means.
      const allNotes = excludePrivateNotes(await getNotesByCampaign(activeCampaign.id));
      if (allNotes.length === 0) {
        showToast('No notes to export');
        return;
      }

      const filesMap = new Map<string, string | Blob>();
      for (const note of allNotes) {
        const links = [
          ...(await getLinksFrom(note.id, 'introduced_in')),
          ...(await getLinksFrom(note.id, 'contains')),
        ] as EntityLink[];
        const attachments = await getAttachmentsByNote(note.id);
        // Must match the ZIP entry names, which are sanitised — see
      // safeAttachmentFilename — or the wiki-links point at files that are not there.
      const attachmentFilenames = attachments.map(a => safeAttachmentFilename(a.filename));
        const markdown = renderNoteToMarkdown(note, links, allNotes, attachmentFilenames);
        const filename = generateFilename(note);
        filesMap.set(filename, markdown);

        const folder = note.sessionId
          ? `attachments/${note.sessionId.slice(0, 8)}`
          : 'attachments/unsorted';
        for (const [path, contents] of await buildAttachmentFiles([note], async () => attachments, folder)) {
          filesMap.set(path, contents);
        }
      }

      // Landing page for the exported vault. `renderCampaignIndex` existed with
      // no caller while every sibling renderer was wired in, so a campaign export
      // shipped a flat pile of notes with nothing linking them together. Written
      // last so it can list what actually made it past the privacy filter.
      const sessions = await getSessionsByCampaign(activeCampaign.id);
      const npcs = allNotes.filter(n => n.type === 'npc');
      const openRumors = allNotes.filter(n => n.type === 'rumor' && n.status !== 'archived');
      filesMap.set('index.md', renderCampaignIndex(activeCampaign, sessions, npcs, openRumors));

      const zipBlob = await bundleToZip(filesMap);
      const zipFilename = `${activeCampaign.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-all-notes.zip`;
      await shareFile(zipBlob, zipFilename);
    } catch (e) {
      showToast('Export failed');
      console.error('useExportActions.exportAllNotes failed:', e);
    }
  }, [activeCampaign, showToast]);

  /**
   * Exports a character as a `.skaldbok.json` bundle.
   *
   * @param characterId - ID of the character to export.
   * @param includePrivate - If true, includes private notes in the export.
   */
  const exportCharacter = useCallback(async (characterId: string, includePrivate = false): Promise<void> => {
    try {
      const result = await collectCharacterBundle(characterId);
      if (!result.success) {
        showToast(`Export failed: ${result.error}`);
        return;
      }
      const json = await serializeBundle('character', result.contents, { includePrivate });
      const slug = `character-${characterId.slice(0, 8)}-${Date.now()}`;
      await deliverBundle(slug, json);
      showToast('Character exported');
    } catch (err) {
      showToast(privacyBlockedMessage(err) ?? 'Export failed. Please try again.');
      console.error('[useExportActions] exportCharacter error', err);
    }
  }, [showToast]);

  /**
   * Exports a session as a `.skaldbok.json` bundle (includes encounters, templates, etc.).
   *
   * @param sessionId - ID of the session to export.
   * @param includePrivate - If true, includes private notes in the export.
   */
  const exportSessionSkaldmark = useCallback(async (sessionId: string, includePrivate = false): Promise<void> => {
    try {
      const result = await collectSessionBundle(sessionId);
      if (!result.success) {
        showToast(`Export failed: ${result.error}`);
        return;
      }
      const json = await serializeBundle('session', result.contents, { includePrivate });
      const slug = `session-${sessionId.slice(0, 8)}-${Date.now()}`;
      await deliverBundle(slug, json);
      showToast('Session exported');
    } catch (err) {
      showToast(privacyBlockedMessage(err) ?? 'Export failed. Please try again.');
      console.error('[useExportActions] exportSessionSkaldmark error', err);
    }
  }, [showToast]);

  /**
   * Exports a campaign as a `.skaldbok.json` bundle (includes all entity types).
   *
   * @param campaignId - ID of the campaign to export.
   * @param includePrivate - If true, includes private notes in the export.
   */
  const exportCampaign = useCallback(async (campaignId: string, includePrivate = false): Promise<void> => {
    try {
      const result = await collectCampaignBundle(campaignId);
      if (!result.success) {
        showToast(`Export failed: ${result.error}`);
        return;
      }
      const json = await serializeBundle('campaign', result.contents, { includePrivate });
      const slug = `campaign-${campaignId.slice(0, 8)}-${Date.now()}`;
      const outcome = await deliverBundle(slug, json);
      if (outcome === 'cancelled') {
        // The user dismissed the share sheet. Nothing left the device, so the
        // reminder must not reset and the toast must not say it did.
        showToast('Export cancelled');
        return;
      }
      // Recorded only here, and only after delivery succeeded. This is the one
      // export that produces something able to restore a campaign, so it is the
      // only one that may claim the app is backed up — see `lastBackupAt`.
      //
      // "Succeeded" now means something: `deliverBundle` reports an outcome and
      // throws when it cannot start the transfer. It used to resolve `void` off
      // a `.click()` on a detached anchor whose object URL was revoked on the
      // next line — a DOM call with no failure mode, turning the safety card
      // green whether or not a file was ever written.
      void updateSettings({ lastBackupAt: new Date().toISOString() });
      showToast('Campaign exported');
    } catch (err) {
      showToast(privacyBlockedMessage(err) ?? 'Export failed. Please try again.');
      console.error('[useExportActions] exportCampaign error', err);
    }
  }, [showToast, updateSettings]);

  /**
   * Exports the active campaign's cashbook as Markdown.
   *
   * @remarks
   * Money is rendered through the campaign system's own engine, so a Traveller
   * book exports credits and a Dragonbane one exports coins from the same
   * stored integers.
   *
   * Deliberately **not** privacy-filtered, unlike the note paths above: a
   * campaign cashbook is shared crew data by definition and entries carry no
   * private flag. See `docs/decisions.md`, 2026-08-08.
   */
  const exportLedger = useCallback(async (): Promise<void> => {
    if (!activeCampaign) {
      showToast('No active campaign');
      return;
    }
    try {
      const markdown = await buildLedgerMarkdown(activeCampaign);
      if (!markdown) {
        showToast('The ledger is empty');
        return;
      }
      const blob = new Blob([markdown], { type: 'text/markdown' });
      await shareFile(
        blob,
        generateEntityFilename({
          title: `${activeCampaign.name} ledger`,
          suffix: activeCampaign.id,
          fallback: 'ledger',
        }),
      );
    } catch (err) {
      showToast('Export failed');
      console.error('[useExportActions] exportLedger error', err);
    }
  }, [activeCampaign, showToast]);

  /**
   * Exports the active campaign's route as Markdown.
   *
   * @remarks
   * Columns come from the system's `routePlanner` declaration. A system that
   * declares no planner has no route to export and says so rather than
   * producing an empty file.
   */
  const exportRoute = useCallback(async (): Promise<void> => {
    if (!activeCampaign) {
      showToast('No active campaign');
      return;
    }
    try {
      const system = await systemRepository.getById(activeCampaign.system);
      const planner = system?.routePlanner;
      if (!planner) {
        showToast('This system has no route planner');
        return;
      }
      const stops = await routeRepository.listByCampaign(activeCampaign.id);
      const markdown = renderRouteToMarkdown(
        activeCampaign.name,
        planner.label,
        stops,
        planner.fields,
        planner.distanceFieldId,
      );
      const blob = new Blob([markdown], { type: 'text/markdown' });
      await shareFile(
        blob,
        generateEntityFilename({
          title: `${activeCampaign.name} ${planner.label}`,
          suffix: activeCampaign.id,
          fallback: 'route',
        }),
      );
    } catch (err) {
      showToast('Export failed');
      console.error('[useExportActions] exportRoute error', err);
    }
  }, [activeCampaign, showToast]);

  return {
    exportNote,
    exportSessionMarkdown,
    exportSessionBundle,
    exportAllNotes,
    copyNoteAsMarkdown,
    exportCharacter,
    exportSessionSkaldmark,
    exportCampaign,
    exportLedger,
    exportRoute,
  };
}
