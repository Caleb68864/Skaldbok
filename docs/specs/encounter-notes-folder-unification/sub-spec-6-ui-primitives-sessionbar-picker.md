---
type: phase-spec
sub_spec: 6
title: "UI Primitives: SessionBar + EncounterParticipantPicker"
master_spec: "docs/specs/2026-04-10-encounter-notes-folder-unification.md"
dependencies: [4, 5]
wave: 6
---

# Sub-Spec 6 — UI Primitives: `SessionBar` + `EncounterParticipantPicker`

## Scope

Create two new presentation components:
1. `SessionBar` — renders the active encounter chip and up to 3 "Recently ended" reopen chips. Consumes `SessionEncounterContext`.
2. `EncounterParticipantPicker` — search-driven bestiary picker with an inline "Create new…" path.

Both use Tailwind utilities, Radix primitives where interactive, and consume data via the hooks from Sub-Specs 4 and 5.

## Context

- `SessionBar` lives inside the `<SessionEncounterProvider>` that Sub-Spec 7 will mount in `SessionScreen`. It consumes via `useSessionEncounterContext()`.
- `EncounterParticipantPicker` is consumed by Sub-Spec 7's `EncounterScreen` (inside the Participants section). It calls `useEncounter.addParticipantFromTemplate` from Sub-Spec 5.
- `CreatureTemplate` CRUD for the inline "Create new" path goes through `creatureTemplateRepository`.
- Toast for auto-end-previous is fired from Sub-Spec 7 (where `startEncounter` is called). SessionBar just renders the state.
- Radix primitives already in the project: `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `@radix-ui/react-tooltip`, `@radix-ui/react-collapsible`.

## Implementation Steps

### Step 1 — `SessionBar.tsx`

**File:** `src/features/session/SessionBar.tsx` (new)

```tsx
import { useSessionEncounterContext } from './SessionEncounterContext';

interface SessionBarProps {
  /** Called when the user clicks the active encounter chip (opens EncounterScreen). */
  onActiveEncounterClick?: (encounterId: string) => void;
}

export function SessionBar({ onActiveEncounterClick }: SessionBarProps) {
  const { activeEncounter, recentEnded, reopenEncounter, loading } = useSessionEncounterContext();

  if (loading) {
    return <div className="text-sm text-neutral-500 px-4 py-2">Loading session…</div>;
  }

  return (
    <div className="flex flex-col gap-1 px-4 py-2 border-b border-neutral-200 bg-neutral-50">
      {/* Active encounter chip */}
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-neutral-500">Active:</span>
        {activeEncounter ? (
          <button
            type="button"
            onClick={() => onActiveEncounterClick?.(activeEncounter.id)}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-900 text-sm font-medium hover:bg-blue-200"
          >
            <span>{activeEncounter.title}</span>
            <span className="text-xs text-blue-700">({activeEncounter.type})</span>
          </button>
        ) : (
          <span className="text-sm text-neutral-400">no encounter active</span>
        )}
      </div>

      {/* Recently ended — hidden entirely when empty */}
      {recentEnded.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Recently ended:</span>
          {recentEnded.map((enc) => (
            <button
              key={enc.id}
              type="button"
              onClick={() => reopenEncounter(enc.id)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700 text-xs hover:bg-neutral-300"
              title={`Reopen ${enc.title}`}
            >
              ↺ {enc.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 2 — `EncounterParticipantPicker.tsx`

**File:** `src/features/encounters/EncounterParticipantPicker.tsx` (new)

```tsx
import { useState, useEffect, useCallback } from 'react';
import * as creatureTemplateRepository from '../../storage/repositories/creatureTemplateRepository';
import type { CreatureTemplate } from '../../types/creatureTemplate';

export interface EncounterParticipantPickerProps {
  /** Called with the selected (or newly-created) creature template. */
  onSelect: (template: CreatureTemplate) => Promise<void> | void;
  /** The campaign id needed to create new bestiary entries inline. */
  campaignId: string;
  /** Called when the picker should close (submitted or cancelled). */
  onClose?: () => void;
}

type Mode = 'search' | 'create';

export function EncounterParticipantPicker({
  onSelect,
  campaignId,
  onClose,
}: EncounterParticipantPickerProps) {
  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CreatureTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Inline create form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<'monster' | 'npc' | 'animal'>('monster');
  const [newHp, setNewHp] = useState<string>('');
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const all = await creatureTemplateRepository.getByCampaign(campaignId);
        if (cancelled) return;
        const filtered = query.trim()
          ? all.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()))
          : all;
        setResults(filtered);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [campaignId, query]);

  const handleSelectExisting = useCallback(
    async (template: CreatureTemplate) => {
      setSubmitting(true);
      try {
        await onSelect(template);
        onClose?.();
      } finally {
        setSubmitting(false);
      }
    },
    [onSelect, onClose],
  );

  const handleCreateNew = useCallback(async () => {
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      const hpNum = newHp ? parseInt(newHp, 10) : 0;
      const created = await creatureTemplateRepository.create({
        campaignId,
        name: newName.trim(),
        description: newDescription.trim(),
        category: newCategory,
        stats: { hp: isNaN(hpNum) ? 0 : hpNum, armor: 0, movement: 0 },
        attacks: [],
        abilities: [],
        skills: [],
        tags: [],
        status: 'active',
      });
      await onSelect(created);
      onClose?.();
    } finally {
      setSubmitting(false);
    }
  }, [newName, newCategory, newHp, newDescription, campaignId, onSelect, onClose]);

  if (mode === 'create') {
    return (
      <div className="p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Create new bestiary entry</h3>
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="px-2 py-1 border border-neutral-300 rounded"
            placeholder="e.g. Kobold Skirmisher"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as 'monster' | 'npc' | 'animal')}
            className="px-2 py-1 border border-neutral-300 rounded"
          >
            <option value="monster">Monster</option>
            <option value="npc">NPC</option>
            <option value="animal">Animal</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          HP (optional)
          <input
            type="number"
            value={newHp}
            onChange={(e) => setNewHp(e.target.value)}
            className="px-2 py-1 border border-neutral-300 rounded"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Description (optional)
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="px-2 py-1 border border-neutral-300 rounded"
            rows={2}
          />
        </label>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setMode('search')}
            className="px-3 py-1 text-sm text-neutral-600"
            disabled={submitting}
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleCreateNew}
            disabled={!newName.trim() || submitting}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Create and add
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-2 min-w-[320px]">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search bestiary…"
        className="px-2 py-1 border border-neutral-300 rounded"
      />
      {loading ? (
        <div className="text-sm text-neutral-500 py-2">Searching…</div>
      ) : (
        <ul className="flex flex-col gap-1 max-h-64 overflow-auto">
          {results.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => handleSelectExisting(t)}
                disabled={submitting}
                className="w-full text-left px-2 py-1 text-sm hover:bg-neutral-100 rounded"
              >
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-xs text-neutral-500">{t.category}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && !loading && (
            <li className="text-xs text-neutral-500 px-2 py-1">No matches</li>
          )}
        </ul>
      )}
      {query.trim() && (
        <button
          type="button"
          onClick={() => {
            setNewName(query.trim());
            setMode('create');
          }}
          className="text-left px-2 py-1 text-sm border-t border-neutral-200 mt-1 hover:bg-neutral-50"
        >
          + Create new "{query.trim()}"
        </button>
      )}
    </div>
  );
}
```

### Step 3 — Build and lint

```bash
npm run build
npm run lint
```

### Step 4 — Commit

```
feat(ui): SessionBar + EncounterParticipantPicker primitives

- SessionBar renders active encounter chip and up to 3 Recently Ended
  reopen chips; hides the recently-ended row entirely when empty
- Consumes SessionEncounterContext (does not instantiate the hook
  itself — single source rule)
- EncounterParticipantPicker has search + "Create new" paths
- Create new mints a CreatureTemplate via creatureTemplateRepository
  and the caller wires the represents edge via addParticipantFromTemplate
```

## Interface Contracts

### `SessionBar`
- Direction: Sub-Spec 6 → Sub-Spec 7
- Owner: Sub-Spec 6
- Shape: `<SessionBar onActiveEncounterClick={(id) => void} />`. Consumes via `useSessionEncounterContext()`. MUST be rendered inside a `SessionEncounterProvider`.

### `EncounterParticipantPicker`
- Direction: Sub-Spec 6 → Sub-Spec 7 (inside EncounterScreen Participants section)
- Owner: Sub-Spec 6
- Shape: `<EncounterParticipantPicker onSelect={(template) => Promise<void>} campaignId={string} onClose={() => void} />`.
- Behavior: picking an existing result calls `onSelect(template)`. "Create new" creates the bestiary entry first, then calls `onSelect(newTemplate)`. The caller is responsible for wiring the `represents` edge via `useEncounter.addParticipantFromTemplate`.

## Verification Commands

```bash
npm run build
npm run lint
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| `SessionBar.tsx` exists | [STRUCTURAL] | `test -f src/features/session/SessionBar.tsx \|\| (echo "FAIL: SessionBar not found" && exit 1)` |
| `SessionBar` is exported | [STRUCTURAL] | `grep -q "export function SessionBar" src/features/session/SessionBar.tsx \|\| (echo "FAIL: SessionBar not exported" && exit 1)` |
| `SessionBar` consumes the context (not the hook directly) | [STRUCTURAL] | `grep -q "useSessionEncounterContext" src/features/session/SessionBar.tsx \|\| (echo "FAIL: SessionBar does not consume context" && exit 1)` |
| `EncounterParticipantPicker.tsx` exists | [STRUCTURAL] | `test -f src/features/encounters/EncounterParticipantPicker.tsx \|\| (echo "FAIL: picker not found" && exit 1)` |
| `EncounterParticipantPicker` is exported | [STRUCTURAL] | `grep -q "export function EncounterParticipantPicker" src/features/encounters/EncounterParticipantPicker.tsx \|\| (echo "FAIL: picker not exported" && exit 1)` |
| Picker references `creatureTemplateRepository` | [STRUCTURAL] | `grep -q "creatureTemplateRepository" src/features/encounters/EncounterParticipantPicker.tsx \|\| (echo "FAIL: picker does not use creature repo" && exit 1)` |
| Picker has a Create New path | [STRUCTURAL] | `grep -q "Create new" src/features/encounters/EncounterParticipantPicker.tsx \|\| (echo "FAIL: picker missing Create new path" && exit 1)` |
| Build succeeds | [MECHANICAL] | `npm run build 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
| Lint succeeds | [MECHANICAL] | `npm run lint 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: lint failed" && exit 1)` |
