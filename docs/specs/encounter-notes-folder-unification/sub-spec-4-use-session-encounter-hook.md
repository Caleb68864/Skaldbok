---
type: phase-spec
sub_spec: 4
title: "useSessionEncounter Hook + Context"
master_spec: "docs/specs/2026-04-10-encounter-notes-folder-unification.md"
dependencies: [3]
wave: 4
---

# Sub-Spec 4 — `useSessionEncounter` Hook + Context

## Scope

Create `src/features/session/useSessionEncounter.ts` exporting the hook that is the single source of truth for "what encounter is active in this session." Create `src/features/session/SessionEncounterContext.tsx` exporting a React context and `SessionEncounterProvider` component. The hook exposes `startEncounter`, `endEncounter`, `reopenEncounter` with transactional invariants. The provider instantiates the hook exactly once at the session-screen level; all child components consume via the context.

## Context

- Sub-Spec 3 added the repository methods this hook calls (`getActiveEncounterForSession`, `getRecentEndedEncountersForSession`, `pushSegment`, `endActiveSegment`).
- The invariant is: **at most one active encounter per session**. Enforced inside `startEncounter` and `reopenEncounter` by re-reading at write time and auto-ending any other active encounter in the same Dexie transaction.
- The cross-tab staleness edge is handled by re-querying at write time, not by reactive subscriptions (per the red-team fix).
- Use the existing `generateId` and `nowISO` utilities.

## Implementation Steps

### Step 1 — Create `useSessionEncounter.ts`

**File:** `src/features/session/useSessionEncounter.ts` (new)

```ts
import { useCallback, useEffect, useState } from 'react';
import { db } from '../../storage/db/client';
import * as encounterRepository from '../../storage/repositories/encounterRepository';
import * as entityLinkRepository from '../../storage/repositories/entityLinkRepository';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import type { Encounter } from '../../types/encounter';

export interface StartEncounterInput {
  title: string;
  type: 'combat' | 'social' | 'exploration';
  description?: unknown; // ProseMirror JSON
  tags?: string[];
  location?: string;
  /**
   * Parent encounter override for the auto-generated happened_during edge.
   * - `undefined` (or omitted): auto-link to the currently-active encounter (if any)
   * - `null`: do NOT create a happened_during edge even if one is active
   * - specific id: use that id as the parent
   */
  parentOverride?: string | null;
}

export interface UseSessionEncounterResult {
  activeEncounter: Encounter | null;
  recentEnded: Encounter[];
  loading: boolean;
  startEncounter: (input: StartEncounterInput) => Promise<Encounter>;
  endEncounter: (id: string, summary?: unknown) => Promise<void>;
  reopenEncounter: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const VALID_TYPES = new Set(['combat', 'social', 'exploration']);

export function useSessionEncounter(sessionId: string): UseSessionEncounterResult {
  const [activeEncounter, setActiveEncounter] = useState<Encounter | null>(null);
  const [recentEnded, setRecentEnded] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const [active, ended] = await Promise.all([
        encounterRepository.getActiveEncounterForSession(sessionId),
        encounterRepository.getRecentEndedEncountersForSession(sessionId, 3),
      ]);
      setActiveEncounter(active);
      setRecentEnded(ended);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startEncounter = useCallback(
    async (input: StartEncounterInput): Promise<Encounter> => {
      // Validate input eagerly
      if (!input.title || input.title.trim().length === 0) {
        throw new Error('useSessionEncounter.startEncounter: title is required');
      }
      if (!VALID_TYPES.has(input.type)) {
        throw new Error(
          `useSessionEncounter.startEncounter: type must be combat|social|exploration (got: ${input.type})`,
        );
      }
      if (!sessionId) {
        throw new Error('useSessionEncounter.startEncounter: sessionId is required');
      }

      // Load the session's campaignId (needed for the new encounter row)
      const session = await db.sessions.get(sessionId);
      if (!session) {
        throw new Error(`useSessionEncounter.startEncounter: session ${sessionId} not found`);
      }

      let createdEncounter: Encounter | null = null;

      await db.transaction('rw', [db.encounters, db.entityLinks, db.sessions], async () => {
        // Re-read active encounter INSIDE the transaction to win last-writer races
        const priorActive = await encounterRepository.getActiveEncounterForSession(sessionId);

        // Auto-end any prior active
        if (priorActive) {
          await encounterRepository.endActiveSegment(priorActive.id);
        }

        // Create the new encounter with one open segment
        const now = nowISO();
        const newId = generateId();
        const newEncounter: Encounter = {
          id: newId,
          sessionId,
          campaignId: session.campaignId,
          title: input.title.trim(),
          type: input.type,
          status: 'active',
          description: input.description,
          body: undefined,
          summary: undefined,
          tags: input.tags ?? [],
          location: input.location,
          segments: [{ startedAt: now }],
          participants: [],
          schemaVersion: 1,
          createdAt: now,
          updatedAt: now,
        };
        await db.encounters.add(newEncounter);

        // Decide parent linkage
        let parentId: string | null = null;
        if (input.parentOverride === null) {
          parentId = null; // explicit opt-out
        } else if (input.parentOverride !== undefined) {
          parentId = input.parentOverride;
        } else if (priorActive) {
          parentId = priorActive.id; // auto
        }

        if (parentId) {
          await entityLinkRepository.createLink({
            fromEntityId: newId,
            fromEntityType: 'encounter',
            toEntityId: parentId,
            toEntityType: 'encounter',
            relationshipType: 'happened_during',
          });
        }

        createdEncounter = newEncounter;
      });

      await refresh();
      if (!createdEncounter) throw new Error('startEncounter: transaction completed without setting created encounter');
      return createdEncounter;
    },
    [sessionId, refresh],
  );

  const endEncounter = useCallback(
    async (id: string, summary?: unknown): Promise<void> => {
      const existing = await db.encounters.get(id);
      if (!existing) {
        throw new Error(`useSessionEncounter.endEncounter: encounter ${id} not found`);
      }

      await db.transaction('rw', [db.encounters], async () => {
        await encounterRepository.endActiveSegment(id);
        const updates: Record<string, unknown> = {
          status: 'ended',
          updatedAt: nowISO(),
        };
        if (summary !== undefined) updates.summary = summary;
        await db.encounters.update(id, updates);
      });

      await refresh();
    },
    [refresh],
  );

  const reopenEncounter = useCallback(
    async (id: string): Promise<void> => {
      const existing = await db.encounters.get(id);
      if (!existing) {
        throw new Error(`useSessionEncounter.reopenEncounter: encounter ${id} not found`);
      }
      if (existing.deletedAt) {
        throw new Error(`useSessionEncounter.reopenEncounter: encounter ${id} is deleted`);
      }

      await db.transaction('rw', [db.encounters], async () => {
        // End any other active encounter first
        const priorActive = await encounterRepository.getActiveEncounterForSession(sessionId);
        if (priorActive && priorActive.id !== id) {
          await encounterRepository.endActiveSegment(priorActive.id);
        }

        // Push a new open segment onto the target
        await encounterRepository.pushSegment(id, { startedAt: nowISO() });

        // Update status back to active
        await db.encounters.update(id, {
          status: 'active',
          updatedAt: nowISO(),
        });
      });

      await refresh();
    },
    [sessionId, refresh],
  );

  return {
    activeEncounter,
    recentEnded,
    loading,
    startEncounter,
    endEncounter,
    reopenEncounter,
    refresh,
  };
}
```

### Step 2 — Create `SessionEncounterContext.tsx`

**File:** `src/features/session/SessionEncounterContext.tsx` (new)

```tsx
import React, { createContext, useContext } from 'react';
import { useSessionEncounter } from './useSessionEncounter';
import type { UseSessionEncounterResult } from './useSessionEncounter';

const SessionEncounterContext = createContext<UseSessionEncounterResult | null>(null);

export function SessionEncounterProvider({
  sessionId,
  children,
}: {
  sessionId: string;
  children: React.ReactNode;
}) {
  const value = useSessionEncounter(sessionId);
  return (
    <SessionEncounterContext.Provider value={value}>
      {children}
    </SessionEncounterContext.Provider>
  );
}

/**
 * Consume the session-scoped encounter state.
 * MUST be used inside a <SessionEncounterProvider>.
 */
export function useSessionEncounterContext(): UseSessionEncounterResult {
  const ctx = useContext(SessionEncounterContext);
  if (!ctx) {
    throw new Error(
      'useSessionEncounterContext must be used inside a <SessionEncounterProvider>',
    );
  }
  return ctx;
}
```

### Step 3 — Build and lint

```bash
npm run build
npm run lint
```

Both must exit zero.

### Step 4 — Commit

```
feat(session): useSessionEncounter hook + provider context

- Create src/features/session/useSessionEncounter.ts with
  startEncounter, endEncounter, reopenEncounter, activeEncounter,
  recentEnded, refresh
- Every mutation is wrapped in a Dexie transaction that re-reads the
  active encounter at write time (cross-tab correctness)
- Input validation throws with descriptive errors
- reopenEncounter ends any other active encounter first
- Create src/features/session/SessionEncounterContext.tsx exporting
  SessionEncounterProvider (instantiates the hook once) and
  useSessionEncounterContext consumer
```

## Interface Contracts

### `useSessionEncounter(sessionId)`
- Direction: Sub-Spec 4 → Sub-Spec 6, Sub-Spec 7, Sub-Spec 8
- Owner: Sub-Spec 4
- Shape:
  ```ts
  useSessionEncounter(sessionId: string): {
    activeEncounter: Encounter | null;
    recentEnded: Encounter[];
    loading: boolean;
    startEncounter(input: StartEncounterInput): Promise<Encounter>;
    endEncounter(id: string, summary?: unknown): Promise<void>;
    reopenEncounter(id: string): Promise<void>;
    refresh(): Promise<void>;
  }
  ```

### `SessionEncounterProvider` + `useSessionEncounterContext`
- Direction: Sub-Spec 4 → Sub-Spec 7 (provider mount) → Sub-Spec 6, Sub-Spec 8 (consumers)
- Owner: Sub-Spec 4
- Shape:
  - `<SessionEncounterProvider sessionId={sessionId}>{children}</SessionEncounterProvider>` — instantiates the hook exactly once
  - `useSessionEncounterContext(): UseSessionEncounterResult` — throws if used outside the provider

### Input validation contract
- Owner: Sub-Spec 4
- Shape:
  - `startEncounter({title: ''})` throws `Error('useSessionEncounter.startEncounter: title is required')`
  - `startEncounter({type: 'invalid'})` throws `Error('useSessionEncounter.startEncounter: type must be combat|social|exploration ...')`
  - `endEncounter(nonExistent)` throws
  - `reopenEncounter(nonExistent)` throws; `reopenEncounter(softDeleted)` throws

## Verification Commands

```bash
npm run build
npm run lint
```

### Mechanical checks
```bash
test -f src/features/session/useSessionEncounter.ts || (echo "FAIL: useSessionEncounter.ts not found" && exit 1)
test -f src/features/session/SessionEncounterContext.tsx || (echo "FAIL: SessionEncounterContext.tsx not found" && exit 1)
grep -q "export function useSessionEncounter" src/features/session/useSessionEncounter.ts || (echo "FAIL: useSessionEncounter not exported" && exit 1)
grep -q "export function SessionEncounterProvider" src/features/session/SessionEncounterContext.tsx || (echo "FAIL: provider not exported" && exit 1)
grep -q "export function useSessionEncounterContext" src/features/session/SessionEncounterContext.tsx || (echo "FAIL: context consumer not exported" && exit 1)
grep -q "happened_during" src/features/session/useSessionEncounter.ts || (echo "FAIL: happened_during edge not created" && exit 1)
grep -q "db.transaction" src/features/session/useSessionEncounter.ts || (echo "FAIL: hook does not use Dexie transaction" && exit 1)
grep -q "startEncounter: title is required" src/features/session/useSessionEncounter.ts || (echo "FAIL: title validation missing" && exit 1)
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| `useSessionEncounter.ts` exists | [STRUCTURAL] | `test -f src/features/session/useSessionEncounter.ts \|\| (echo "FAIL: useSessionEncounter.ts not found" && exit 1)` |
| `SessionEncounterContext.tsx` exists | [STRUCTURAL] | `test -f src/features/session/SessionEncounterContext.tsx \|\| (echo "FAIL: context not found" && exit 1)` |
| Hook is exported | [STRUCTURAL] | `grep -q "export function useSessionEncounter" src/features/session/useSessionEncounter.ts \|\| (echo "FAIL: hook not exported" && exit 1)` |
| Provider is exported | [STRUCTURAL] | `grep -q "export function SessionEncounterProvider" src/features/session/SessionEncounterContext.tsx \|\| (echo "FAIL: provider not exported" && exit 1)` |
| Context consumer is exported | [STRUCTURAL] | `grep -q "export function useSessionEncounterContext" src/features/session/SessionEncounterContext.tsx \|\| (echo "FAIL: context consumer not exported" && exit 1)` |
| `happened_during` edge is created | [STRUCTURAL] | `grep -q "happened_during" src/features/session/useSessionEncounter.ts \|\| (echo "FAIL: happened_during edge not created" && exit 1)` |
| Uses Dexie transaction | [STRUCTURAL] | `grep -q "db.transaction" src/features/session/useSessionEncounter.ts \|\| (echo "FAIL: no Dexie transaction" && exit 1)` |
| Input validation throws on empty title | [STRUCTURAL] | `grep -q "title is required" src/features/session/useSessionEncounter.ts \|\| (echo "FAIL: title validation missing" && exit 1)` |
| Input validation throws on invalid type | [STRUCTURAL] | `grep -q "type must be combat" src/features/session/useSessionEncounter.ts \|\| (echo "FAIL: type validation missing" && exit 1)` |
| Build succeeds | [MECHANICAL] | `npm run build 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
| Lint succeeds | [MECHANICAL] | `npm run lint 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: lint failed" && exit 1)` |
