// Must run before the Dexie `db` singleton is imported.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../storage/db/client';
import { collectCampaignBundle } from './collectors';
import { serializeBundle } from './bundleSerializer';
import { excludePrivateNotes } from './privacyFilter';
import { PRIVATE_LINK_TEXT, redactNotesForShare } from './redactPrivateLinks';
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
 * The two export paths used to do opposite things with the same chip: the
 * JSON bundle found the private id in the public note's body and refused to
 * write at all (`PrivacyLeakError`), so one link could block the whole
 * shareable backup, while the Markdown path wrote the private note's title as
 * `[[Its Title]]`. That was roadmap S25, left for the owner.
 *
 * **Decided by agent 2026-11-21 (owner may revisit):** a shared export never
 * carries a private note's id or title. The link node is replaced by
 * `[private note]` on the exported copy (`redactPrivateLinks`); the rest of the
 * prose, and the stored note, are untouched. The two "blocks" and "ships the
 * title" cases below were rewritten to this rule, and both fail on the code
 * before it.
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

  it('exports the JSON bundle with the link redacted once the target is private', async () => {
    await seed('private');
    const json = await campaignJson();
    expect(json).not.toContain(SECRET_ID);
    expect(json).not.toContain(SECRET_TITLE);
    expect(json).toContain(PRIVATE_LINK_TEXT);
    // The prose around the link is the author's and survives.
    expect(json).toContain('We should ask ');
    expect(json).toContain('The Toll House');
  });

  it('leaves the stored note as it was', async () => {
    await seed('private');
    await campaignJson();
    const stored = await db.notes.get(PUBLIC_ID) as Note;
    expect(JSON.stringify(stored.body)).toContain(SECRET_ID);
  });

  it('redacts the link in the Markdown path too', async () => {
    await seed('private');
    const all = await db.notes.toArray() as Note[];
    const linking = all.find(n => n.id === PUBLIC_ID)!;
    const corpus = excludePrivateNotes(all);
    const [shared] = redactNotesForShare([linking], all);

    const markdown = renderNoteToMarkdown(shared!, [], corpus);
    expect(markdown).not.toContain(SECRET_TITLE);
    expect(markdown).toContain(`We should ask ${PRIVATE_LINK_TEXT} about the toll.`);
  });
});
