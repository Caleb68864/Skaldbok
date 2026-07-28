---
type: phase-spec
sub_spec_id: SS-14
phase: run
depends_on: ['SS-03']
wave: 2
master_spec: "docs/specs/2026-07-27-session-log-note-capture.md"
---

# SS-14 — Wire `WritePad` into ship notes

## Scope

Add an expand affordance beside the ship-notes textarea in `src/screens/ShipsScreen.tsx` that opens `WritePad` over it and writes the result back.

## Why this sub-spec exists

Red-team finding **C-1**. Requirement 3 promises a surface "any text field can expand into," but before this sub-spec the only consumer was the new session log — making `WritePad` an orphan component with a single caller, and leaving the reuse that justified building it separately undelivered.

Ship notes is the right first consumer: a long free-text field on a tablet-facing screen, already gated by edit mode.

## Interface Contracts

### Consumes WritePad
- Direction: SS-03 → SS-14
- Owner: SS-03
- Shape: `WritePad({ open, value, onChange, onCommit, onClose })` — *implements contract from SS-03*

## Existing code to respect

`ShipEditor` in `ShipsScreen.tsx` takes an `editable: boolean` prop (added when ships were locked down in play mode). The ship-notes textarea is:

```tsx
<textarea className={inputClass + ' min-h-[100px]'} value={ship.notes} aria-label="Ship notes" disabled={!editable}
  placeholder="Construction details, quirks, cargo manifest…"
  onChange={e => patch({ notes: e.target.value })} />
```

Write back through the existing `patch({ notes })` — do not introduce a second write path.

## Implementation Steps

### Step 1. Local open state

Inside `ShipEditor`, add `const [notesPadOpen, setNotesPadOpen] = useState(false)` alongside the existing `newWeapon` state.

### Step 2. Render the expand control

Place a small button adjacent to the Ship notes label, rendered **only when `editable` is true** so it inherits the play-mode lockdown. Give it `aria-label="Expand ship notes"`.

### Step 3. Mount `WritePad`

```tsx
<WritePad
  open={notesPadOpen}
  value={ship.notes}
  onChange={next => patch({ notes: next })}
  onCommit={() => setNotesPadOpen(false)}
  onClose={() => setNotesPadOpen(false)}
  placeholder="Construction details, quirks, cargo manifest…"
  commitLabel="Done"
/>
```

For a single free-text field, commit means "close" — there is no append semantics here, unlike the session log.

### Step 4. Verify

```bash
npm run build
npm run preview
```

Manual check at tablet width: the expand control appears in edit mode, is **absent in play mode**, opens a full-screen ruled surface, and text written there lands in ship notes.

### Step 5. Commit

```bash
git add src/screens/ShipsScreen.tsx
git commit -m "feat(ships): expand ship notes into WritePad [factory-managed]"
```

## Verification Commands

```bash
npm run build
npm run preview   # manual: edit mode shows the control, play mode does not
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| WritePad imported | [STRUCTURAL] | `grep -q "WritePad" src/screens/ShipsScreen.tsx \|\| (echo "FAIL: ShipsScreen does not import WritePad" && exit 1)` |
| Expand control gated to edit mode | [STRUCTURAL] | `grep -q "editable &&" src/screens/ShipsScreen.tsx \|\| (echo "FAIL: expand control not gated by editable" && exit 1)` |
| Writes back through patch | [MECHANICAL] | `[ $(grep -c "patch({ notes" src/screens/ShipsScreen.tsx) -ge 1 ] \|\| (echo "FAIL: no patch write-back for notes" && exit 1)` |
| Build passes | [MECHANICAL] | `npm run build > /dev/null 2>&1 \|\| (echo "FAIL: npm run build failed" && exit 1)` |
