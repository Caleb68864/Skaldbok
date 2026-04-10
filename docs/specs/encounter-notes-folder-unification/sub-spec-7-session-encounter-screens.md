---
type: phase-spec
sub_spec: 7
title: "SessionScreen + EncounterScreen Integration"
master_spec: "docs/specs/2026-04-10-encounter-notes-folder-unification.md"
dependencies: [6]
wave: 7
---

# Sub-Spec 7 — `SessionScreen` + `EncounterScreen` Integration

## Scope

Remove the old Start Combat path from `SessionScreen`. Wrap session children in `SessionEncounterProvider`. Mount `SessionBar`. Update the Start Encounter modal with narrative + tags + location + `Started during:` override fields. Fire the auto-end-previous toast. Restructure `EncounterScreen` with four sections: Narrative (via `TiptapNoteEditor`), Participants (with picker + CombatEncounterView for combat type), Attached log, Relations.

## Context

- `SessionScreen.tsx:150-162` currently defines "Start Combat" — remove it.
- `SessionScreen.tsx:7` currently imports `CombatTimeline` — remove the import.
- `SessionScreen.tsx:233` currently renders `<CombatTimeline ... />` — remove the JSX.
- `SessionScreen.tsx:132-148` currently defines "Start Encounter" — extend the modal to capture narrative + tags + location + parentOverride.
- `SessionScreen.tsx:328-381` is the current modal — replace with the new form.
- `EncounterScreen.tsx:25-81` is the main view that delegates to `CombatEncounterView` for combat types. Restructure around the four sections.
- `TiptapNoteEditor` is at `src/components/notes/TiptapNoteEditor.tsx` with props including `initialContent`, `onChange`, `campaignId`, `placeholder`.
- The toast system is `@radix-ui/react-toast`. Check `src/components/ui/Toast.tsx` or equivalent — there's likely an existing `<Toaster>` mount and `toast(...)` helper. If not, set one up for this sub-spec.

## Implementation Steps

### Step 1 — Audit existing SessionScreen and EncounterScreen

```bash
cat src/screens/SessionScreen.tsx | head -250
cat src/features/encounters/EncounterScreen.tsx
```

Note the existing structure so the rewrite is additive, not demolition-level.

### Step 2 — `SessionScreen.tsx` changes

1. **Remove `CombatTimeline` import** (`line ~7`).
2. **Remove `<CombatTimeline .../>` JSX** (`line ~233`).
3. **Remove the "Start Combat" button** (`lines ~150-162`). The code that created a `type: 'combat'` note goes too.
4. **Wrap the render tree in `<SessionEncounterProvider sessionId={session.id}>`**.
5. **Mount `<SessionBar onActiveEncounterClick={(id) => navigate(`/encounters/${id}`)} />`** at the top of the session view, inside the provider.
6. **Replace the existing Start Encounter modal content** (`lines ~328-381`) with a new form that has:
   - Title (text, required)
   - Type (combat | social | exploration, required — radio or segmented control)
   - Description (optional, `<TiptapNoteEditor initialContent={...} onChange={setDescription} campaignId={session.campaignId} showToolbar={false} minHeight={100} />`)
   - Tags (optional, comma-separated or chip input)
   - Location (optional text)
   - Started during override select (defaults to current active encounter; clearable)
7. **Wire form submit to `useSessionEncounterContext().startEncounter(input)`** — use the context, not the hook directly. The hook is instantiated once by the provider.
8. **Fire an auto-end toast when `startEncounter` ends a prior active encounter.** Pattern:

   ```ts
   const priorTitle = activeEncounter?.title;
   const newEnc = await startEncounter(input);
   if (priorTitle) {
     toast({
       title: `${priorTitle} ended, ${newEnc.title} started`,
       duration: 3000,
     });
   }
   ```

   Use whatever toast helper the project exposes (search for `toast(` patterns or a `useToast` hook; if absent, set one up via `@radix-ui/react-toast` primitives — there's already a `@radix-ui/react-toast` dependency in package.json).

### Step 3 — `EncounterScreen.tsx` restructure

Restructure to render four sections. Use Radix Tabs (`@radix-ui/react-tabs`) or simple scroll sections:

```tsx
import { TiptapNoteEditor } from '../../components/notes/TiptapNoteEditor';
import { EncounterParticipantPicker } from './EncounterParticipantPicker';
import { CombatEncounterView } from './CombatEncounterView';
import { useEncounter } from './useEncounter';
import { useSessionLog } from '../session/useSessionLog';

export function EncounterScreen({ encounterId }: { encounterId: string }) {
  const {
    encounter,
    attachedNotes, // existing — notes loaded via getLinksFrom(encounterId, 'contains')
    updateDescription,
    updateBody,
    updateSummary,
    updateTags,
    updateLocation,
    addParticipantFromTemplate,
    removeParticipant,
    getChildEncounters,
    getParentEncounter,
  } = useEncounter(encounterId);
  const { reassignNote } = useSessionLog();

  // ... load parent/children once ...

  if (!encounter) return <div>Loading…</div>;

  return (
    <div className="flex flex-col gap-6 p-4">
      <header>
        <h1 className="text-2xl font-semibold">{encounter.title}</h1>
        <p className="text-sm text-neutral-500">{encounter.type}</p>
      </header>

      {/* Narrative */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Narrative</h2>
        <label className="text-xs text-neutral-500">Description</label>
        <TiptapNoteEditor
          initialContent={encounter.description}
          onChange={updateDescription}
          campaignId={encounter.campaignId}
          placeholder="Scene-setting (set at start)…"
          showToolbar={false}
          minHeight={80}
        />
        <label className="text-xs text-neutral-500 mt-4 block">Live notes</label>
        <TiptapNoteEditor
          initialContent={encounter.body}
          onChange={updateBody}
          campaignId={encounter.campaignId}
          placeholder="Jot thoughts as the scene unfolds…"
          showToolbar
          minHeight={120}
        />
        <label className="text-xs text-neutral-500 mt-4 block">Summary (write at end)</label>
        <TiptapNoteEditor
          initialContent={encounter.summary}
          onChange={updateSummary}
          campaignId={encounter.campaignId}
          placeholder="How did it end?"
          showToolbar={false}
          minHeight={80}
        />
      </section>

      {/* Participants */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Participants</h2>
        {/* Mount EncounterParticipantPicker behind an "Add participant" button */}
        {/* For type === 'combat', render <CombatEncounterView encounter={encounter} /> here */}
      </section>

      {/* Attached log */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Attached log</h2>
        <ul className="flex flex-col gap-1">
          {attachedNotes
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((n) => (
              <li key={n.id} className="flex items-center justify-between px-2 py-1 bg-neutral-50 rounded">
                <span className="text-sm">
                  <strong>{n.type}</strong> — {n.title}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    /* open a small "Move to…" dropdown, call reassignNote(n.id, selectedEncounterId) */
                  }}
                  className="text-xs text-neutral-500 hover:text-neutral-700"
                >
                  Move to…
                </button>
              </li>
            ))}
        </ul>
      </section>

      {/* Relations */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Relations</h2>
        <RelationsChips getParent={getParentEncounter} getChildren={getChildEncounters} />
      </section>

      {/* End Encounter button + modal */}
      <footer>
        {encounter.status === 'active' && (
          <button
            type="button"
            onClick={() => {
              /* open Radix Dialog with optional summary field, submit calls endEncounter(id, summary) */
            }}
            className="px-3 py-1 bg-red-600 text-white rounded"
          >
            End Encounter
          </button>
        )}
      </footer>
    </div>
  );
}
```

**Key wiring details:**
- The "Move to…" button on attached notes opens a picker of in-session encounters and calls `reassignNote(noteId, targetEncounterId)`.
- The End Encounter button opens a Radix Dialog with an optional `TiptapNoteEditor` for the summary. Submit calls `endEncounter(encounter.id, summaryValue)`. Dismiss (close button, Escape, backdrop click) does NOT end the encounter.
- For `type: 'combat'`, `CombatEncounterView` renders inside the Participants section and handles initiative/rounds. Its data flows through `encounter.combatData`.
- Handle the case where `updateDescription` / `updateBody` / `updateSummary` receive ProseMirror JSON from Tiptap — check the existing `TiptapNoteEditor` contract.

### Step 4 — Consider the "Started during" override

For the Start Encounter modal's parent override select:

```tsx
const { activeEncounter, recentEnded } = useSessionEncounterContext();
const [parentOverride, setParentOverride] = useState<string | 'auto' | 'none'>('auto');

// Options: "Auto (current active)", each recent encounter, "None (unrelated)"
// On submit, translate:
//   'auto' → undefined (let hook decide)
//   'none' → null
//   specific id → that id
```

### Step 5 — Verify no dead imports of `CombatTimeline` from session/encounter code

```bash
grep -rn "CombatTimeline" src/screens/ src/features/session/ src/features/encounters/
```

The only remaining reference should be `src/features/combat/CombatTimeline.tsx` itself (the component file). Sub-Spec 9 decides whether to delete that file.

### Step 6 — Build and lint

```bash
npm run build
npm run lint
```

### Step 7 — Manual smoke

Start the dev app. Verify:
- Session screen loads with the SessionBar at the top
- "Start Encounter" button exists, "Start Combat" does not
- Starting an encounter populates the SessionBar's active chip
- Clicking the chip navigates to the encounter screen
- EncounterScreen shows Narrative, Participants, Attached log, Relations sections
- End Encounter dialog dismisses leave the encounter active; submit ends it and adds it to the Recently ended chips

### Step 8 — Commit

```
feat(session): unified encounter flow in SessionScreen and EncounterScreen

- Remove Start Combat button and CombatTimeline import from SessionScreen
- Wrap session render tree in SessionEncounterProvider
- Mount SessionBar at the top of the session view
- Extend Start Encounter modal with description, tags, location, and
  parent override fields
- Fire "X ended, Y started" toast on auto-end-previous
- Restructure EncounterScreen into Narrative / Participants /
  Attached log / Relations sections
- Narrative fields use the existing TiptapNoteEditor wrapper
- Participants section uses EncounterParticipantPicker (inline picker)
- Attached log reads from getLinksFrom(encounterId, 'contains') and
  supports "Move to…" via reassignNote
- Relations section shows parent + children via happened_during edges
- End Encounter opens a Radix dialog with optional summary; dismiss
  does not end (no silent end-on-escape)
```

## Interface Contracts

### `SessionScreen` consumes the provider stack
- Direction: Sub-Spec 7 consumes from 4, 5, 6
- Consumer: Sub-Spec 7
- Requires: `<SessionEncounterProvider>` from Sub-Spec 4, `<SessionBar>` from Sub-Spec 6, `useSessionEncounterContext` from Sub-Spec 4.

### `EncounterScreen` consumes the extended `useEncounter` and `useSessionLog`
- Direction: Sub-Spec 7 consumes from 5, 6
- Consumer: Sub-Spec 7
- Requires: `updateDescription/Body/Summary/Tags/Location`, `addParticipantFromTemplate`, `removeParticipant`, `getChildEncounters`, `getParentEncounter`, `reassignNote`, `<EncounterParticipantPicker>`, existing `<CombatEncounterView>`, existing `<TiptapNoteEditor>`.

## Verification Commands

```bash
npm run build
npm run lint
grep -rn "CombatTimeline" src/screens/ src/features/session/   # must be empty
grep -rn "Start Combat" src/                                   # must be empty
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| SessionScreen does not import CombatTimeline | [MECHANICAL] | `[ $(grep -c "CombatTimeline" src/screens/SessionScreen.tsx) -eq 0 ] \|\| (echo "FAIL: SessionScreen still imports CombatTimeline" && exit 1)` |
| No "Start Combat" label in codebase | [MECHANICAL] | `[ $(grep -rn "Start Combat" src/ \| wc -l) -eq 0 ] \|\| (echo "FAIL: Start Combat still referenced" && exit 1)` |
| SessionScreen uses `SessionEncounterProvider` | [STRUCTURAL] | `grep -q "SessionEncounterProvider" src/screens/SessionScreen.tsx \|\| (echo "FAIL: provider not mounted" && exit 1)` |
| SessionScreen renders `SessionBar` | [STRUCTURAL] | `grep -q "SessionBar" src/screens/SessionScreen.tsx \|\| (echo "FAIL: SessionBar not mounted" && exit 1)` |
| EncounterScreen imports `TiptapNoteEditor` | [STRUCTURAL] | `grep -q "TiptapNoteEditor" src/features/encounters/EncounterScreen.tsx \|\| (echo "FAIL: TiptapNoteEditor not used" && exit 1)` |
| EncounterScreen imports `EncounterParticipantPicker` | [STRUCTURAL] | `grep -q "EncounterParticipantPicker" src/features/encounters/EncounterScreen.tsx \|\| (echo "FAIL: picker not used" && exit 1)` |
| EncounterScreen renders Narrative section | [STRUCTURAL] | `grep -q "Narrative" src/features/encounters/EncounterScreen.tsx \|\| (echo "FAIL: Narrative section missing" && exit 1)` |
| EncounterScreen renders Attached log section | [STRUCTURAL] | `grep -q "Attached log" src/features/encounters/EncounterScreen.tsx \|\| (echo "FAIL: Attached log section missing" && exit 1)` |
| EncounterScreen renders Relations section | [STRUCTURAL] | `grep -q "Relations" src/features/encounters/EncounterScreen.tsx \|\| (echo "FAIL: Relations section missing" && exit 1)` |
| Build succeeds | [MECHANICAL] | `npm run build 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
| Lint succeeds | [MECHANICAL] | `npm run lint 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: lint failed" && exit 1)` |
