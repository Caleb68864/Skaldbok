import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InkPad } from '../../../components/notes/InkPad';
import { PenHelpPanel } from '../../../components/notes/PenHelpPanel';
import { WritePad } from '../../../components/notes/WritePad';
import { useCampaignContext } from '../../campaign/CampaignContext';
import { useToast } from '../../../context/ToastContext';
import * as noteRepository from '../../../storage/repositories/noteRepository';
import { generateSoftDeleteTxId } from '../../../utils/softDelete';
import { createPenObservationTracker, detectPenCapability } from '../../notes/ink/penCapability';
import { deserializeStrokePage, strokeBounds, type Stroke, type StrokePage } from '../../notes/ink/strokeModel';
import { textToDoc, docToText } from '../../notes/textToDoc';
import { SessionLogSelection } from './SessionLogSelection';
import type { Note } from '../../../types/note';

/** Which capture surface the pad slot is showing. Text is always the default. */
type CaptureMode = 'text' | 'ink';

/** A fresh, empty ink page. Never mutated — every update replaces the object. */
const EMPTY_INK_PAGE: StrokePage = { version: 1, strokes: [], pageHeight: 0 };

/** Bounded raster size for a committed ink entry's read-only preview. */
const INK_PREVIEW_WIDTH = 280;
const INK_PREVIEW_HEIGHT = 96;

/**
 * Read-only, bounded raster of a committed ink entry.
 *
 * @remarks
 * An ink log entry has an empty ProseMirror body by design, so without this it
 * renders as a blank row — indistinguishable from data loss. The strokes are
 * scaled to fit a fixed preview box rather than rendered at page scale; this is
 * a glance-and-recognise thumbnail, not an editing surface.
 */
function InkEntryPreview({ note }: { note: Note }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const page = useMemo(() => noteRepository.readInkPage(note), [note]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (page.strokes.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const stroke of page.strokes) {
      const bounds = strokeBounds(stroke);
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    }
    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    // Never scale up: a two-word note should read as two words, not as a
    // blown-up smear filling the row.
    const scale = Math.min(canvas.width / contentWidth, canvas.height / contentHeight, 1);

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-minX, -minY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of page.strokes) {
      if (stroke.points.length === 0) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
      ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.35 : 1;
      ctx.lineWidth = stroke.width;
      const [firstX, firstY] = stroke.points[0];
      ctx.moveTo(firstX, firstY);
      for (let i = 1; i < stroke.points.length; i += 1) {
        const [x, y] = stroke.points[i];
        ctx.lineTo(x, y);
      }
      if (stroke.points.length === 1) ctx.lineTo(firstX + 0.01, firstY + 0.01);
      ctx.stroke();
    }
    ctx.restore();
  }, [page]);

  return (
    <canvas
      ref={canvasRef}
      width={INK_PREVIEW_WIDTH}
      height={INK_PREVIEW_HEIGHT}
      role="img"
      aria-label="Handwritten log entry"
      className="max-w-full"
    />
  );
}

/**
 * Whether a note carries an ink `typeData` payload with strokes in it.
 *
 * @remarks
 * Delegates to the repository's structural check rather than deserializing.
 * This is called once per entry per render from `renderEntry`, and the decoding
 * version made the log's render cost scale with the number of ink *points* on
 * screen — on the surface that stays open for a whole session.
 */
function hasInkPayload(note: Note): boolean {
  return noteRepository.hasInkPage(note);
}

/** Prefix shared by every parked draft for one session, across tabs. */
function draftKeyPrefix(sessionId: string): string {
  return `skaldbok-log-draft-${sessionId}-`;
}

/**
 * Id identifying this browser tab, stable for its lifetime.
 *
 * @remarks
 * Held in `sessionStorage`, which is per-tab by definition, so a second tab gets
 * a different one. The draft key needs it because two tabs open on the same
 * session previously shared a single key and overwrote each other's in-progress
 * text on every keystroke.
 */
function tabId(): string {
  const KEY = 'skaldbok-tab-id';
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Private-mode or disabled storage: fall back to a per-mount id. Drafts
    // then do not survive a remount, which is strictly better than two tabs
    // silently destroying each other's work.
    return 'ephemeral';
  }
}

/** localStorage key holding this tab's unsaved pad draft for one session. */
function draftKey(sessionId: string): string {
  return `${draftKeyPrefix(sessionId)}${tabId()}`;
}

/** The unsaved pad state parked in localStorage between mounts. */
interface ParkedDraft {
  text: string;
  /** Id of the entry being edited, so a restored draft updates rather than duplicates. */
  editingId: string | null;
  /** When it was parked, used to pick the newest when adopting an orphan. */
  savedAt?: number;
  /**
   * Uncommitted handwriting, parked on the same terms as the text.
   *
   * @remarks
   * The pad sits in a sheet that closes on an outside tap, and a page of
   * handwriting is the most expensive thing on this screen to lose — it cannot
   * be retyped from memory the way a sentence can. Absent on drafts parked
   * before this existed, hence optional.
   */
  ink?: StrokePage;
  /** Which surface was open, so reopening lands where the user left off. */
  mode?: CaptureMode;
}

/** Parses a stored draft, tolerating absent or corrupt values. */
function parseDraft(raw: string | null): ParkedDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ParkedDraft;
    if (typeof parsed?.text !== 'string') return null;
    // Ink goes through the permissive deserializer, so a corrupt page costs the
    // malformed strokes rather than the whole parked draft, text included.
    const ink = parsed.ink === undefined ? undefined : deserializeStrokePage(parsed.ink);
    return {
      text: parsed.text,
      editingId: parsed.editingId ?? null,
      savedAt: parsed.savedAt,
      ink,
      mode: parsed.mode === 'ink' ? 'ink' : undefined,
    };
  } catch {
    return null;
  }
}

/** Whether a parked draft holds anything worth restoring. */
function draftHasContent(draft: ParkedDraft): boolean {
  return draft.text.trim() !== '' || (draft.ink?.strokes.length ?? 0) > 0;
}

/**
 * Reads this tab's parked draft, adopting an orphan from a previous tab when
 * this one has none.
 *
 * @remarks
 * Keying by tab stops two open tabs clobbering each other, but on its own it
 * would also lose the draft whenever the app is closed and reopened, since that
 * is a new tab id. So a tab with no draft of its own takes over the newest one
 * left for this session and deletes the original — the common case (reopening
 * the PWA) recovers the text, while two *live* tabs never share a key because
 * the second one writes under its own id from its first keystroke.
 */
function readParkedDraft(sessionId: string): ParkedDraft | null {
  try {
    const own = parseDraft(localStorage.getItem(draftKey(sessionId)));
    if (own) return own;

    const prefix = draftKeyPrefix(sessionId);
    let bestKey: string | null = null;
    let best: ParkedDraft | null = null;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const candidate = parseDraft(localStorage.getItem(key));
      if (!candidate) continue;
      if (!best || (candidate.savedAt ?? 0) > (best.savedAt ?? 0)) {
        best = candidate;
        bestKey = key;
      }
    }
    if (best && bestKey) {
      localStorage.setItem(draftKey(sessionId), JSON.stringify(best));
      localStorage.removeItem(bestKey);
    }
    return best;
  } catch {
    return null;
  }
}

/**
 * In-session capture screen: chronological committed log entries with a
 * docked {@link WritePad}. Tap an entry to edit it in place; long-press to
 * select. Selection, promotion, deletion and the review sweep are handled by
 * {@link SessionLogSelection}.
 *
 * @remarks
 * Deletion deliberately does **not** live on a row long-press. It used to, and
 * that gesture is also what a touch device fires to enter selection mode, so a
 * long-press meant to select an entry silently soft-deleted it — with no
 * confirmation and no undo. Delete now lives in the selection action bar,
 * behind an explicit tap, and reports an Undo toast.
 */
export function SessionLog() {
  const { activeCampaign, activeSession, startSession } = useCampaignContext();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [padOpen, setPadOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Capture mode always starts on the text pad. Approach A is the path that
  // yields text, so ink is strictly opt-in and never the default — including
  // on a device that plainly has a pen.
  const [captureMode, setCaptureMode] = useState<CaptureMode>('text');
  const [inkPage, setInkPage] = useState<StrokePage>(EMPTY_INK_PAGE);
  const penTrackerRef = useRef(createPenObservationTracker());
  // Feature detection only — never a user-agent sniff. `pointer: fine` covers
  // the desktop/dev case, `navigator.ink` the low-latency-ink case, and the
  // observation tracker catches an S Pen that only announces itself when it
  // actually touches the screen.
  const [penAvailable, setPenAvailable] = useState(() => {
    const capability = detectPenCapability();
    return capability.pointerFine || capability.inkAPI;
  });
  const inkHostRef = useRef<HTMLDivElement>(null);
  const [inkViewport, setInkViewport] = useState({ width: 0, height: 0 });

  const notePenPointer = useCallback((pointerType: string) => {
    penTrackerRef.current.recordPointerType(pointerType);
    if (penTrackerRef.current.hasObservedPen()) setPenAvailable(true);
  }, []);

  const refresh = useCallback(async () => {
    if (!activeSession) {
      setEntries([]);
      return;
    }
    const rows = await noteRepository.listLogEntriesBySession(activeSession.id);
    setEntries(rows);
  }, [activeSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Rehydrate whatever was being typed when this component last unmounted.
  // The pad lives inside a sheet that closes on an outside tap, so without
  // this an interrupted sentence is lost with no warning — the worst possible
  // failure for a capture surface used mid-session.
  useEffect(() => {
    if (!activeSession) return;
    const parked = readParkedDraft(activeSession.id);
    if (!parked) return;
    setDraft(parked.text);
    setEditingId(parked.editingId);
    if (parked.ink) setInkPage(parked.ink);
    // Only follow a parked mode of 'ink', and only with strokes to show for it.
    // Text stays the default on every other path — see the capture-mode state.
    if (parked.mode === 'ink' && (parked.ink?.strokes.length ?? 0) > 0) setCaptureMode('ink');
    if (draftHasContent(parked)) setPadOpen(true);
  }, [activeSession]);

  // Park the draft on every keystroke, and the ink page on every stroke.
  // localStorage is the right store here: this is transient UI state, not a
  // domain record, and writing it into IndexedDB would mean a schema version
  // for something deliberately throwaway.
  useEffect(() => {
    if (!activeSession) return;
    const key = draftKey(activeSession.id);
    const hasInk = inkPage.strokes.length > 0;
    // Clearing needs BOTH surfaces empty. Keyed on the text alone, committing
    // an ink page (which leaves the text empty) deleted the parked record while
    // the other surface still held content.
    if (draft.trim() === '' && !hasInk) {
      localStorage.removeItem(key);
      return;
    }
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          text: draft,
          editingId,
          savedAt: Date.now(),
          // Omitted when empty so a text-only draft does not carry an ink blob.
          ink: hasInk ? inkPage : undefined,
          mode: captureMode,
        } satisfies ParkedDraft),
      );
    } catch {
      // A full or unavailable quota must not break capture — the draft simply
      // is not recoverable across a remount. Ink is the likelier trigger: a
      // dense page is orders of magnitude larger than a sentence of text.
    }
  }, [draft, editingId, activeSession, inkPage, captureMode]);

  // Entries render oldest-first, so the newest is at the bottom and off-screen
  // once a session runs long. Scroll to it whenever the list grows — otherwise
  // the entry you just committed is the one you cannot see.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  // InkPad is told its viewport explicitly — it allocates canvas by viewport
  // plus overscan, never by page height, so it needs a real measurement.
  useEffect(() => {
    if (captureMode !== 'ink') return;
    const el = inkHostRef.current;
    if (!el) return;
    const measure = () => setInkViewport({ width: el.clientWidth, height: el.clientHeight });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [captureMode]);

  const handleStrokeCommit = useCallback((stroke: Stroke) => {
    setInkPage(page => ({ ...page, strokes: [...page.strokes, stroke] }));
  }, []);

  const handleInkUndo = useCallback(() => {
    setInkPage(page => ({ ...page, strokes: page.strokes.slice(0, -1) }));
  }, []);

  const handleInkPageHeightChange = useCallback((nextHeight: number) => {
    setInkPage(page => (nextHeight > page.pageHeight ? { ...page, pageHeight: nextHeight } : page));
  }, []);

  /**
   * Commits the current ink page as a log entry.
   *
   * @remarks
   * Mirrors {@link handleCommit}'s rejection contract exactly: refresh before
   * clearing, and on failure show a toast and re-throw with the strokes still
   * in memory. There is deliberately no `finally` — clearing the surface after
   * a failed write is how a page of handwriting disappears for good.
   */
  const handleInkCommit = useCallback(async () => {
    if (!activeSession || !activeCampaign) {
      throw new Error('No active session');
    }
    if (inkPage.strokes.length === 0) return;
    try {
      // Only reuse the edit target when it is itself a handwritten entry.
      // `handleSelectMode` already drops a mismatched target, but this is the
      // write that would be destructive, so it does not take that on trust.
      const editingInk = editingId
        ? entries.find(e => e.id === editingId && hasInkPayload(e))?.id ?? null
        : null;
      const targetId = editingInk ?? (await noteRepository.createInkLogEntry({
        campaignId: activeCampaign.id,
        sessionId: activeSession.id,
        scope: 'campaign',
      })).id;
      await noteRepository.saveInkPage(targetId, inkPage);
      await refresh();
      setInkPage(EMPTY_INK_PAGE);
      setEditingId(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save ink entry', 'error');
      throw e instanceof Error ? e : new Error('Failed to save ink entry');
    }
  }, [activeSession, activeCampaign, editingId, entries, inkPage, refresh, showToast]);

  const handleCommit = useCallback(async (text: string) => {
    if (!activeSession || !activeCampaign) {
      throw new Error('No active session');
    }
    try {
      if (editingId) {
        await noteRepository.updateLogEntry(editingId, textToDoc(text));
      } else {
        await noteRepository.createLogEntry({
          campaignId: activeCampaign.id,
          sessionId: activeSession.id,
          body: textToDoc(text),
          scope: 'campaign',
        });
      }
      // Refresh BEFORE clearing. If the re-read throws, WritePad's contract is
      // that the text stays in the pad — but clearing first meant the user saw
      // "failed to save" over an empty pad, retyped the thought, and committed
      // a duplicate.
      await refresh();
      setDraft('');
      setEditingId(null);
    } catch (e) {
      // Re-throw so WritePad retains the draft text and shows a toast.
      throw e instanceof Error ? e : new Error('Failed to save log entry');
    }
  }, [activeSession, activeCampaign, editingId, refresh]);

  /**
   * Opens an entry for editing.
   *
   * @remarks
   * Refuses to clobber an uncommitted draft. The entry list sits directly above
   * the pad on the capture screen, so tapping a row to re-read it is a natural
   * gesture — and it used to overwrite the in-progress draft *and* the parked
   * localStorage copy in the same tick, destroying a half-written thought with
   * no confirmation and no way back. On a screen whose entire premise is that a
   * thought is never lost, that was the easiest way to lose one.
   *
   * Handwritten entries route to the ink pad with their strokes loaded. Before,
   * an entry's ink was never read back: tapping one only set `editingId`, so
   * the next ink Commit replaced that entry's page with whatever happened to be
   * on the pad, and a text Commit wrote a body onto a note that still rendered
   * as its ink preview — the typed words were stored but invisible.
   */
  const handleTapEntry = useCallback((entry: Note) => {
    // Already open. Re-tapping must not re-read it from storage: for ink that
    // silently throws away every stroke added since it was opened, and for text
    // it was a no-op anyway.
    if (entry.id === editingId) return;

    const entryPage = noteRepository.readInkPage(entry);
    const entryIsInk = entryPage.strokes.length > 0;
    const entryText = docToText(entry.body);

    // Uncommitted handwriting is guarded first and on its own terms: unlike a
    // sentence of text, it cannot be reproduced from memory.
    if (inkPage.strokes.length > 0) {
      showToast('Commit or undo your handwriting before opening another entry', 'warning', 4000);
      return;
    }

    const pending = draft.trim();
    if (pending && draft !== entryText) {
      showToast(
        'Commit or clear what you have written before editing another entry',
        'warning',
        4000,
      );
      return;
    }

    setEditingId(entry.id);
    if (entryIsInk) {
      setInkPage(entryPage);
      setCaptureMode('ink');
      setDraft('');
    } else {
      setInkPage(EMPTY_INK_PAGE);
      setCaptureMode('text');
      setDraft(entryText);
    }
    setPadOpen(true);
  }, [draft, editingId, inkPage, showToast]);

  /**
   * Switches capture surface, dropping the edit target when it belongs to the
   * other kind.
   *
   * @remarks
   * An entry is either handwritten or typed; the two commit paths write
   * different fields. Carrying `editingId` across a mode switch is what lets a
   * text commit land on an ink note (body set, still rendered as its ink
   * preview) or an ink commit attach strokes to a typed one. Clearing it means
   * the commit creates a new entry instead — the original is untouched.
   */
  const handleSelectMode = useCallback((mode: CaptureMode) => {
    setCaptureMode(mode);
    if (!editingId) return;
    const editing = entries.find(e => e.id === editingId);
    if (!editing) return;
    if (hasInkPayload(editing) !== (mode === 'ink')) setEditingId(null);
  }, [editingId, entries]);

  /** Leaves edit mode without saving, restoring the pad to a blank new entry. */
  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setDraft('');
    // The ink pad is part of "the pad" too. Left loaded, the strokes of the
    // entry just abandoned would be committed as a brand-new duplicate entry.
    setInkPage(EMPTY_INK_PAGE);
  }, []);

  /**
   * Soft-deletes the selected entries and offers an Undo.
   *
   * @remarks
   * Every entry in one call shares a soft-delete transaction id, so Undo
   * restores exactly the set that was removed — restoring them individually
   * would resurrect any entry the user had deleted earlier and separately.
   */
  /**
   * Restores a previously deleted batch.
   *
   * @remarks
   * Every entry is attempted even if one fails. Abandoning the loop on the
   * first error was the dangerous shape: `noteRepository.restore` reinstates
   * links by the *transaction* id, so the first successful call already brings
   * back the whole batch's edges — bailing after that left every entry's edges
   * live while some of their notes stayed soft-deleted, which is exactly the
   * dangling-reference state the delete cascade exists to avoid.
   */
  const undoDelete = useCallback(async (deleted: Note[]) => {
    const failed: string[] = [];
    for (const entry of deleted) {
      try {
        await noteRepository.restore(entry.id);
      } catch (e) {
        // Logged, not swallowed: `restore` wraps the note and its edges in one
        // transaction, so an edge failure rolls the note back too. Without this
        // the only trace of "Undo didn't work" is a count.
        console.error('SessionLog.undoDelete failed for', entry.id, e);
        failed.push(entry.id);
      }
    }
    try {
      await refresh();
    } catch (e) {
      console.error('SessionLog.undoDelete refresh failed', e);
    }
    if (failed.length > 0) {
      showToast(`Could not restore ${failed.length} of ${deleted.length} entries`, 'error');
    }
  }, [refresh, showToast]);

  const handleDeleteEntries = useCallback(async (toDelete: Note[]) => {
    if (toDelete.length === 0) return;
    const txId = generateSoftDeleteTxId();
    // One shared txId across the batch, so Undo restores exactly this set.
    // Each entry is removed atomically — note and edges together — by
    // `softDeleteWithLinks`. A promoted entry carries a live `promoted_into`
    // edge to a note that is still active, and either half-state is a defect:
    // an orphaned edge exports into a bundle that excludes its target, and a
    // live note with dead edges has silently lost its provenance with no way
    // back. The batch is still a loop, so a mid-batch failure stops with
    // earlier entries cleanly deleted and the rest untouched.
    const deleted: Note[] = [];
    let failure: unknown = null;

    for (const entry of toDelete) {
      try {
        await noteRepository.softDeleteWithLinks(entry.id, txId);
        deleted.push(entry);
      } catch (e) {
        failure = e;
        break;
      }
    }

    // Only entries that actually went. One that failed is still live and still
    // editable, so discarding its draft would throw away work for a row that
    // never left.
    if (editingId && deleted.some(e => e.id === editingId)) {
      setEditingId(null);
      setDraft('');
    }
    try {
      await refresh();
    } catch (e) {
      // Guarded: this is called from an onClick that discards the promise, so
      // an unguarded throw here would surface as an unhandled rejection with no
      // toast and no Undo — the exact failure this path exists to prevent.
      console.error('SessionLog.handleDeleteEntries refresh failed', e);
    }

    if (deleted.length === 0) {
      showToast(failure instanceof Error ? failure.message : 'Failed to delete entry', 'error');
      return;
    }

    if (failure) {
      // Partial success. Report it honestly and still offer the way back for
      // what did go — the old code threw away both the Undo and the refresh,
      // leaving rows on screen that were already gone from Dexie.
      showToast(
        `Deleted ${deleted.length} of ${toDelete.length} entries; the rest failed.`,
        'error',
        { duration: 8000, action: { label: 'Undo', onClick: () => void undoDelete(deleted) } },
      );
      return;
    }

    showToast(
      toDelete.length === 1 ? 'Entry deleted' : `${toDelete.length} entries deleted`,
      'info',
      {
        // Longer than the 3s default — see NoteReader: an undo nobody has
        // time to reach is not an undo.
        duration: 8000,
        action: { label: 'Undo', onClick: () => void undoDelete(deleted) },
      },
    );
  }, [editingId, refresh, showToast, undoDelete]);

  if (!activeSession) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-[var(--color-text-muted,#666)]">Start a session to begin logging</p>
        <button
          type="button"
          onClick={() => void startSession()}
          className="rounded bg-[var(--color-primary,#2563eb)] px-4 py-2 text-sm font-medium text-white"
        >
          Start session
        </button>
      </div>
    );
  }

  return (
    // `h-full`, not `h-[calc(100%-140px)]`. `<main>` (ShellLayout) is an
    // overflow-y-auto scroll container with `pb-[140px]`, and under
    // `box-sizing: border-box` that padding sits *inside* main's height — so
    // main's content box is already `H - 140` and a `h-full` child measures
    // exactly that. Scroll height then equals client height and `<main>` never
    // scrolls; the entry list's own overflow-y-auto stays the only scroller.
    // Subtracting the 140px again here would double-count it and waste ~140px
    // of writing area, which on the capture screen is the thing we are trying
    // hardest to preserve.
    <div className="flex h-full flex-col" onPointerDownCapture={e => notePenPointer(e.pointerType)}>
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border,#ddd)] px-4 py-2">
        <h1 className="text-sm font-semibold">{activeSession.title}</h1>
        {/* Editing has to be visible and escapable. Without a banner there was
            no indication the pad was pointed at an existing entry, and without
            a way out the next new thought overwrote that entry instead of
            being added. */}
        {editingId && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted,#666)]">Editing an entry</span>
            <button
              type="button"
              onClick={cancelEdit}
              className="min-h-9 rounded border border-[var(--color-border,#ddd)] px-2 text-xs"
            >
              Cancel edit
            </button>
          </div>
        )}
        {/* The ink option appears only when a pen is actually detected; the
            text pad is always offered and always the initial mode. */}
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Capture mode">
          <button
            type="button"
            aria-pressed={captureMode === 'text'}
            onClick={() => handleSelectMode('text')}
            className={`min-h-9 rounded border border-[var(--color-border,#ddd)] px-2 text-xs ${
              captureMode === 'text' ? 'bg-[var(--color-primary,#2563eb)] text-white' : ''
            }`}
          >
            Text
          </button>
          {penAvailable && (
            <button
              type="button"
              aria-pressed={captureMode === 'ink'}
              onClick={() => handleSelectMode('ink')}
              className={`min-h-9 rounded border border-[var(--color-border,#ddd)] px-2 text-xs ${
                captureMode === 'ink' ? 'bg-[var(--color-primary,#2563eb)] text-white' : ''
              }`}
            >
              Ink
            </button>
          )}
        </div>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-2">
        {entries.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted,#666)]">
            No log entries yet.
          </p>
        )}
        {activeCampaign && (
          <SessionLogSelection
            entries={entries}
            campaignId={activeCampaign.id}
            onEditEntry={handleTapEntry}
            onPromoted={refresh}
            onDeleteEntries={handleDeleteEntries}
            renderEntry={entry => (
              <div>
                <div className="text-xs text-[var(--color-text-muted,#666)]">
                  {new Date(entry.createdAt).toLocaleTimeString()}
                </div>
                {/* An ink entry's body is an empty ProseMirror doc by design, so
                    it must render from its `typeData` payload — otherwise the
                    row is blank and reads as lost data. */}
                {hasInkPayload(entry) ? (
                  <InkEntryPreview note={entry} />
                ) : (
                  <div className="whitespace-pre-wrap text-sm">{docToText(entry.body)}</div>
                )}
              </div>
            )}
          />
        )}
      </div>
      <PenHelpPanel />
      {/* Docked, not fullscreen. A fullscreen pad would bury the entry list —
          and the list is not decoration: tap-to-edit and selection both live
          there. Docked keeps capture one tap from the session screen while
          leaving prior entries visible. */}
      {captureMode === 'text' ? (
        <WritePad
          value={draft}
          onChange={setDraft}
          onCommit={handleCommit}
          open={padOpen}
          onClose={() => setPadOpen(false)}
          placeholder="Log what's happening..."
          variant="docked"
          // A *floor*, not a target. This was 28rem, which on a tablet in
          // landscape left the entry list with no usable height at all: the
          // sticky selection toolbar and the header between them covered every
          // row, so selecting a second entry made it unclickable. Auto-grow is
          // what delivers the big writing surface — it climbs to
          // `maxHeightFraction` of the viewport as the user writes — so the
          // floor only has to be comfortable to start writing in.
          dockedHeight="14rem"
          commitLabel="Commit"
        />
      ) : (
        <div className="shrink-0 border-t border-[var(--color-border,#ddd)]">
          <div ref={inkHostRef} className="h-[28rem] w-full">
            {inkViewport.width > 0 && inkViewport.height > 0 && (
              <InkPad
                page={inkPage}
                onStrokeCommit={handleStrokeCommit}
                onUndo={handleInkUndo}
                onPageHeightChange={handleInkPageHeightChange}
                viewportWidth={inkViewport.width}
                viewportHeight={inkViewport.height}
              />
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-2">
            <button
              type="button"
              // Caught only to keep this click handler from producing an
              // unhandled rejection — `handleInkCommit` has already toasted and
              // has deliberately left the strokes on the pad.
              onClick={() => void handleInkCommit().catch(() => {})}
              // Matches the text pad, which greys out on an empty draft. The
              // handler early-returns on an empty page, so an enabled button
              // read as a save that silently did nothing.
              disabled={inkPage.strokes.length === 0}
              className="min-h-9 rounded bg-[var(--color-primary,#2563eb)] px-4 text-sm font-medium text-white disabled:opacity-40"
            >
              Commit
            </button>
          </div>
        </div>
      )}
      {captureMode === 'text' && !padOpen && (
        <button
          type="button"
          onClick={() => setPadOpen(true)}
          className="m-4 rounded bg-[var(--color-primary,#2563eb)] px-4 py-2 text-sm font-medium text-white"
        >
          Write
        </button>
      )}
    </div>
  );
}
