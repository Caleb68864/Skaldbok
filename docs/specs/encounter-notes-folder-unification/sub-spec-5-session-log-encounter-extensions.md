---
type: phase-spec
sub_spec: 5
title: "useSessionLog + useEncounter Extensions"
master_spec: "docs/specs/2026-04-10-encounter-notes-folder-unification.md"
dependencies: [3, 4]
wave: 5
---

# Sub-Spec 5 — `useSessionLog` + `useEncounter` Extensions

## Scope

Extend `useSessionLog` with: auto-attach in `logToSession`, `reassignNote`, `logGenericNote`, `logNpcCapture`. Extend `useEncounter` with: narrative update methods, `represents`-edge-based `addParticipantFromTemplate`, soft-delete cascade in `removeParticipant`, `getChildEncounters`, `getParentEncounter`. Remove `quickCreateParticipant`.

## Context

- Sub-Spec 4's `useSessionEncounter` is the source of "which encounter is active." This sub-spec's `logToSession` reads active via the context or via `encounterRepository.getActiveEncounterForSession` directly inside its transaction.
- The existing `useSessionLog.ts` already has `logSkillCheck`, `logSpellCast`, `logAbilityUse`, `logHPChange`, `logDeathRoll`, `logRest`, `logCoinChange` all routing through `logToSession`. Verified via grep of the existing file.
- `useEncounter.ts:39` already queries `getLinksFrom(encounterId, 'contains')`. The read side works. This sub-spec wires the write side in `logToSession`.
- `encounterRepository.addParticipantFromTemplate` — check whether it exists and where; it may be on the hook directly.

## Implementation Steps

### Step 1 — Extend `logToSession` with targetEncounterId

**File:** `src/features/session/useSessionLog.ts`

Modify the existing `logToSession` to accept an optional `targetEncounterId` parameter. The default behavior re-queries the active encounter at write time inside a Dexie transaction.

```ts
import { db } from '../../storage/db/client';
import * as encounterRepository from '../../storage/repositories/encounterRepository';
import * as entityLinkRepository from '../../storage/repositories/entityLinkRepository';

interface LogToSessionOptions {
  /**
   * Explicit encounter target for the `contains` edge.
   * - `undefined`: auto-attach to the currently-active encounter (default)
   * - `null`: do NOT attach to any encounter (session-level log)
   * - specific id: attach to that encounter
   */
  targetEncounterId?: string | null;
}

const logToSession = useCallback(async (
  title: string,
  type: string = 'generic',
  typeData?: unknown,
  options?: LogToSessionOptions,
) => {
  if (!activeSession) {
    console.warn('useSessionLog.logToSession: no active session');
    return;
  }

  const now = nowISO();
  const noteId = generateId();

  await db.transaction('rw', [db.notes, db.entityLinks], async () => {
    // Re-query active encounter at write time (cross-tab correctness)
    let attachTo: string | null = null;
    if (options?.targetEncounterId === null) {
      attachTo = null;
    } else if (options?.targetEncounterId) {
      attachTo = options.targetEncounterId;
    } else {
      const active = await encounterRepository.getActiveEncounterForSession(activeSession.id);
      attachTo = active ? active.id : null;
    }

    await db.notes.add({
      id: noteId,
      campaignId: activeSession.campaignId,
      sessionId: activeSession.id,
      title,
      body: undefined, // typeData carries type-specific info; body is optional
      type,
      typeData,
      status: 'active',
      pinned: false,
      visibility: 'public',
      scope: 'campaign',
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    });

    if (attachTo) {
      await entityLinkRepository.createLink({
        fromEntityId: attachTo,
        fromEntityType: 'encounter',
        toEntityId: noteId,
        toEntityType: 'note',
        relationshipType: 'contains',
      });
    }
  });

  return noteId;
}, [activeSession]);
```

**Update every existing typed log function** (`logSkillCheck`, `logSpellCast`, `logAbilityUse`, `logHPChange`, `logDeathRoll`, `logRest`, `logCoinChange`, `logLoot` and any others) to accept and forward an optional `options?: LogToSessionOptions` parameter. This is a backwards-compatible signature change — existing callers that don't pass options continue to work.

### Step 2 — Add `reassignNote`

```ts
const reassignNote = useCallback(async (
  noteId: string,
  newEncounterId: string | null,
): Promise<void> => {
  if (!activeSession) {
    throw new Error('useSessionLog.reassignNote: no active session');
  }

  const note = await db.notes.get(noteId);
  if (!note) {
    throw new Error(`useSessionLog.reassignNote: note ${noteId} not found`);
  }

  if (newEncounterId) {
    const target = await db.encounters.get(newEncounterId);
    if (!target) {
      throw new Error(`useSessionLog.reassignNote: encounter ${newEncounterId} not found`);
    }
    if (target.sessionId !== note.sessionId) {
      throw new Error(
        `useSessionLog.reassignNote: session mismatch (note.sessionId=${note.sessionId}, encounter.sessionId=${target.sessionId})`,
      );
    }
  }

  await db.transaction('rw', [db.entityLinks], async () => {
    // Find existing encounter→note contains edges
    const existing = await entityLinkRepository.getLinksTo(noteId, 'contains');
    const encounterEdges = existing.filter((l) => l.fromEntityType === 'encounter');

    // If already pointing at the new target, no-op
    if (
      newEncounterId &&
      encounterEdges.length === 1 &&
      encounterEdges[0].fromEntityId === newEncounterId
    ) {
      return;
    }

    // Soft-delete existing edges
    const txId = generateSoftDeleteTxId();
    const now = nowISO();
    for (const edge of encounterEdges) {
      await db.entityLinks.update(edge.id, {
        deletedAt: now,
        softDeletedBy: txId,
        updatedAt: now,
      });
    }

    // Create new edge if target is non-null
    if (newEncounterId) {
      await entityLinkRepository.createLink({
        fromEntityId: newEncounterId,
        fromEntityType: 'encounter',
        toEntityId: noteId,
        toEntityType: 'note',
        relationshipType: 'contains',
      });
    }
  });
}, [activeSession]);
```

### Step 3 — Add `logGenericNote`

```ts
const logGenericNote = useCallback(async (
  title: string,
  body: unknown, // ProseMirror JSON
  options?: LogToSessionOptions,
): Promise<string | undefined> => {
  return await logToSession(title, 'generic', { body }, options);
}, [logToSession]);
```

Note: `logToSession` above writes `body: undefined` by default; for generic notes we put the body in `typeData` to keep the `logToSession` signature uniform. The note's `typeData.body` is the ProseMirror JSON. Alternative: add a second parameter `bodyOverride` to `logToSession` — pick whichever is cleaner at implementation time; this phase spec allows either.

### Step 4 — Add `logNpcCapture`

```ts
import * as creatureTemplateRepository from '../../storage/repositories/creatureTemplateRepository';

export interface LogNpcCaptureInput {
  name: string;
  category: 'monster' | 'npc' | 'animal';
  hp?: number;
  description?: string;
  tags?: string[];
}

const logNpcCapture = useCallback(async (
  input: LogNpcCaptureInput,
  options?: LogToSessionOptions,
): Promise<{ noteId: string; creatureId: string }> => {
  if (!activeSession) {
    throw new Error('useSessionLog.logNpcCapture: no active session');
  }

  const now = nowISO();
  const creatureId = generateId();
  const noteId = generateId();

  await db.transaction(
    'rw',
    [db.creatureTemplates, db.notes, db.entityLinks],
    async () => {
      // 1. Create the bestiary entry
      await db.creatureTemplates.add({
        id: creatureId,
        campaignId: activeSession.campaignId,
        name: input.name,
        description: input.description ?? '',
        category: input.category,
        stats: {
          hp: input.hp ?? 0,
          armor: 0,
          movement: 0,
        },
        attacks: [],
        abilities: [],
        skills: [],
        tags: input.tags ?? [],
        status: 'active',
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      });

      // 2. Create the note
      await db.notes.add({
        id: noteId,
        campaignId: activeSession.campaignId,
        sessionId: activeSession.id,
        title: input.name,
        type: 'npc',
        typeData: { creatureTemplateId: creatureId, description: input.description },
        status: 'active',
        pinned: false,
        visibility: 'public',
        scope: 'campaign',
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      });

      // 3. introduced_in edge (note → session)
      await entityLinkRepository.createLink({
        fromEntityId: noteId,
        fromEntityType: 'note',
        toEntityId: activeSession.id,
        toEntityType: 'session',
        relationshipType: 'introduced_in',
      });

      // 4. contains edge to active encounter if applicable
      let attachTo: string | null = null;
      if (options?.targetEncounterId === null) {
        attachTo = null;
      } else if (options?.targetEncounterId) {
        attachTo = options.targetEncounterId;
      } else {
        const active = await encounterRepository.getActiveEncounterForSession(activeSession.id);
        attachTo = active ? active.id : null;
      }
      if (attachTo) {
        await entityLinkRepository.createLink({
          fromEntityId: attachTo,
          fromEntityType: 'encounter',
          toEntityId: noteId,
          toEntityType: 'note',
          relationshipType: 'contains',
        });
      }
    },
  );

  return { noteId, creatureId };
}, [activeSession]);
```

### Step 5 — Export the new functions

Update the `return` statement at the bottom of `useSessionLog`:

```ts
return {
  logToSession,
  logSkillCheck,
  logSpellCast,
  logAbilityUse,
  logHPChange,
  logDeathRoll,
  logRest,
  logCoinChange,
  // ...existing
  reassignNote,
  logGenericNote,
  logNpcCapture,
  hasActiveSession: !!activeSession,
};
```

### Step 6 — Extend `useEncounter` with narrative update methods

**File:** `src/features/encounters/useEncounter.ts`

Add methods that update the encounter's narrative fields. Each writes a single row update. Example:

```ts
const updateDescription = useCallback(async (description: unknown) => {
  if (!encounterId) return;
  await db.encounters.update(encounterId, {
    description,
    updatedAt: nowISO(),
  });
  await reload();
}, [encounterId, reload]);

// Mirror for updateBody, updateSummary, updateTags, updateLocation
```

### Step 7 — Update `addParticipantFromTemplate` to create `represents` edge

Locate the existing `addParticipantFromTemplate` in `useEncounter` and refactor:

```ts
const addParticipantFromTemplate = useCallback(async (
  template: CreatureTemplate | Character,
) => {
  if (!encounterId) return;
  const now = nowISO();
  const participantId = generateId();

  await db.transaction('rw', [db.encounters, db.entityLinks], async () => {
    const enc = await db.encounters.get(encounterId);
    if (!enc) throw new Error(`encounter ${encounterId} not found`);

    const newParticipant = {
      id: participantId,
      name: template.name,
      type: template.category === 'animal' ? 'monster' : template.category === 'npc' ? 'npc' : 'monster',
      instanceState: {
        currentHp: template.stats?.hp,
        conditions: [],
        notes: undefined,
      },
      sortOrder: (enc.participants?.length ?? 0) + 1,
    };

    const updatedParticipants = [...(enc.participants ?? []), newParticipant];
    await db.encounters.update(encounterId, {
      participants: updatedParticipants,
      updatedAt: now,
    });

    // Create the represents edge
    const isCreature = 'category' in template; // duck-type: CreatureTemplate has category
    await entityLinkRepository.createLink({
      fromEntityId: participantId,
      fromEntityType: 'encounterParticipant',
      toEntityId: template.id,
      toEntityType: isCreature ? 'creature' : 'character',
      relationshipType: 'represents',
    });
  });

  await reload();
}, [encounterId, reload]);
```

### Step 8 — Update `removeParticipant` to cascade-soft-delete edges

```ts
const removeParticipant = useCallback(async (participantId: string) => {
  if (!encounterId) return;
  const txId = generateSoftDeleteTxId();
  const now = nowISO();

  await db.transaction('rw', [db.encounters, db.entityLinks], async () => {
    const enc = await db.encounters.get(encounterId);
    if (!enc || !enc.participants) return;

    // Remove from the encounter's participants array
    const updatedParticipants = enc.participants.filter((p) => p.id !== participantId);
    await db.encounters.update(encounterId, {
      participants: updatedParticipants,
      updatedAt: now,
    });

    // Soft-delete outgoing represents edges from this participant
    const edges = await db.entityLinks
      .where('fromEntityId')
      .equals(participantId)
      .and((l) => l.relationshipType === 'represents')
      .toArray();
    for (const edge of edges) {
      await db.entityLinks.update(edge.id, {
        deletedAt: now,
        softDeletedBy: txId,
        updatedAt: now,
      });
    }
  });

  await reload();
}, [encounterId, reload]);
```

### Step 9 — Add `getChildEncounters` / `getParentEncounter`

```ts
const getChildEncounters = useCallback(async (): Promise<Encounter[]> => {
  if (!encounterId) return [];
  const links = await entityLinkRepository.getLinksTo(encounterId, 'happened_during');
  const childIds = links.filter((l) => l.fromEntityType === 'encounter').map((l) => l.fromEntityId);
  const children = await Promise.all(childIds.map((id) => db.encounters.get(id)));
  return children.filter((e): e is Encounter => !!e && !e.deletedAt);
}, [encounterId]);

const getParentEncounter = useCallback(async (): Promise<Encounter | null> => {
  if (!encounterId) return null;
  const links = await entityLinkRepository.getLinksFrom(encounterId, 'happened_during');
  const parentEdge = links.find((l) => l.toEntityType === 'encounter');
  if (!parentEdge) return null;
  const parent = await db.encounters.get(parentEdge.toEntityId);
  return parent && !parent.deletedAt ? parent : null;
}, [encounterId]);
```

### Step 10 — REMOVE `quickCreateParticipant`

Delete the `quickCreateParticipant` definition entirely from `useEncounter.ts`. Remove it from the hook's return. Run `grep -rn "quickCreateParticipant" src/` — if there are any remaining callers, UPDATE them to use the new `addParticipantFromTemplate` path or raise an Escalation Trigger (per the master spec — callers outside `src/features/encounters/` trigger escalation).

### Step 11 — Build and lint

```bash
npm run build
npm run lint
```

Both must exit zero. If build errors surface because of the `quickCreateParticipant` removal or FK column removal from Sub-Spec 3, fix the callers here (they're all in session/encounter feature code).

### Step 12 — Commit

```
feat(session): logToSession auto-attaches to active encounter

- Extend logToSession with {targetEncounterId?} option, re-queries
  active encounter at write time inside a Dexie transaction, creates
  contains edge in the same transaction
- Add reassignNote(noteId, newEncounterId | null) with same-session
  invariant and soft-delete-then-recreate edge pattern
- Add logGenericNote and logNpcCapture
- logNpcCapture creates a CreatureTemplate, a note, introduced_in edge,
  and optionally contains edge — all in one transaction
- Extend useEncounter with narrative update methods
- addParticipantFromTemplate creates the participant AND the represents
  edge in one transaction
- removeParticipant cascades soft-delete to outgoing represents edges
- Add getChildEncounters and getParentEncounter via happened_during
- Remove quickCreateParticipant (inline picker is the one path)
```

## Interface Contracts

### Extended `logToSession`
- Direction: Sub-Spec 5 → Sub-Spec 8
- Owner: Sub-Spec 5
- Shape: `logToSession(title, type, typeData, options?: { targetEncounterId?: string | null }): Promise<string | undefined>`

### `reassignNote`
- Direction: Sub-Spec 5 → Sub-Spec 7 (Attached log "Move to…"), future Gantt
- Owner: Sub-Spec 5
- Shape: `reassignNote(noteId: string, newEncounterId: string | null): Promise<void>`

### `logGenericNote`, `logNpcCapture`
- Direction: Sub-Spec 5 → Sub-Spec 8
- Owner: Sub-Spec 5
- Shape:
  - `logGenericNote(title: string, body: unknown, options?: LogToSessionOptions): Promise<string | undefined>`
  - `logNpcCapture(input: LogNpcCaptureInput, options?: LogToSessionOptions): Promise<{ noteId: string; creatureId: string }>`

### `useEncounter` narrative updates
- Direction: Sub-Spec 5 → Sub-Spec 7 (EncounterScreen Narrative tab)
- Owner: Sub-Spec 5
- Shape: `updateDescription(value: unknown)`, `updateBody(value: unknown)`, `updateSummary(value: unknown)`, `updateTags(value: string[])`, `updateLocation(value: string | undefined)`

### `addParticipantFromTemplate` with represents edge
- Direction: Sub-Spec 5 → Sub-Spec 6 (EncounterParticipantPicker)
- Owner: Sub-Spec 5
- Shape: `addParticipantFromTemplate(template: CreatureTemplate | Character): Promise<void>` — creates participant + represents edge in one transaction.

### `getChildEncounters` / `getParentEncounter`
- Direction: Sub-Spec 5 → Sub-Spec 7 (EncounterScreen Relations section)
- Owner: Sub-Spec 5
- Shape: `getChildEncounters(): Promise<Encounter[]>`, `getParentEncounter(): Promise<Encounter | null>`

### `quickCreateParticipant` is removed
- Direction: Sub-Spec 5 → verified in Sub-Spec 9 grep audit
- Owner: Sub-Spec 5
- Shape: no longer exists as an export from `useEncounter`.

## Verification Commands

```bash
npm run build
npm run lint
grep -rn "quickCreateParticipant" src/   # must return zero matches
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| `logToSession` accepts target encounter id option | [STRUCTURAL] | `grep -q "targetEncounterId" src/features/session/useSessionLog.ts \|\| (echo "FAIL: targetEncounterId option missing" && exit 1)` |
| `reassignNote` exported | [STRUCTURAL] | `grep -q "reassignNote" src/features/session/useSessionLog.ts \|\| (echo "FAIL: reassignNote missing" && exit 1)` |
| `logGenericNote` exported | [STRUCTURAL] | `grep -q "logGenericNote" src/features/session/useSessionLog.ts \|\| (echo "FAIL: logGenericNote missing" && exit 1)` |
| `logNpcCapture` exported | [STRUCTURAL] | `grep -q "logNpcCapture" src/features/session/useSessionLog.ts \|\| (echo "FAIL: logNpcCapture missing" && exit 1)` |
| `logToSession` creates `contains` edge | [STRUCTURAL] | `grep -q "'contains'" src/features/session/useSessionLog.ts \|\| (echo "FAIL: contains edge not created in logToSession" && exit 1)` |
| `logToSession` uses Dexie transaction | [STRUCTURAL] | `grep -q "db.transaction" src/features/session/useSessionLog.ts \|\| (echo "FAIL: no transaction in logToSession" && exit 1)` |
| `logNpcCapture` creates `introduced_in` edge | [STRUCTURAL] | `grep -q "introduced_in" src/features/session/useSessionLog.ts \|\| (echo "FAIL: introduced_in edge missing" && exit 1)` |
| `useEncounter` has narrative update methods | [STRUCTURAL] | `grep -q "updateDescription\|updateBody\|updateSummary" src/features/encounters/useEncounter.ts \|\| (echo "FAIL: narrative update methods missing" && exit 1)` |
| `addParticipantFromTemplate` creates `represents` edge | [STRUCTURAL] | `grep -q "'represents'" src/features/encounters/useEncounter.ts \|\| (echo "FAIL: represents edge not created" && exit 1)` |
| `getChildEncounters` / `getParentEncounter` exported | [STRUCTURAL] | `grep -q "getChildEncounters" src/features/encounters/useEncounter.ts && grep -q "getParentEncounter" src/features/encounters/useEncounter.ts \|\| (echo "FAIL: child/parent query methods missing" && exit 1)` |
| `quickCreateParticipant` fully removed | [MECHANICAL] | `[ $(grep -rn "quickCreateParticipant" src/ \| wc -l) -eq 0 ] \|\| (echo "FAIL: quickCreateParticipant still referenced" && exit 1)` |
| Build succeeds | [MECHANICAL] | `npm run build 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
| Lint succeeds | [MECHANICAL] | `npm run lint 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: lint failed" && exit 1)` |
