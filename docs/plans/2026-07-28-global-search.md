# Global Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give Skaldbok one search box that finds anything in the campaign — notes, KB nodes, sessions, encounters, ships, gear, skills — reachable from every screen.

**Architecture:** A single MiniSearch index over a normalized `SearchDoc`, built from per-entity adapter functions. The index is rebuilt when the search palette opens rather than maintained incrementally, which trades tens of milliseconds for the elimination of all cache-invalidation logic. The already-built-but-unmounted `CommandPalette` becomes the surface, escalating to a `/search` route.

**Tech Stack:** React 19, TypeScript, MiniSearch 7 (already a dependency), Dexie repositories, Vitest, Tailwind v4.

**Design doc:** `docs/plans/2026-07-28-global-search-design.md`

---

## Context You Need Before Starting

**Read these first:**

- `src/features/notes/useNoteSearch.ts` — the existing note index. Its MiniSearch config is the proven one; copy its `fuzzy`/`prefix` settings. **Do not modify this file.** It serves `PromoteEntriesSheet` and is out of scope.
- `src/features/kb/CommandPalette.tsx` — a complete overlay that is never mounted. You will rewire and mount it.
- `src/features/kb/useKBSearch.ts` — will be deleted at the end.
- `CLAUDE.md` — especially the **Soft Deletes** section.

**Project conventions that will bite you:**

1. **Never touch Dexie tables directly.** All reads go through `src/storage/repositories/*.ts`. Repositories already exclude soft-deleted rows by default, which is why this plan needs no `deletedAt` filtering.
2. **`npm run build` is the only type-check.** There is no lint or typecheck script.
3. **`npm test` covers pure logic only.** There is no component/DOM test setup. Every adapter and helper in this plan is a pure function and gets a test. The hook and the components are verified by `npm run build` plus running the app.
4. Import alias `@` maps to `src/`, but relative imports are preferred where both work.

**Commands:**

- Run tests: `npm test`
- Type-check and build: `npm run build`
- Dev server: `npm run dev`

---

## Task 1: SearchDoc types

**Files:**
- Create: `src/features/search/types.ts`

**Step 1: Write the file**

```ts
/**
 * The normalized document every searchable entity is projected into before
 * being fed to MiniSearch.
 *
 * @remarks
 * A single index over one shape — rather than one index per entity type —
 * gives one query, one comparable relevance score, and turns result grouping
 * into a `groupBy` instead of a merge-and-rerank problem.
 */

/** Every entity type the global index covers. */
export type SearchEntityType =
  | 'note'
  | 'kb'
  | 'session'
  | 'encounter'
  | 'ship'
  | 'gear'
  | 'skill';

/** A single indexed document. */
export interface SearchDoc {
  /** `${entityType}:${entityId}` — MiniSearch requires globally unique ids. */
  id: string;
  entityType: SearchEntityType;
  /** The underlying entity's own id, for navigation and de-duplication. */
  entityId: string;
  /** Primary display string. Boosted highest. */
  title: string;
  /** Secondary context: note type, session date, skill category. */
  subtitle: string;
  /** Body / description / notes. The bulk of the searchable text. */
  text: string;
  /** Space-joined tag list. */
  tags: string;
  /** Route to navigate to when the result is selected. */
  route: string;
}

/**
 * Builds the composite MiniSearch document id.
 *
 * @remarks
 * Note ids and KB node ids can collide, so the type prefix is what keeps two
 * different entities from overwriting each other in the index.
 */
export function docId(entityType: SearchEntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}
```

**Step 2: Verify it compiles**

Run: `npm run build`
Expected: builds clean. (Nothing imports this yet; you are checking for syntax and type errors.)

**Step 3: Commit**

```bash
git add src/features/search/types.ts
git commit -m "feat(search): add SearchDoc type for the unified search index"
```

---

## Task 2: Note and KB adapters

**Files:**
- Create: `src/features/search/adapters.ts`
- Create: `src/features/search/adapters.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { noteToSearchDoc, kbNodeToSearchDoc } from './adapters';
import type { Note } from '../../types/note';
import type { KBNode } from '../../storage/db/client';

/** A minimal Tiptap document, matching what `extractText` expects. */
function body(text: string) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    campaignId: 'camp-1',
    sessionId: 'sess-1',
    title: 'Regina Startport',
    body: body('Met the broker, an Oberlindes agent.'),
    type: 'location',
    tags: ['patron', 'regina'],
    status: 'active',
    schemaVersion: 1,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as Note;
}

describe('noteToSearchDoc', () => {
  it('flattens a note into a searchable doc', () => {
    const doc = noteToSearchDoc(makeNote());
    expect(doc.id).toBe('note:note-1');
    expect(doc.entityType).toBe('note');
    expect(doc.entityId).toBe('note-1');
    expect(doc.title).toBe('Regina Startport');
    expect(doc.subtitle).toBe('location');
    expect(doc.text).toContain('Oberlindes');
    expect(doc.tags).toBe('patron regina');
    expect(doc.route).toBe('/kb/note-1');
  });

  it('survives a note with no tags and an empty body', () => {
    const doc = noteToSearchDoc(makeNote({ tags: undefined, body: null }));
    expect(doc.tags).toBe('');
    expect(doc.text).toBe('');
  });

  it('indexes log entries rather than skipping them', () => {
    // Searching the raw session log is a primary reason the log exists.
    const doc = noteToSearchDoc(makeNote({ type: 'log' }));
    expect(doc.subtitle).toBe('log');
  });
});

describe('kbNodeToSearchDoc', () => {
  it('flattens a KB node into a searchable doc', () => {
    const node = { id: 'kb-1', type: 'character', label: 'Marc Hauser' } as KBNode;
    const doc = kbNodeToSearchDoc(node);
    expect(doc.id).toBe('kb:kb-1');
    expect(doc.title).toBe('Marc Hauser');
    expect(doc.subtitle).toBe('character');
    expect(doc.route).toBe('/kb/kb-1');
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npm test -- adapters`
Expected: FAIL — `Failed to resolve import "./adapters"`.

**Step 3: Write the implementation**

```ts
/**
 * Per-entity projections into {@link SearchDoc}.
 *
 * @remarks
 * Every function here is pure and synchronous so the whole projection layer is
 * unit-testable without touching IndexedDB. Adding a searchable entity type
 * means adding one function here and one call in `collectSearchDocs`.
 */

import { extractText } from '../../utils/prosemirror';
import { docId } from './types';
import type { SearchDoc } from './types';
import type { Note } from '../../types/note';
import type { KBNode } from '../../storage/db/client';

/**
 * Projects a note, including its rich-text body, into a search document.
 *
 * @remarks
 * Log entries are indexed like any other note. `NotesGrid` hides them from the
 * default view, but being able to search the raw session log is one of the main
 * reasons for keeping it.
 */
export function noteToSearchDoc(note: Note): SearchDoc {
  return {
    id: docId('note', note.id),
    entityType: 'note',
    entityId: note.id,
    title: note.title,
    subtitle: note.type,
    text: extractText(note.body),
    tags: (note.tags ?? []).join(' '),
    // The note reader lives at /kb/:id — KnowledgeBaseScreen renders
    // <NoteReader noteId={nodeId} /> off that route param.
    route: `/kb/${note.id}`,
  };
}

/** Projects a knowledge-base node into a search document. */
export function kbNodeToSearchDoc(node: KBNode): SearchDoc {
  return {
    id: docId('kb', node.id),
    entityType: 'kb',
    entityId: node.id,
    title: node.label,
    subtitle: node.type,
    text: '',
    tags: '',
    route: `/kb/${node.id}`,
  };
}
```

**Step 4: Run the test to verify it passes**

Run: `npm test -- adapters`
Expected: PASS, 4 tests.

**Step 5: Commit**

```bash
git add src/features/search/adapters.ts src/features/search/adapters.test.ts
git commit -m "feat(search): add note and KB node search adapters"
```

---

## Task 3: Session, encounter and ship adapters

**Files:**
- Modify: `src/features/search/adapters.ts`
- Modify: `src/features/search/adapters.test.ts`

**Step 1: Write the failing tests**

Append to `adapters.test.ts`:

```ts
import {
  sessionToSearchDoc,
  encounterToSearchDoc,
  shipToSearchDoc,
} from './adapters';
import type { Session } from '../../types/session';
import type { Encounter } from '../../types/encounter';
import type { Ship } from '../../types/ship';

describe('sessionToSearchDoc', () => {
  it('uses the session date as the subtitle', () => {
    const session = {
      id: 'sess-1',
      title: 'Downport Trouble',
      date: '2026-07-04',
    } as Session;
    const doc = sessionToSearchDoc(session);
    expect(doc.id).toBe('session:sess-1');
    expect(doc.title).toBe('Downport Trouble');
    expect(doc.subtitle).toBe('2026-07-04');
    expect(doc.route).toBe('/session');
  });
});

describe('encounterToSearchDoc', () => {
  it('indexes participant names so "who did we fight" works', () => {
    const encounter = {
      id: 'enc-1',
      title: 'Startport Ambush',
      participants: [{ id: 'p1', name: 'Vargr Corsair' }],
    } as Encounter;
    const doc = encounterToSearchDoc(encounter);
    expect(doc.id).toBe('encounter:enc-1');
    expect(doc.title).toBe('Startport Ambush');
    expect(doc.text).toContain('Vargr Corsair');
  });

  it('survives an encounter with no participants', () => {
    const encounter = { id: 'enc-2', title: 'Quiet Jump' } as Encounter;
    expect(encounterToSearchDoc(encounter).text).toBe('');
  });
});

describe('shipToSearchDoc', () => {
  it('indexes notes, weapons and crew assignments', () => {
    const ship = {
      id: 'ship-1',
      name: 'Beowulf',
      shipClass: 'Free Trader',
      notes: 'Mortgage due Regina.',
      weapons: ['Triple Turret'],
      crew: [{ role: 'Pilot', assignee: 'Jonas' }],
    } as Ship;
    const doc = shipToSearchDoc(ship);
    expect(doc.title).toBe('Beowulf');
    expect(doc.subtitle).toBe('Free Trader');
    expect(doc.text).toContain('Mortgage');
    expect(doc.text).toContain('Triple Turret');
    expect(doc.text).toContain('Jonas');
    expect(doc.route).toBe('/ships');
  });

  it('falls back to a generic subtitle when the class is blank', () => {
    const ship = {
      id: 'ship-2',
      name: 'Hull 7',
      shipClass: '',
      notes: '',
      weapons: [],
      crew: [],
    } as Ship;
    expect(shipToSearchDoc(ship).subtitle).toBe('Ship');
  });
});
```

**Step 2: Run to verify failure**

Run: `npm test -- adapters`
Expected: FAIL — the three new functions are not exported.

**Step 3: Implement**

Append to `adapters.ts` (and add the type imports at the top):

```ts
import type { Session } from '../../types/session';
import type { Encounter } from '../../types/encounter';
import type { Ship } from '../../types/ship';

/** Projects a session into a search document. */
export function sessionToSearchDoc(session: Session): SearchDoc {
  return {
    id: docId('session', session.id),
    entityType: 'session',
    entityId: session.id,
    title: session.title,
    subtitle: session.date,
    text: '',
    tags: '',
    route: '/session',
  };
}

/**
 * Projects an encounter into a search document.
 *
 * @remarks
 * Participant names go into `text` because "what was that thing that ambushed
 * us" is a more common query than the encounter's own title.
 */
export function encounterToSearchDoc(encounter: Encounter): SearchDoc {
  return {
    id: docId('encounter', encounter.id),
    entityType: 'encounter',
    entityId: encounter.id,
    title: encounter.title,
    subtitle: 'Encounter',
    text: (encounter.participants ?? []).map((p) => p.name).join(' '),
    tags: '',
    route: '/session',
  };
}

/** Projects a ship into a search document. */
export function shipToSearchDoc(ship: Ship): SearchDoc {
  return {
    id: docId('ship', ship.id),
    entityType: 'ship',
    entityId: ship.id,
    title: ship.name,
    subtitle: ship.shipClass || 'Ship',
    text: [
      ship.notes,
      ...(ship.weapons ?? []),
      ...(ship.crew ?? []).map((c) => `${c.role} ${c.assignee}`),
    ]
      .filter(Boolean)
      .join(' ')
      .trim(),
    tags: '',
    route: '/ships',
  };
}
```

**Step 4: Run to verify pass**

Run: `npm test -- adapters`
Expected: PASS, 8 tests.

**Step 5: Commit**

```bash
git add src/features/search/adapters.ts src/features/search/adapters.test.ts
git commit -m "feat(search): add session, encounter and ship search adapters"
```

---

## Task 4: Gear and skill adapters

These are **active-character scoped**, not campaign scoped. Indexing every character's inventory would return four characters' rifles for one query.

**Files:**
- Modify: `src/features/search/adapters.ts`
- Modify: `src/features/search/adapters.test.ts`

**Step 1: Write the failing tests**

```ts
import { inventoryItemToSearchDoc, skillToSearchDoc } from './adapters';
import type { InventoryItem } from '../../types/character';
import type { SkillDefinition } from '../../types/system';

describe('inventoryItemToSearchDoc', () => {
  it('indexes the item description', () => {
    const item = {
      id: 'item-1',
      name: 'Laser Carbine',
      description: 'TL9, 4D damage, bulky.',
      weight: 3,
      quantity: 1,
    } as InventoryItem;
    const doc = inventoryItemToSearchDoc(item);
    expect(doc.id).toBe('gear:item-1');
    expect(doc.title).toBe('Laser Carbine');
    expect(doc.text).toContain('4D damage');
    expect(doc.route).toBe('/character/gear');
  });
});

describe('skillToSearchDoc', () => {
  it('uses the category name as the subtitle', () => {
    const def = { id: 'gun-combat', name: 'Gun Combat', baseChance: 0 } as SkillDefinition;
    const doc = skillToSearchDoc(def, 'Combat');
    expect(doc.id).toBe('skill:gun-combat');
    expect(doc.title).toBe('Gun Combat');
    expect(doc.subtitle).toBe('Combat');
    expect(doc.route).toBe('/character/skills');
  });
});
```

**Step 2: Run to verify failure**

Run: `npm test -- adapters`
Expected: FAIL — functions not exported.

**Step 3: Implement**

```ts
import type { InventoryItem } from '../../types/character';
import type { SkillDefinition } from '../../types/system';

/** Projects an inventory item into a search document. */
export function inventoryItemToSearchDoc(item: InventoryItem): SearchDoc {
  return {
    id: docId('gear', item.id),
    entityType: 'gear',
    entityId: item.id,
    title: item.name,
    subtitle: 'Gear',
    text: item.description ?? '',
    tags: '',
    route: '/character/gear',
  };
}

/**
 * Projects a skill definition into a search document.
 *
 * @remarks
 * Skill *names* live in the system definition, not on the character record —
 * the character only stores values by skill id. The category name is passed in
 * rather than looked up so this stays a pure function.
 */
export function skillToSearchDoc(
  definition: SkillDefinition,
  categoryName: string,
): SearchDoc {
  return {
    id: docId('skill', definition.id),
    entityType: 'skill',
    entityId: definition.id,
    title: definition.name,
    subtitle: categoryName,
    text: '',
    tags: '',
    route: '/character/skills',
  };
}
```

**Step 4: Run to verify pass**

Run: `npm test -- adapters`
Expected: PASS, 10 tests.

**Step 5: Commit**

```bash
git add src/features/search/adapters.ts src/features/search/adapters.test.ts
git commit -m "feat(search): add gear and skill search adapters"
```

---

## Task 5: Snippet builder

This is the highest-value UI detail. At the table, "…the broker **Regina** put us onto, an Oberlindes agent…" often *is* the answer and the user never taps through.

**Files:**
- Create: `src/features/search/snippet.ts`
- Create: `src/features/search/snippet.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildSnippet } from './snippet';

const LONG =
  'We landed at the downport and met the broker, an Oberlindes agent who ' +
  'offered us a cargo of grain bound for Efate at a markup we could not refuse.';

describe('buildSnippet', () => {
  it('centres the window on the first matching term', () => {
    const snippet = buildSnippet(LONG, ['oberlindes'], 20);
    expect(snippet).toContain('Oberlindes');
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(buildSnippet(LONG, ['OBERLINDES'], 20)).toContain('Oberlindes');
  });

  it('uses the earliest matching term when several match', () => {
    const snippet = buildSnippet(LONG, ['efate', 'downport'], 15);
    expect(snippet).toContain('downport');
  });

  it('falls back to the head of the text when nothing matches', () => {
    const snippet = buildSnippet(LONG, ['zhodani'], 20);
    expect(snippet.startsWith('We landed')).toBe(true);
  });

  it('does not add ellipses when the whole text fits', () => {
    expect(buildSnippet('Short note.', ['short'], 60)).toBe('Short note.');
  });

  it('returns an empty string for empty text', () => {
    expect(buildSnippet('', ['anything'])).toBe('');
  });
});
```

**Step 2: Run to verify failure**

Run: `npm test -- snippet`
Expected: FAIL — cannot resolve `./snippet`.

**Step 3: Implement**

```ts
/**
 * Builds a short context window around a search match.
 *
 * @param text - The full body text of the matched document.
 * @param terms - Matched terms, as reported by MiniSearch on each result.
 * @param radius - Characters to include either side of the match.
 * @returns A trimmed excerpt, ellipsed where it was cut.
 *
 * @remarks
 * Reading the answer straight off the result row is the point — most table
 * lookups end here rather than in a tap-through.
 */
export function buildSnippet(
  text: string,
  terms: string[],
  radius = 60,
): string {
  if (!text) return '';

  const lower = text.toLowerCase();
  let matchIndex = -1;
  for (const term of terms) {
    const found = lower.indexOf(term.toLowerCase());
    if (found !== -1 && (matchIndex === -1 || found < matchIndex)) {
      matchIndex = found;
    }
  }

  // Nothing matched in the body — the hit was on the title or tags. Show the
  // opening of the text so the row still carries context.
  if (matchIndex === -1) {
    const head = text.slice(0, radius * 2).trim();
    return head.length < text.length ? `${head}…` : head;
  }

  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(text.length, matchIndex + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}
```

**Step 4: Run to verify pass**

Run: `npm test -- snippet`
Expected: PASS, 6 tests.

**Step 5: Commit**

```bash
git add src/features/search/snippet.ts src/features/search/snippet.test.ts
git commit -m "feat(search): add match-context snippet builder"
```

---

## Task 6: Result grouping

**Files:**
- Create: `src/features/search/grouping.ts`
- Create: `src/features/search/grouping.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { groupByType, TYPE_ORDER, TYPE_LABELS } from './grouping';
import type { SearchEntityType } from './types';

const row = (entityType: SearchEntityType, id: string) => ({ entityType, id });

describe('groupByType', () => {
  it('groups results in a fixed display order, not match order', () => {
    const groups = groupByType([
      row('skill', 'a'),
      row('note', 'b'),
      row('session', 'c'),
    ]);
    expect(groups.map((g) => g.type)).toEqual(['note', 'session', 'skill']);
  });

  it('preserves relevance order within a group', () => {
    const groups = groupByType([row('note', 'first'), row('note', 'second')]);
    expect(groups[0].items.map((i) => i.id)).toEqual(['first', 'second']);
  });

  it('omits types with no results', () => {
    const groups = groupByType([row('ship', 'a')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('ship');
  });

  it('returns nothing for no results', () => {
    expect(groupByType([])).toEqual([]);
  });

  it('has a human label for every type it can order', () => {
    for (const type of TYPE_ORDER) {
      expect(TYPE_LABELS[type]).toBeTruthy();
    }
  });
});
```

**Step 2: Run to verify failure**

Run: `npm test -- grouping`
Expected: FAIL — cannot resolve `./grouping`.

**Step 3: Implement**

```ts
/**
 * Display ordering and grouping for search results.
 *
 * @remarks
 * Results arrive from MiniSearch in relevance order across all types. Grouping
 * re-sorts the *sections* into a fixed, predictable order while leaving
 * relevance order intact *within* each section, so the eye can learn where to
 * look without losing ranking.
 */

import type { SearchEntityType } from './types';

/** Section order in the results list. Narrative first, character data last. */
export const TYPE_ORDER: SearchEntityType[] = [
  'note',
  'kb',
  'session',
  'encounter',
  'ship',
  'gear',
  'skill',
];

/** Section headings. */
export const TYPE_LABELS: Record<SearchEntityType, string> = {
  note: 'Notes',
  kb: 'Knowledge Base',
  session: 'Sessions',
  encounter: 'Encounters',
  ship: 'Ships',
  gear: 'Gear',
  skill: 'Skills',
};

/** One rendered section of results. */
export interface SearchGroup<T> {
  type: SearchEntityType;
  label: string;
  items: T[];
}

/** Buckets results by entity type and returns them in {@link TYPE_ORDER}. */
export function groupByType<T extends { entityType: SearchEntityType }>(
  results: T[],
): SearchGroup<T>[] {
  const buckets = new Map<SearchEntityType, T[]>();
  for (const result of results) {
    const bucket = buckets.get(result.entityType);
    if (bucket) bucket.push(result);
    else buckets.set(result.entityType, [result]);
  }

  return TYPE_ORDER.filter((type) => buckets.has(type)).map((type) => ({
    type,
    label: TYPE_LABELS[type],
    items: buckets.get(type)!,
  }));
}
```

**Step 4: Run to verify pass**

Run: `npm test -- grouping`
Expected: PASS, 5 tests.

**Step 5: Commit**

```bash
git add src/features/search/grouping.ts src/features/search/grouping.test.ts
git commit -m "feat(search): add fixed-order result grouping"
```

---

## Task 7: Document collection

Pulls every searchable entity out of the repositories and projects it.

**Files:**
- Create: `src/features/search/collectSearchDocs.ts`

**Step 1: Implement**

There is no unit test for this task — it is IO orchestration against IndexedDB, and the project's test scope is deliberately pure logic. The projection logic it calls is already covered by Tasks 2–4. Verify with `npm run build` and, at the end, in the running app.

```ts
/**
 * Gathers every searchable entity for a campaign and projects it into
 * {@link SearchDoc}s.
 *
 * @remarks
 * All reads go through repositories, which exclude soft-deleted rows by
 * default — that is why nothing here filters `deletedAt`.
 *
 * Campaign-scoped: notes, KB nodes, sessions, encounters, ships.
 * Active-character-scoped: gear and skills. Indexing every character's
 * inventory would return four characters' rifles for one query.
 */

import { getNotesByCampaign } from '../../storage/repositories/noteRepository';
import {
  getNodesByCampaign,
  getSharedNodes,
} from '../../storage/repositories/kbNodeRepository';
import { getSessionsByCampaign } from '../../storage/repositories/sessionRepository';
import { listByCampaign as listEncountersByCampaign } from '../../storage/repositories/encounterRepository';
import { listByCampaign as listShipsByCampaign } from '../../storage/repositories/shipRepository';
import {
  noteToSearchDoc,
  kbNodeToSearchDoc,
  sessionToSearchDoc,
  encounterToSearchDoc,
  shipToSearchDoc,
  inventoryItemToSearchDoc,
  skillToSearchDoc,
} from './adapters';
import type { SearchDoc } from './types';
import type { CharacterRecord } from '../../types/character';
import type { SystemDefinition } from '../../types/system';

/** Inputs for one index build. */
export interface CollectSearchDocsInput {
  campaignId: string;
  /** Active character, for gear and skills. Omit to index campaign data only. */
  character?: CharacterRecord | null;
  /** Active system definition, which is where skill *names* live. */
  system?: SystemDefinition | null;
}

/** Loads and projects every searchable entity. */
export async function collectSearchDocs({
  campaignId,
  character,
  system,
}: CollectSearchDocsInput): Promise<SearchDoc[]> {
  const [notes, campaignNodes, sharedNodes, sessions, encounters, ships] =
    await Promise.all([
      getNotesByCampaign(campaignId),
      getNodesByCampaign(campaignId),
      getSharedNodes(),
      getSessionsByCampaign(campaignId),
      listEncountersByCampaign(campaignId),
      listShipsByCampaign(campaignId),
    ]);

  const docs: SearchDoc[] = [
    ...notes.map(noteToSearchDoc),
    ...[...campaignNodes, ...sharedNodes].map(kbNodeToSearchDoc),
    ...sessions.map(sessionToSearchDoc),
    ...encounters.map(encounterToSearchDoc),
    ...ships.map(shipToSearchDoc),
  ];

  if (character) {
    docs.push(...(character.inventory ?? []).map(inventoryItemToSearchDoc));
  }

  // Only index skills the character actually has an entry for, so the palette
  // does not list the whole ruleset.
  if (character && system) {
    for (const category of system.skillCategories ?? []) {
      for (const definition of category.skills) {
        if (character.skills?.[definition.id]) {
          docs.push(skillToSearchDoc(definition, category.name));
        }
      }
    }
  }

  return docs;
}
```

**Step 2: Verify it compiles**

Run: `npm run build`
Expected: builds clean.

If the build complains that `listByCampaign` is not exported from `encounterRepository` or `shipRepository`, open those files and use the actual exported name — both were confirmed to export `listByCampaign`, but verify rather than guess.

**Step 3: Commit**

```bash
git add src/features/search/collectSearchDocs.ts
git commit -m "feat(search): collect searchable docs across campaign and character"
```

---

## Task 8: The `useGlobalSearch` hook

**Files:**
- Create: `src/features/search/useGlobalSearch.ts`

**Step 1: Implement**

```ts
/**
 * MiniSearch-backed global search across every indexed entity type.
 *
 * @remarks
 * The index is rebuilt whenever `enabled` flips true — that is, when the search
 * palette opens. Incremental maintenance was considered and rejected: keeping
 * an index live means hooking every repository write path (six for notes
 * alone) with "silently stale results" as the failure mode. Rebuilding a few
 * thousand documents takes tens of milliseconds, once, on a deliberate user
 * gesture.
 *
 * Indexing runs through `addAllAsync` with a chunk size so it never blocks the
 * main thread.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import MiniSearch from 'minisearch';
import { collectSearchDocs } from './collectSearchDocs';
import { buildSnippet } from './snippet';
import type { SearchDoc, SearchEntityType } from './types';
import type { CharacterRecord } from '../../types/character';
import type { SystemDefinition } from '../../types/system';

/** A search hit, ready to render. */
export interface SearchResult {
  id: string;
  entityType: SearchEntityType;
  entityId: string;
  title: string;
  subtitle: string;
  route: string;
  /** Context window around the match, or '' when there is no body text. */
  snippet: string;
}

function createIndex(): MiniSearch<SearchDoc> {
  return new MiniSearch<SearchDoc>({
    fields: ['title', 'subtitle', 'text', 'tags'],
    storeFields: ['entityType', 'entityId', 'title', 'subtitle', 'text', 'route'],
    searchOptions: {
      boost: { title: 3, tags: 2, subtitle: 1.5, text: 1 },
      // Same settings as the existing note and KB indexes.
      fuzzy: 0.2,
      prefix: true,
    },
  });
}

/** Options for {@link useGlobalSearch}. */
export interface UseGlobalSearchOptions {
  campaignId: string;
  /** Build the index only while true, so a closed palette costs nothing. */
  enabled: boolean;
  character?: CharacterRecord | null;
  system?: SystemDefinition | null;
}

/** Runs a live global search, returning ranked results for `query`. */
export function useGlobalSearch(
  query: string,
  { campaignId, enabled, character, system }: UseGlobalSearchOptions,
) {
  const indexRef = useRef<MiniSearch<SearchDoc> | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexVersion, setIndexVersion] = useState(0);

  useEffect(() => {
    if (!enabled || !campaignId) return;

    let cancelled = false;
    setIsIndexing(true);

    async function build() {
      const docs = await collectSearchDocs({ campaignId, character, system });
      if (cancelled) return;

      const index = createIndex();
      await index.addAllAsync(docs, { chunkSize: 200 });
      if (cancelled) return;

      indexRef.current = index;
      setIsIndexing(false);
      // Bump so the memo below recomputes against the freshly built index.
      setIndexVersion((v) => v + 1);
    }

    build().catch((err) => {
      if (cancelled) return;
      if (import.meta.env.DEV) console.warn('[useGlobalSearch] build failed', err);
      setIsIndexing(false);
    });

    return () => {
      cancelled = true;
    };
    // `character` and `system` are object identities; depending on their ids
    // keeps a re-render from rebuilding the whole index.
  }, [enabled, campaignId, character?.id, system?.id]);

  const results = useMemo<SearchResult[]>(() => {
    const index = indexRef.current;
    if (!index || !query.trim()) return [];

    return index.search(query).map((hit) => ({
      id: String(hit.id),
      entityType: hit.entityType as SearchEntityType,
      entityId: hit.entityId as string,
      title: hit.title as string,
      subtitle: hit.subtitle as string,
      route: hit.route as string,
      snippet: buildSnippet((hit.text as string) ?? '', hit.terms),
    }));
  }, [query, indexVersion]);

  return { results, isIndexing };
}
```

**Step 2: Verify it compiles**

Run: `npm run build`
Expected: builds clean.

If TypeScript objects to `character?.id` in the dependency array, that is expected React lint behaviour in some configs but not a type error — leave it. If `hit.terms` is not typed on the MiniSearch result, cast it: `(hit as unknown as { terms: string[] }).terms`.

**Step 3: Commit**

```bash
git add src/features/search/useGlobalSearch.ts
git commit -m "feat(search): add useGlobalSearch hook with rebuild-on-open indexing"
```

---

## Task 9: Rewire the command palette

**Files:**
- Modify: `src/features/kb/CommandPalette.tsx` → move to `src/features/search/SearchPalette.tsx`

The palette is currently KB-specific and lives under `features/kb`. It is becoming a global surface, so it moves.

**Step 1: Move the file**

```bash
git mv src/features/kb/CommandPalette.tsx src/features/search/SearchPalette.tsx
```

**Step 2: Rewrite it**

Keep the existing structure — portal, backdrop, autofocus, swipe-down dismiss, drag handle, Tailwind classes. Change: the hook, grouped rendering, snippets, the dead quick action, and the escalation footer.

Rename the component and props to `SearchPalette` / `SearchPaletteProps`.

Replace the `useKBSearch` import and call with:

```tsx
import { useGlobalSearch } from './useGlobalSearch';
import { groupByType } from './grouping';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import type { SearchResult } from './useGlobalSearch';

// inside the component:
const { character } = useActiveCharacter();
const { results, isIndexing } = useGlobalSearch(query, {
  campaignId,
  enabled: isOpen,
  character,
});
const groups = groupByType(results);
```

> Read `src/context/ActiveCharacterContext.tsx` to confirm the exact shape `useActiveCharacter()` returns before wiring it — the field may not be named `character`. Pass `system` too if the active system definition is readily available; if it is not, omit it. Skills simply will not be indexed until it is, which is acceptable for a first pass.

Replace `TYPE_COLORS` keys to cover the new entity types:

```tsx
const TYPE_COLORS: Record<string, string> = {
  note: 'bg-blue-500/10 text-blue-500',
  kb: 'bg-purple-500/10 text-purple-500',
  session: 'bg-teal-500/10 text-teal-500',
  encounter: 'bg-red-500/10 text-red-500',
  ship: 'bg-cyan-500/10 text-cyan-500',
  gear: 'bg-yellow-500/10 text-yellow-500',
  skill: 'bg-green-500/10 text-green-500',
};
```

Replace `handleResultTap`:

```tsx
const handleResultTap = (result: SearchResult) => {
  navigate(result.route);
  onClose();
};
```

Remove the `Export all` quick action entirely — it navigates nowhere and just closes the palette.

Replace the results block with grouped rendering:

```tsx
) : isIndexing && results.length === 0 ? (
  <div className="py-4 text-center text-sm text-[var(--color-text-muted)]">
    Indexing…
  </div>
) : results.length === 0 ? (
  <div className="py-4 text-center text-sm text-[var(--color-text-muted)]">
    No results for &ldquo;{query}&rdquo;
  </div>
) : (
  <>
    {groups.map((group) => (
      <div key={group.type} className="mb-3">
        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1">
          {group.label}
        </p>
        <ul className="list-none m-0 p-0">
          {group.items.map((result) => (
            <li key={result.id}>
              <button
                onClick={() => handleResultTap(result)}
                className="flex flex-col items-start w-full text-left px-3 py-2 min-h-[44px] text-sm bg-transparent border-none cursor-pointer rounded hover:bg-[var(--color-surface-raised)]"
              >
                <span className="flex items-center justify-between w-full gap-2">
                  <span className="text-[var(--color-text)] truncate">
                    {result.title}
                  </span>
                  <span
                    className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${
                      TYPE_COLORS[result.entityType] ?? TYPE_COLORS.note
                    }`}
                  >
                    {result.subtitle || result.entityType}
                  </span>
                </span>
                {result.snippet && (
                  <span className="mt-0.5 text-xs text-[var(--color-text-muted)] line-clamp-2">
                    {result.snippet}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    ))}
    <button
      onClick={() => {
        navigate(`/search?q=${encodeURIComponent(query)}`);
        onClose();
      }}
      className="w-full text-center px-3 py-2 min-h-[44px] text-sm text-[var(--color-text-muted)] bg-transparent border-none cursor-pointer rounded hover:bg-[var(--color-surface-raised)]"
    >
      See all results
    </button>
  </>
)}
```

**Step 3: Verify it compiles**

Run: `npm run build`
Expected: builds clean. `/search` does not exist yet; the footer button will 404 until Task 11.

**Step 4: Commit**

```bash
git add -A src/features/kb src/features/search
git commit -m "feat(search): rewire the palette to global search with grouped results"
```

---

## Task 10: Mount the palette

Until now nothing renders it. This is the task that makes the feature exist.

**Files:**
- Modify: `src/components/shell/ShellLayout.tsx`
- Modify: `src/components/shell/CampaignHeader.tsx`

**Step 1: Mount in `ShellLayout`**

Add state, a keyboard shortcut, and the palette itself. `ShellLayout` already owns two other modals, so this follows the existing pattern.

```tsx
import { SearchPalette } from '../../features/search/SearchPalette';
import { useCampaignContext } from '../../features/campaign/CampaignContext';

// inside ShellLayout:
const [showSearch, setShowSearch] = useState(false);
const { activeCampaign } = useCampaignContext();

useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setShowSearch((open) => !open);
    }
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, []);
```

> Read `CampaignContext.tsx` to confirm the active-campaign field name before using `activeCampaign`.

Render it alongside the other modals, and pass the open handler down to the header:

```tsx
<CampaignHeader
  onCreateCampaign={() => setShowCreateCampaign(true)}
  onManageParty={() => setShowManageParty(true)}
  onOpenSearch={() => setShowSearch(true)}
/>
...
{activeCampaign && (
  <SearchPalette
    isOpen={showSearch}
    onClose={() => setShowSearch(false)}
    campaignId={activeCampaign.id}
  />
)}
```

**Step 2: Add the header button**

In `CampaignHeader.tsx`, add `onOpenSearch: () => void` to the props interface, import `Search` from `lucide-react`, and render a button next to the existing `Menu` control:

```tsx
<button
  onClick={onOpenSearch}
  aria-label="Search"
  className="flex items-center justify-center min-w-[44px] min-h-[44px] bg-transparent border-none cursor-pointer text-text-muted hover:text-text"
>
  <Search size={20} />
</button>
```

**Step 3: Verify**

Run: `npm run build`
Expected: builds clean.

Then run `npm run dev` and check, in order:
1. The search icon appears in the header on every screen.
2. Tapping it opens the palette; `Ctrl+K` does too.
3. Typing a word from a note body returns that note, under a "Notes" heading, with a snippet.
4. A deliberate typo still finds it — that is `fuzzy: 0.2` working.
5. Tapping a note result opens the reader at `/kb/:id`. **If it does not, this is the known risk from the design doc** — note ids and KB node ids may not share a namespace. Fix by routing note results to `/note/:id/edit` instead and update `noteToSearchDoc` plus its test.
6. Swipe-down and backdrop-tap both dismiss.

**Step 4: Commit**

```bash
git add src/components/shell/ShellLayout.tsx src/components/shell/CampaignHeader.tsx
git commit -m "feat(search): mount the search palette with a header entry point and Ctrl+K"
```

---

## Task 11: The `/search` screen

**Files:**
- Create: `src/screens/SearchScreen.tsx`
- Modify: `src/routes/index.tsx`

**Step 1: Write the screen**

A thin route over the same hook, reading its initial query from `?q=`, with persistent type filters and no auto-dismiss.

```tsx
/**
 * Full-screen search results, escalated from the palette.
 *
 * @remarks
 * Shares `useGlobalSearch` with {@link SearchPalette}. The difference is
 * persistence: filters stay applied, results do not vanish on selection, and
 * snippets are longer. For digging rather than looking up.
 */

import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useGlobalSearch } from '../features/search/useGlobalSearch';
import { groupByType, TYPE_ORDER, TYPE_LABELS } from '../features/search/grouping';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import type { SearchEntityType } from '../features/search/types';

export default function SearchScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeCampaign } = useCampaignContext();
  const { character } = useActiveCharacter();

  const query = searchParams.get('q') ?? '';
  const [activeTypes, setActiveTypes] = useState<SearchEntityType[]>([]);

  const { results, isIndexing } = useGlobalSearch(query, {
    campaignId: activeCampaign?.id ?? '',
    enabled: Boolean(activeCampaign),
    character,
  });

  const filtered =
    activeTypes.length === 0
      ? results
      : results.filter((r) => activeTypes.includes(r.entityType));
  const groups = groupByType(filtered);

  const toggleType = (type: SearchEntityType) =>
    setActiveTypes((current) =>
      current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type],
    );

  return (
    <div className="p-[var(--space-md)] flex flex-col gap-[var(--space-md)]">
      <input
        value={query}
        onChange={(e) => setSearchParams({ q: e.target.value })}
        placeholder="Search everything…"
        aria-label="Search"
        className="w-full px-3 py-2 min-h-[44px] bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-sm"
      />

      <div className="flex flex-wrap gap-[var(--space-xs)]" role="group" aria-label="Filter by type">
        {TYPE_ORDER.map((type) => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            aria-pressed={activeTypes.includes(type)}
            className={`px-2 py-1 min-h-[32px] text-xs rounded border cursor-pointer ${
              activeTypes.includes(type)
                ? 'bg-[var(--color-accent)] text-[var(--color-bg)] border-transparent'
                : 'bg-transparent text-[var(--color-text-muted)] border-[var(--color-border)]'
            }`}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {isIndexing && <p className="text-sm text-[var(--color-text-muted)]">Indexing…</p>}

      {!isIndexing && query.trim() !== '' && filtered.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">
          No results for &ldquo;{query}&rdquo;
        </p>
      )}

      {groups.map((group) => (
        <section key={group.type}>
          <h2 className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-1">
            {group.label}
          </h2>
          <ul className="list-none m-0 p-0 flex flex-col gap-[var(--space-xs)]">
            {group.items.map((result) => (
              <li key={result.id}>
                <button
                  onClick={() => navigate(result.route)}
                  className="flex flex-col items-start w-full text-left px-3 py-2 min-h-[44px] rounded bg-transparent border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface-raised)]"
                >
                  <span className="text-sm text-[var(--color-text)]">{result.title}</span>
                  {result.subtitle && (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {result.subtitle}
                    </span>
                  )}
                  {result.snippet && (
                    <span className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {result.snippet}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

**Step 2: Register the route**

In `src/routes/index.tsx`, import the screen and add it inside the `ShellLayout` children, next to `/reference`:

```tsx
import SearchScreen from '../screens/SearchScreen';
// ...
{ path: '/search', element: <SearchScreen /> },
```

Place it **before** the catch-all `{ path: '*' }` entry.

**Step 3: Verify**

Run: `npm run build`
Expected: builds clean.

Then in `npm run dev`: open the palette, type a query, tap "See all results", and confirm the screen loads with the query pre-filled and filters that narrow results.

**Step 4: Commit**

```bash
git add src/screens/SearchScreen.tsx src/routes/index.tsx
git commit -m "feat(search): add the /search screen with type filters"
```

---

## Task 12: Retire `useKBSearch`

**Files:**
- Delete: `src/features/kb/useKBSearch.ts`

**Step 1: Confirm it has no consumers**

Run: `grep -rn "useKBSearch" src/`
Expected: only `src/features/kb/useKBSearch.ts` itself. If anything else appears, stop and migrate that consumer to `useGlobalSearch` first.

**Step 2: Delete**

```bash
git rm src/features/kb/useKBSearch.ts
```

**Step 3: Verify**

Run: `npm run build && npm test`
Expected: both clean.

**Step 4: Commit**

```bash
git commit -m "refactor(search): retire useKBSearch, superseded by the unified index"
```

---

## Final Verification

Run the full suite and build:

```bash
npm test
npm run build
```

Then exercise the feature in `npm run dev` against a campaign with real data:

- [ ] Search icon present in the header on every screen
- [ ] `Ctrl/Cmd+K` toggles the palette
- [ ] A word from a note *body* finds that note
- [ ] A session-log entry is findable
- [ ] A typo still finds the right result
- [ ] Results are grouped, notes first
- [ ] Snippets show the match in context
- [ ] Every result type navigates somewhere sensible
- [ ] A soft-deleted note does **not** appear in results
- [ ] "See all results" opens `/search` with the query intact
- [ ] Type filters narrow results
- [ ] Palette dismisses via backdrop tap and swipe-down

The soft-delete check is the one most worth doing deliberately: delete a note, reopen the palette, and confirm it is gone. That verifies the rebuild-on-open decision end to end.

---

## Out of Scope

Do not do these as part of this plan:

- **Do not modify `useNoteSearch`.** It serves `PromoteEntriesSheet`. It duplicates some of `useGlobalSearch`, but collapsing them means touching a working promote flow to save about thirty lines. Revisit after global search has survived a real session.
- No search operators (`tag:`, `type:`). The type filters cover it.
- No saved searches or search history.
- No incremental index maintenance. That is the decision this design deliberately rejects.
