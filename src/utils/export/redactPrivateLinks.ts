/**
 * Roadmap S25: a link to a private note, in a note that is exported.
 *
 * @remarks
 * **Decided by agent 2026-11-21 (owner may revisit).** A `[[wikilink]]` or
 * `@mention` node carries its target's id and title. When the export excludes
 * private notes, the two exits disagreed: the JSON bundle found the private id
 * in a public note's body and refused to write at all (`PrivacyLeakError`), so
 * one link blocked the whole shareable export; the Markdown exports wrote the
 * private note's title as plain text or as `[[Its Title]]`.
 *
 * The conservative choice is that a shared export never carries a private
 * note's id or title. So in an export that excludes private notes, every
 * link *node* whose target is a private note (by id, or by label/title when the
 * node has no resolved id) is replaced by the text {@link PRIVATE_LINK_TEXT}.
 * Only the link node changes: the rest of the prose is the author's and is left
 * exactly as written, including any place they typed the title as plain text.
 * The stored note is never touched; this runs on the copy being exported.
 *
 * Reversible: the behaviour lives in this one function, and an export with
 * private notes included does not call it.
 */

/** What a link to a private note becomes in a shared export. */
export const PRIVATE_LINK_TEXT = '[private note]';

type DocNode = {
  type?: unknown;
  attrs?: Record<string, unknown>;
  content?: unknown;
  [key: string]: unknown;
};

/** The private notes an export must not point at. */
export interface PrivateLinkTargets {
  ids: ReadonlySet<string>;
  /** Lower-cased, trimmed titles. */
  titles: ReadonlySet<string>;
}

const normTitle = (t: string | undefined) => (t ?? '').trim().toLowerCase();

/**
 * Builds {@link PrivateLinkTargets} from the private notes.
 *
 * @param privateNotes - Notes the export excludes.
 * @param shareableNotes - Notes it carries. A title one of these also has is
 *   not matched by title, since a link by that label may mean the public note.
 *   Matching by id is unaffected.
 */
export function privateLinkTargets(
  privateNotes: ReadonlyArray<{ id: string; title?: string }>,
  shareableNotes: ReadonlyArray<{ title?: string }> = [],
): PrivateLinkTargets {
  const shared = new Set(shareableNotes.map((n) => normTitle(n.title)));
  return {
    ids: new Set(privateNotes.map((n) => n.id)),
    titles: new Set(
      privateNotes.map((n) => normTitle(n.title)).filter((t) => t.length > 0 && !shared.has(t)),
    ),
  };
}

function pointsAtPrivate(node: DocNode, targets: PrivateLinkTargets): boolean {
  if (node.type !== 'mention' && node.type !== 'wikiLink') return false;
  const attrs = node.attrs ?? {};
  const id = attrs.id;
  if (typeof id === 'string' && targets.ids.has(id)) return true;
  for (const key of ['label', 'title']) {
    const value = attrs[key];
    if (typeof value === 'string' && targets.titles.has(value.trim().toLowerCase())) return true;
  }
  return false;
}

/**
 * A copy of a ProseMirror document with links to private notes replaced.
 *
 * @param doc - A note body (ProseMirror JSON), or anything else, which is returned as is.
 * @param targets - The private notes to redact links to.
 * @returns The same value when nothing matched, otherwise a redacted copy.
 */
export function redactPrivateLinks<T>(doc: T, targets: PrivateLinkTargets): T {
  if (targets.ids.size === 0 && targets.titles.size === 0) return doc;
  const visit = (node: unknown): unknown => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
    const n = node as DocNode;
    if (pointsAtPrivate(n, targets)) return { type: 'text', text: PRIVATE_LINK_TEXT };
    if (!Array.isArray(n.content)) return node;
    let changed = false;
    const content = n.content.map((child) => {
      const next = visit(child);
      if (next !== child) changed = true;
      return next;
    });
    return changed ? { ...n, content } : node;
  };
  return visit(doc) as T;
}

/**
 * Notes ready for a shared Markdown export: each body with its links to the
 * campaign's private notes redacted.
 *
 * @param notes - The notes being rendered.
 * @param campaignNotes - Every note in the campaign, so a link to a private note
 *   outside the exported set is redacted too.
 */
export function redactNotesForShare<T extends { id: string; title?: string; body?: unknown; visibility?: string }>(
  notes: T[],
  campaignNotes: ReadonlyArray<{ id: string; title?: string; visibility?: string }>,
): T[] {
  const privateNotes = campaignNotes.filter((n) => n.visibility === 'private');
  const targets = privateLinkTargets(privateNotes, campaignNotes.filter((n) => n.visibility !== 'private'));
  return notes.map((note) => {
    const body = redactPrivateLinks(note.body, targets);
    return body === note.body ? note : { ...note, body };
  });
}
