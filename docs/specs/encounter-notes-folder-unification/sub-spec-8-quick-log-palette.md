---
type: phase-spec
sub_spec: 8
title: "Quick Log Palette: New Actions + Attach-To Control"
master_spec: "docs/specs/2026-04-10-encounter-notes-folder-unification.md"
dependencies: [5, 6]
wave: 7
---

# Sub-Spec 8 — Quick Log Palette: New Actions + Attach-To Control

## Scope

Add `Note` (generic rich-text) and `NPC / Monster` actions to the Quick Log palette. Add a per-entry "Attach to:" control to every existing Quick Log form. The control defaults to the active encounter on every form open (per-entry reset, not sticky). Fire success toasts after writes.

## Context

- `src/features/session/SessionQuickActions.tsx` hosts the palette.
- `src/features/session/SessionLogOverlay.tsx` renders individual action drawers for skill check, spell, ability.
- The existing drawers for Loot, Quote, Rumor, Shopping, Skill Check live in this directory or in `src/features/session/quickActions/` or similar. Grep to find them.
- Sub-Spec 5 added `logGenericNote`, `logNpcCapture`, and the `targetEncounterId` option on `logToSession`.
- Sub-Spec 6 created `EncounterParticipantPicker` — the NPC/Monster action can reuse the same mini-form concept but routed through `logNpcCapture` (which creates both the bestiary entry AND a note).
- Sub-Spec 4's `useSessionEncounterContext` provides the active encounter for the "Attach to" control default.
- Toast helper: whatever Sub-Spec 7 set up.

## Implementation Steps

### Step 1 — Audit existing Quick Log structure

```bash
cat src/features/session/SessionQuickActions.tsx
cat src/features/session/SessionLogOverlay.tsx
ls src/features/session/ | grep -iE "quick|drawer|action"
```

List every existing action component (skill check drawer, loot drawer, quote drawer, rumor drawer, etc.) so the "Attach to" control can be added to each.

### Step 2 — Add the `Note` action

**New component:** `src/features/session/quickActions/QuickNoteAction.tsx` (or equivalent location matching existing pattern)

```tsx
import { useState } from 'react';
import { TiptapNoteEditor } from '../../../components/notes/TiptapNoteEditor';
import { useSessionLog } from '../useSessionLog';
import { AttachToControl } from './AttachToControl';

export function QuickNoteAction({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState<unknown>(undefined);
  const [attachTo, setAttachTo] = useState<string | null | 'auto'>('auto');
  const { logGenericNote } = useSessionLog();

  async function handleSubmit() {
    const target = attachTo === 'auto' ? undefined : attachTo;
    await logGenericNote(title || 'Note', body, { targetEncounterId: target });
    onClose();
  }

  return (
    <div className="p-4 flex flex-col gap-3 min-w-[360px]">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="px-2 py-1 border border-neutral-300 rounded"
      />
      <TiptapNoteEditor
        initialContent={body}
        onChange={setBody}
        campaignId={campaignId}
        placeholder="Freeform thought…"
        showToolbar
        minHeight={120}
      />
      <AttachToControl value={attachTo} onChange={setAttachTo} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1 text-sm">Cancel</button>
        <button type="button" onClick={handleSubmit} className="px-3 py-1 text-sm bg-blue-600 text-white rounded">
          Save
        </button>
      </div>
    </div>
  );
}
```

### Step 3 — Add the `NPC / Monster` action

**New component:** `src/features/session/quickActions/QuickNpcAction.tsx`

```tsx
import { useState } from 'react';
import { useSessionLog } from '../useSessionLog';
import { AttachToControl } from './AttachToControl';

export function QuickNpcAction({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'monster' | 'npc' | 'animal'>('npc');
  const [hp, setHp] = useState('');
  const [description, setDescription] = useState('');
  const [attachTo, setAttachTo] = useState<string | null | 'auto'>('auto');
  const { logNpcCapture } = useSessionLog();

  async function handleSubmit() {
    if (!name.trim()) return;
    const target = attachTo === 'auto' ? undefined : attachTo;
    await logNpcCapture(
      {
        name: name.trim(),
        category,
        hp: hp ? parseInt(hp, 10) : undefined,
        description: description.trim() || undefined,
      },
      { targetEncounterId: target },
    );
    onClose();
  }

  return (
    <div className="p-4 flex flex-col gap-3 min-w-[320px]">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-2 py-1 border border-neutral-300 rounded"
          placeholder="e.g. Drunk Patron"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Category
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as 'monster' | 'npc' | 'animal')}
          className="px-2 py-1 border border-neutral-300 rounded"
        >
          <option value="npc">NPC</option>
          <option value="monster">Monster</option>
          <option value="animal">Animal</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        HP (optional)
        <input
          type="number"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          className="px-2 py-1 border border-neutral-300 rounded"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Description (optional)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="px-2 py-1 border border-neutral-300 rounded"
          rows={2}
        />
      </label>
      <AttachToControl value={attachTo} onChange={setAttachTo} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1 text-sm">Cancel</button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
```

### Step 4 — Create the shared `AttachToControl`

**File:** `src/features/session/quickActions/AttachToControl.tsx` (new)

```tsx
import { useEffect, useState } from 'react';
import { useSessionEncounterContext } from '../SessionEncounterContext';
import * as encounterRepository from '../../../storage/repositories/encounterRepository';
import type { Encounter } from '../../../types/encounter';

interface AttachToControlProps {
  value: string | null | 'auto';
  onChange: (value: string | null | 'auto') => void;
}

export function AttachToControl({ value, onChange }: AttachToControlProps) {
  const { activeEncounter } = useSessionEncounterContext();
  const [allEncounters, setAllEncounters] = useState<Encounter[]>([]);

  // Per-entry reset: when the control mounts, force default to 'auto'
  // (which resolves to activeEncounter at submit time).
  useEffect(() => {
    onChange('auto');
    // ESLint: intentional mount-only reset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load all non-deleted encounters for this session for the dropdown
  useEffect(() => {
    if (!activeEncounter?.sessionId) return;
    let cancelled = false;
    (async () => {
      // Reuse an existing getBySession method on encounterRepository if present,
      // otherwise add one here (covered by Sub-Spec 3 adding `getBySession` is not
      // required — use the existing repo method).
      const rows = await encounterRepository.getBySession?.(activeEncounter.sessionId) ?? [];
      if (!cancelled) setAllEncounters(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeEncounter?.sessionId]);

  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-500">
      Attach to
      <select
        value={value === 'auto' ? 'auto' : value === null ? 'none' : value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'auto') onChange('auto');
          else if (v === 'none') onChange(null);
          else onChange(v);
        }}
        className="px-2 py-1 border border-neutral-300 rounded text-sm text-neutral-900"
      >
        <option value="auto">
          {activeEncounter ? `Active: ${activeEncounter.title}` : 'Session only (no encounter)'}
        </option>
        {allEncounters
          .filter((e) => e.id !== activeEncounter?.id)
          .map((e) => (
            <option key={e.id} value={e.id}>
              {e.title} ({e.status})
            </option>
          ))}
        <option value="none">Session only (no encounter)</option>
      </select>
    </label>
  );
}
```

**Note:** If `encounterRepository.getBySession` doesn't exist, add a tiny inline read here or export it from the repo in a one-line patch. Do NOT try to use `useEncounter` (that's scoped to a single encounter id).

### Step 5 — Wire the new actions into the palette

**File:** `src/features/session/SessionQuickActions.tsx`

Add `Note` and `NPC / Monster` as palette actions alongside the existing ones. Follow whatever pattern the existing actions use (likely a Radix Dropdown Menu or a palette grid). Each palette entry opens a drawer/dialog mounting the respective `QuickNoteAction` or `QuickNpcAction` component.

### Step 6 — Add `AttachToControl` to every existing Quick Log form

Enumerate the existing forms from Step 1's grep. For each one:

1. Import `AttachToControl`.
2. Add state: `const [attachTo, setAttachTo] = useState<string | null | 'auto'>('auto');`
3. Render `<AttachToControl value={attachTo} onChange={setAttachTo} />` above the submit button.
4. In the submit handler, resolve `const target = attachTo === 'auto' ? undefined : attachTo;` and pass `{ targetEncounterId: target }` as the last argument to the `logXxx(...)` call.
5. Each existing typed log function (`logSkillCheck`, `logLoot`, etc.) already accepts the `options` parameter from Sub-Spec 5's signature update.

### Step 7 — Fire success toasts

After a successful Quick Log write, fire a toast:

- If attached to an encounter: `toast({ title: \`Logged to ${encounterTitle}\`, duration: 2000 })`
- If not attached: `toast({ title: 'Logged to session', duration: 2000 })`

This can be done centrally in each action's submit handler after the `logXxx` call resolves. Prefer to extract a tiny helper:

```tsx
function useQuickLogToast() {
  const { activeEncounter } = useSessionEncounterContext();
  return (attachTo: string | null | 'auto') => {
    let targetTitle: string | null = null;
    if (attachTo === 'auto' && activeEncounter) targetTitle = activeEncounter.title;
    else if (typeof attachTo === 'string' && attachTo !== 'auto') {
      // Look up the title if needed, or accept that the fallback is fine.
      targetTitle = 'encounter';
    }
    if (targetTitle) {
      toast({ title: `Logged to ${targetTitle}`, duration: 2000 });
    } else {
      toast({ title: 'Logged to session', duration: 2000 });
    }
  };
}
```

### Step 8 — Build and lint

```bash
npm run build
npm run lint
```

### Step 9 — Commit

```
feat(session): Quick Log gains Note + NPC actions and attach-to control

- Add QuickNoteAction (generic rich-text) calling logGenericNote
- Add QuickNpcAction (minimal creature form) calling logNpcCapture
- Add AttachToControl — a per-entry reset select that defaults to
  the active encounter; options include active, other encounters in
  session, and "session only"
- Wire AttachToControl into every existing Quick Log form so
  targetEncounterId is passed to the typed log calls
- Fire success toasts after every successful Quick Log write:
  "Logged to {encounter}" or "Logged to session"
```

## Interface Contracts

### `QuickNoteAction`
- Consumer of: `logGenericNote` (Sub-Spec 5), `AttachToControl` (Sub-Spec 8), `TiptapNoteEditor` (existing)

### `QuickNpcAction`
- Consumer of: `logNpcCapture` (Sub-Spec 5), `AttachToControl` (Sub-Spec 8)

### `AttachToControl`
- Consumer of: `useSessionEncounterContext` (Sub-Spec 4), `encounterRepository.getBySession`
- Behavior: resets to `'auto'` on every mount (per-entry reset, not sticky); emits `'auto' | string | null`

### Success toast pattern
- Consumer of: the existing toast helper or a new one (Sub-Spec 7 may set it up)
- Pattern: `toast({title: "Logged to {X}", duration: 2000})` after every successful write.

## Verification Commands

```bash
npm run build
npm run lint
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| `QuickNoteAction.tsx` exists | [STRUCTURAL] | `test -f src/features/session/quickActions/QuickNoteAction.tsx \|\| (echo "FAIL: QuickNoteAction not found" && exit 1)` |
| `QuickNpcAction.tsx` exists | [STRUCTURAL] | `test -f src/features/session/quickActions/QuickNpcAction.tsx \|\| (echo "FAIL: QuickNpcAction not found" && exit 1)` |
| `AttachToControl.tsx` exists | [STRUCTURAL] | `test -f src/features/session/quickActions/AttachToControl.tsx \|\| (echo "FAIL: AttachToControl not found" && exit 1)` |
| `QuickNoteAction` calls `logGenericNote` | [STRUCTURAL] | `grep -q "logGenericNote" src/features/session/quickActions/QuickNoteAction.tsx \|\| (echo "FAIL: QuickNoteAction does not call logGenericNote" && exit 1)` |
| `QuickNpcAction` calls `logNpcCapture` | [STRUCTURAL] | `grep -q "logNpcCapture" src/features/session/quickActions/QuickNpcAction.tsx \|\| (echo "FAIL: QuickNpcAction does not call logNpcCapture" && exit 1)` |
| Palette exposes Note and NPC actions | [STRUCTURAL] | `grep -q "QuickNoteAction\|Note" src/features/session/SessionQuickActions.tsx && grep -q "QuickNpcAction\|NPC" src/features/session/SessionQuickActions.tsx \|\| (echo "FAIL: new palette actions not wired" && exit 1)` |
| Build succeeds | [MECHANICAL] | `npm run build 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
| Lint succeeds | [MECHANICAL] | `npm run lint 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: lint failed" && exit 1)` |
