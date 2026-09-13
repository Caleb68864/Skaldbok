// Must run before the Dexie `db` singleton is imported.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../storage/db/client';
import { collectCampaignBundle } from './collectors';
import { serializeBundle } from './bundleSerializer';
import { PrivacyLeakError, excludePrivateNotes } from './privacyFilter';
import { renderNoteToMarkdown } from './renderNote';
import { BUNDLED_SYSTEMS } from '../../systems/registry';
import type { Note } from '../../types/note';

/**
 * What happens to a note that links *to* a private note.
 *
 * @remarks
 * The export boundary is written outward: a private note takes its kb node, its
 * edges and its attachments with it. This file is about the other direction,
 * which is not symmetrical and, until the flag had a control, could not be
 * reached from the UI at all.
 *
 * A `[[wikilink]]` chip stores **both** halves of its target —
 * `attrs: { id, label }`, where `id` is the target note's id and `label` is its
 * title (`TiptapNoteEditor`, the `WikiLink.configure` suggestion). So a public
 * note that mentions a private one carries that note's id and title inside its
 * own body, several levels down a ProseMirror document.
 *
 * The two export paths then do opposite things with the same chip, and both
 * outcomes are recorded here rather than endorsed:
 *
 * - **The JSON bundle refuses.** `applyPrivacyFilter` correctly keeps the public
 *   note — the private id is nested inside `body`, not a top-level field, and
 *   dropping a whole public note because of one word in it would be the
 *   over-filtering mistake. `privateResidueIn` then finds that id in the
 *   serialized text and `serializeBundle` throws `PrivacyLeakError`. The export
 *   fails closed and nothing is written, which is safe — and it means marking
 *   one linked-to note private can block the whole campaign backup until it is
 *   un-marked.
 * - **The Markdown path ships the title.** `resolveWikiLinks` renders a
 *   `wikiLink` node as `[[label]]` without consulting `allNotes` at all, so
 *   passing it a privacy-filtered corpus changes nothing for wikilinks (it does
 *   work for `mention` nodes, which is what that corpus was added for). The
 *   private note's title leaves the device in a public note's prose, with no
 *   refusal and no warning.
 *
 * Neither is a bug this file fixes, because the choice between them is a policy
 * question the repository has already answered once, in the other direction:
 * `privateResidueIn` deliberately matches **ids only**, on the grounds that a
 * private note's title can legitimately appear in a public note's body and
 * refusing that export would be over-filtering. Under that rule the Markdown
 * behaviour is consistent and the JSON refusal is the odd one out — the same
 * rule at two exits, disagreeing, which is the shape this repository keeps
 * finding. Deciding between them means deciding whether an export may rewrite
 * prose the user wrote, and that is the owner's call, not a test's.
 *
 * What this file does is make both behaviours executable, so the decision is
 * made against what the code does rather than against what it is assumed to do.
 */

const CAMPAIGN_ID = 'camp-backlink';
const NOW = '2026-01-01T00:00:00.000Z';
const SECRET_ID = 'note-backlink-secret';
const SECRET_TITLE = 'Lady Sable Is The Hierophant';
const PUBLIC_ID = 'note-backlink-open';

/** A Tiptap body holding a wikilink chip exactly as `TiptapNoteEditor` inserts one. */
function bodyLinkingTo(id: string, label: string): unknown {
  return {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'We should ask ' },
        { type: 'wikiLink', attrs: { id, label } },
        { type: 'text', text: ' about the toll.' },
      ],
    }],
  };
}

async function seed(secretVisibility: 'public' | 'private'): Promise<void> {
  const stamp = { schemaVersion: 1, createdAt: NOW, updatedAt: NOW };
  await db.campaigns.add({
    id: CAMPAIGN_ID, name: 'Backlink', system: BUNDLED_SYSTEMS[0].id, status: 'active', ...stamp,
  } as never);
  await db.notes.add({
    id: SECRET_ID, campaignId: CAMPAIGN_ID, title: SECRET_TITLE, body: null, type: 'npc',
    status: 'active', pinned: false, scope: 'campaign', visibility: secretVisibility, ...stamp,
  } as never);
  await db.notes.add({
    id: PUBLIC_ID, campaignId: CAMPAIGN_ID, title: 'The Toll House',
    body: bodyLinkingTo(SECRET_ID, SECRET_TITLE), type: 'location',
    status: 'active', pinned: false, scope: 'campaign', visibility: 'public', ...stamp,
  } as never);
}

async function campaignJson(): Promise<string> {
  const result = await collectCampaignBundle(CAMPAIGN_ID);
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(result.error);
  return await serializeBundle('campaign', result.contents, { includePrivate: false });
}

beforeEach(async () => {
  for (const table of db.tables) await table.clear();
});

describe('a public note whose body wiki-links a private note', () => {
  it('exports normally while the target is public', async () => {
    // The control. Everything below has to be caused by the flag and by nothing
    // else about this fixture.
    await seed('public');
    const json = await campaignJson();
    expect(json).toContain(SECRET_TITLE);
    expect(json).toContain(SECRET_ID);
  });

  it('blocks the whole JSON bundle once the target is marked private', async () => {
    await seed('private');
    await expect(campaignJson()).rejects.toBeInstanceOf(PrivacyLeakError);
    // The refusal names the note, which is the only thing that makes it
    // actionable: the fix is to un-mark that note or to remove the link.
    await expect(campaignJson()).rejects.toThrow(SECRET_ID);
  });

  it('ships the private title in the Markdown path, with no refusal', async () => {
    // Recorded, not endorsed — see this file's remarks. The corpus handed to the
    // renderer is privacy-filtered exactly as `useExportActions` filters it, and
    // it makes no difference, because `resolveWikiLinks` renders a `wikiLink`
    // from its stored `label` and never looks at the corpus.
    await seed('private');
    const linking = await db.notes.get(PUBLIC_ID) as Note;
    const corpus = excludePrivateNotes(await db.notes.toArray() as Note[]);

    expect(corpus.map(n => n.id)).not.toContain(SECRET_ID);

    const markdown = renderNoteToMarkdown(linking, [], corpus);
    expect(markdown).toContain(SECRET_TITLE);
  });
});
