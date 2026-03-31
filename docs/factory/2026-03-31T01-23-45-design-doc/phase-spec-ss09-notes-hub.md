# Phase Spec — SS-09: Notes Hub & Quick Capture (Phase 3)

```yaml
sub-spec: SS-09
title: Notes Hub & Quick Capture
stage: 2
priority: P0
score: 90
depends-on: SS-02, SS-03, SS-04, SS-06, SS-07
run: 2026-03-31T01-23-45-design-doc
```

> **Dependency Order:** Requires **SS-02** (Dexie schema + Note types), **SS-03** (CampaignContext — active campaign/session), **SS-04** (`useNoteActions` — createNote, pinNote/unpinNote, linkNote), **SS-06** (TiptapNoteEditor — used in creation drawers), and **SS-07** (active campaign lifecycle) to be complete first. SS-11 (Combat Timeline) also lives in the Session tab but is independent of this sub-spec.

---

## Intent

Provide the Notes tab as a hub for creating and browsing notes. Quick Note and Quick NPC flows must complete without typing (tap-only for required fields), with optional Tiptap body entry.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-S9-01 | Notes tab renders a hub showing notes grouped by type (or a flat list with type badges). Requires active campaign to show notes; shows prompt card otherwise. |
| AC-S9-02 | "Quick Note" action creates a generic note: tapping opens a creation drawer/modal; required field: title (text input); optional field: body (Tiptap editor); on save: note appears in hub immediately. |
| AC-S9-03 | "Quick NPC" action creates an npc-type note: tapping opens a creation drawer/modal; required field: name (text input, maps to `note.title`); optional fields in `typeData`: role, affiliation, notes (body via Tiptap); on save: NPC appears under NPCs section of hub immediately. |
| AC-S9-04 | Notes created via Quick Note / Quick NPC auto-link to active session per AC-S4-06 (handled by `useNoteActions.createNote`). |
| AC-S9-05 | "Link Note" allows associating an existing note with the active session (creates an EntityLink with `relationshipType: "linked_to"`). Existing links are not duplicated. |
| AC-S9-06 | Pinned notes (`note.pinned = true`) appear in a pinned section at the top of the Notes hub. |
| AC-S9-07 | Notes hub shows a count badge per type section when notes exist. |
| AC-S9-08 | All primary action tap targets (Quick Note, Quick NPC, Link Note) are ≥ 44 × 44 px. |
| AC-S9-09 | No TypeScript errors in Notes hub and creation component files. |

---

## Implementation Steps

### 1. Create `src/screens/NotesScreen.tsx` (Notes Hub)

#### Layout structure:

```
[Notes Hub]
─────────────────────────────
[Quick Note] [Quick NPC] [Link Note]   ← action bar, each ≥ 44×44 px
─────────────────────────────
📌 Pinned (N)
  • Note A
  • Note B
─────────────────────────────
NPCs (N)
  • Sir Talos
  • Old Mara
─────────────────────────────
Notes (N)
  • Rumor about the mill
─────────────────────────────
```

#### Data loading:

```ts
const { activeCampaign, activeSession } = useCampaignContext();
const [notes, setNotes] = React.useState<Note[]>([]);

React.useEffect(() => {
  if (!activeCampaign) return;
  let mounted = true;
  getNotesByCampaign(activeCampaign.id).then(result => {
    if (mounted) setNotes(result.filter(Boolean) as Note[]);
  });
  return () => { mounted = false; };
}, [activeCampaign?.id]);
```

#### Grouping logic:

```ts
const pinned = notes.filter(n => n.pinned);
const npcs = notes.filter(n => !n.pinned && n.type === 'npc');
const generic = notes.filter(n => !n.pinned && n.type === 'generic');
const combat = notes.filter(n => !n.pinned && n.type === 'combat');
```

#### No active campaign:

```tsx
if (!activeCampaign) return <NoCampaignPrompt />;
```

#### Refresh after create:

After any create/pin action, re-fetch notes or optimistically update local state.

### 2. Create `src/features/notes/QuickNoteDrawer.tsx`

```tsx
export function QuickNoteDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState<unknown>(null);
  const { createNote } = useNoteActions();

  const handleSave = async () => {
    if (!title.trim()) return; // required field
    await createNote({ title: title.trim(), type: 'generic', body, pinned: false, status: 'active', typeData: {} });
    onSaved();
    onClose();
  };

  return (
    <div style={{ /* drawer styles with CSS variables */ }}>
      <input
        type="text"
        placeholder="Note title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        style={{ width: '100%', minHeight: 44 }}
        autoFocus
      />
      <TiptapNoteEditor
        initialContent={null}
        onChange={setBody}
        campaignId={activeCampaign?.id ?? null}
        placeholder="Add note body (optional)..."
      />
      <button onClick={handleSave} style={{ minHeight: 44, minWidth: 44 }}>Save</button>
      <button onClick={onClose} style={{ minHeight: 44, minWidth: 44 }}>Cancel</button>
    </div>
  );
}
```

### 3. Create `src/features/notes/QuickNPCDrawer.tsx`

```tsx
export function QuickNPCDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = React.useState('');
  const [role, setRole] = React.useState('');
  const [affiliation, setAffiliation] = React.useState('');
  const [body, setBody] = React.useState<unknown>(null);
  const { createNote } = useNoteActions();
  const { activeCampaign } = useCampaignContext();

  const handleSave = async () => {
    if (!name.trim()) return; // required
    await createNote({
      title: name.trim(),
      type: 'npc',
      body,
      pinned: false,
      status: 'active',
      typeData: { role: role.trim() || undefined, affiliation: affiliation.trim() || undefined },
    });
    onSaved();
    onClose();
  };

  return (
    <div style={{ /* drawer styles */ }}>
      <input placeholder="NPC name (required)" value={name} onChange={e => setName(e.target.value)} style={{ minHeight: 44, width: '100%' }} autoFocus />
      <input placeholder="Role (optional)" value={role} onChange={e => setRole(e.target.value)} style={{ minHeight: 44, width: '100%' }} />
      <input placeholder="Affiliation (optional)" value={affiliation} onChange={e => setAffiliation(e.target.value)} style={{ minHeight: 44, width: '100%' }} />
      <TiptapNoteEditor initialContent={null} onChange={setBody} campaignId={activeCampaign?.id ?? null} placeholder="Notes about this NPC (optional)..." />
      <button onClick={handleSave} style={{ minHeight: 44, minWidth: 44 }}>Save NPC</button>
      <button onClick={onClose} style={{ minHeight: 44, minWidth: 44 }}>Cancel</button>
    </div>
  );
}
```

### 4. Create `src/features/notes/LinkNoteDrawer.tsx`

```tsx
export function LinkNoteDrawer({ onClose, onLinked }: { onClose: () => void; onLinked: () => void }) {
  // Lists all notes in campaign not already linked to active session
  // Each note tappable → creates entityLink with relationshipType: "linked_to"
  const { activeSession, activeCampaign } = useCampaignContext();
  const { linkNote } = useNoteActions();
  const [allNotes, setAllNotes] = React.useState<Note[]>([]);
  const [linkedIds, setLinkedIds] = React.useState<Set<string>>(new Set());

  // Load notes + existing session links on mount
  React.useEffect(() => { /* fetch notes + getLinksFrom(activeSession.id, 'contains') */ }, []);

  const handleLink = async (noteId: string) => {
    await linkNote(noteId, activeSession!.id);
    onLinked();
    onClose();
  };

  return (
    <div>
      {allNotes
        .filter(n => !linkedIds.has(n.id))
        .map(note => (
          <button key={note.id} onClick={() => handleLink(note.id)} style={{ minHeight: 44, width: '100%' }}>
            {note.title}
          </button>
        ))}
    </div>
  );
}
```

> `useNoteActions.linkNote` should create an EntityLink with `relationshipType: "linked_to"` from `sessionId → noteId`. Deduplicate check must be present (AC-S9-05).

### 5. Wire up drawers in NotesScreen

```tsx
const [showQuickNote, setShowQuickNote] = React.useState(false);
const [showQuickNPC, setShowQuickNPC] = React.useState(false);
const [showLinkNote, setShowLinkNote] = React.useState(false);

const refreshNotes = async () => { /* re-fetch notes */ };
```

Actions bar:
```tsx
<div style={{ display: 'flex', gap: 8 }}>
  <button onClick={() => setShowQuickNote(true)} style={{ minHeight: 44, minWidth: 44 }}>Quick Note</button>
  <button onClick={() => setShowQuickNPC(true)} style={{ minHeight: 44, minWidth: 44 }}>Quick NPC</button>
  <button onClick={() => setShowLinkNote(true)} style={{ minHeight: 44, minWidth: 44 }}>Link Note</button>
</div>
```

### 6. Count badges per section

```tsx
<h3 style={{ ... }}>NPCs <span style={{ background: 'var(--color-accent)', borderRadius: '50%', padding: '2px 6px' }}>{npcs.length}</span></h3>
```

### 7. Register NotesScreen route

- Map `/notes` to `<NotesScreen />` in router config
- Ensure it's rendered inside `ShellLayout`

---

## Verification Commands

```
# TypeScript check
npx tsc --noEmit

# Manual flow verification (AC-S9-01 through AC-S9-09):
# 1. No active campaign → Notes tab shows prompt card
# 2. Create campaign → Notes tab shows empty hub with Quick Note / Quick NPC / Link Note buttons
# 3. Tap "Quick Note" → drawer opens, type title, (optionally type body) → Save
#    → note appears in Notes section immediately
# 4. Tap "Quick NPC" → drawer opens, enter name + optional role → Save
#    → NPC appears in NPCs section with count badge updated
# 5. Tap "Link Note" → existing notes listed, tap one → EntityLink created in IndexedDB
# 6. Pin a note (from note context menu or pin button) → note moves to Pinned section
# 7. Verify all action buttons are ≥ 44×44 px (DevTools computed styles)
# 8. Verify no duplicate EntityLinks created on repeated "Link Note" for same note
```

---

## Files to Create / Modify

| Action | Path |
|--------|------|
| **Create** | `src/screens/NotesScreen.tsx` |
| **Create** | `src/features/notes/QuickNoteDrawer.tsx` |
| **Create** | `src/features/notes/QuickNPCDrawer.tsx` |
| **Create** | `src/features/notes/LinkNoteDrawer.tsx` |
| **Modify** | Router config — register `/notes` route |
| **Modify** | `src/features/notes/useNoteActions.ts` — ensure `linkNote` supports `"linked_to"` relationship type |

---

## Cross-Cutting Constraints (apply to this sub-spec)

- `XC-01` Zero TypeScript errors
- `XC-02` All new IDs use `generateId()`; timestamps use `nowISO()`
- `XC-03` Inline `style={{}}` with CSS variables
- `XC-04` Named exports only
- `XC-05` Hooks return `{ fn1, fn2 }` — no array returns
- `XC-06` `showToast()` for user-facing errors
