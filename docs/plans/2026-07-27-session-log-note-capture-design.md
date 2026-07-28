---
title: Session Log — stylus-first note capture and deferred structuring
date: 2026-07-27
status: evaluated
evaluated_date: 2026-07-27
scope: replaces in-session note capture with a running log; adds a reusable ruled write surface, a promote flow, and a deferred wikilink scanner
target_device: Samsung Galaxy Tab S9 + S Pen (Chrome PWA)
---

# Session Log — stylus-first note capture

## 0. Problem

Note capture during play is too slow to use at the table. The cause is
structural, not cosmetic:

- **`QuickNoteDrawer`** has a body editor but `Save` is disabled until a title
  is typed (`QuickNoteDrawer.tsx:180`). It is also capped at `max-w-[480px]`,
  a sliver of a Tab S9 screen.
- **`QuickNoteAction`** (FAB → Note) makes the title optional but has **no body
  field at all**. Writing anything means pressing "Open in rich editor", which
  navigates to `/note/:id/edit` and leaves the session screen mid-play.

> The path with a body demands a title first; the path that doesn't demand a
> title has nowhere to write.

Two further findings support collapsing the taxonomy:

- The type chips sit directly under the title, so the user classifies a note
  **before writing it**.
- `type` and `tags` are already redundant: `TagPicker.tsx:14` defines
  `TYPE_TAGS = ['npc','location','rumor','quest','loot',…]` — the same concepts
  as `NOTE_TYPES`. Two parallel taxonomies for one idea, plus 26 preset chips.

## 1. Shape of the solution

Capture is a **running log scoped to a session**. Structure is **extracted
afterwards**, never required during play.

```
IN PLAY          write into the log. that is the entire interaction.
DURING A LULL    select entries → promote to a note, or append to an existing one
AFTER            review sweep: scan the log for links, export the AAR
```

Session-start remains the entry point; the log belongs to a `Session`.

## 2. Data model

Add `'log'` to `NOTE_TYPES`. A committed entry **is a `Note`**:

```ts
{
  campaignId, sessionId,
  type: 'log',
  title: '',                    // never required, never prompted
  body: textToDoc(entryText),   // minimal ProseMirror doc
  status: 'active', pinned: false,
  createdAt: <commit time>,     // the entry's timestamp
}
```

### Why a Note row and not something else

| | **A. Entry = Note row** | B. One Note/session, entries in a blob | C. New `logEntries` table |
|---|---|---|---|
| Timeline | free (`notesToTimeline`) | adapter rewrite | adapter rewrite |
| AAR export | near-free | must split blob | new export path |
| Bundle import/export | free | free | new bundle entity |
| Soft delete / restore | free, per entry | wrong granularity | new plumbing |
| Promote & link | `entityLinks` target note ids | entries have no id | free |
| Concurrent-write risk | low | **high** | low |
| Cost | small | medium | large |

**Chosen: A.** Making an entry *be* a note inherits export, timeline, bundles,
soft delete, search and links unchanged.

**B is explicitly rejected**: rewriting a whole session blob per commit is the
same shape as the existing `useSessionLog` flush-on-end bug (backlog #3).
Losing an hour of handwritten notes to a botched write is the worst failure
available here.

### `textToDoc()`

A small helper, and load-bearing in two ways:

1. **Bodies must be ProseMirror docs, not strings.** `resolveWikiLinks()`
   returns `''` for any non-object input (`resolveWikiLinks.ts:26`), so a raw
   string would **silently export as empty**.
2. **It parses `[[...]]` spans into real `wikiLink` nodes.** `wikiLink` is an
   inline atom node with `id`/`label` attrs; export serializes it back to
   `[[label]]` (`resolveWikiLinks.ts:89`), and `linkSyncEngine.syncNote` reads
   it via `extractLinksFromTiptapJSON`. So a hand-typed `[[Ostrand]]` in a
   plain textarea produces exactly the node Tiptap would have — full wikilink
   fidelity with no Tiptap.

### New relationship type

`promoted_into` — `log` note → target note. Per project convention this
requires updating **both** the relationship table in `CLAUDE.md` and the
comment at the top of `entityLinkRepository.ts`.

### `noteTypeToKBNodeType`

`linkSyncEngine.ts:34` maps note type → KB node type. `'log'` needs a
deliberate mapping (or exclusion) so the graph is not flooded with per-entry
nodes.

## 3. Surfaces

### 3.1 `WritePad` — reusable ruled writing surface

A full-screen writing surface any text field can expand into. Not
session-specific: ship notes, finance notes, character background, note bodies.

- **Plain `<textarea>`, never `contenteditable`.** Chromium's stylus handwriting
  targets *"editable, non-password text fields"* and commits through the
  `InputConnection` created for the HTML input field. Whether Samsung
  DirectWriting fires on `contenteditable` is unconfirmed; a textarea is the
  safe target.
- Ruled background via `repeating-linear-gradient` with `line-height` matched
  to the stripe pitch.
- No width cap. Full viewport.
- Invoked by an expand affordance rendered next to the field it owns.

### 3.2 `SessionLog` — in-session capture

Committed entries listed chronologically above; `WritePad` docked below.

- Commit appends a timestamped entry, clears the field, **and retains focus** —
  Samsung's handwriting pad *is* the keyboard, so a blur closes it and costs a
  tap per entry.
- No title, no type, no tags, no attach-to. Nothing to decide.
- Auto-scroll to newest.

**Entry correction is mandatory, not optional** (evaluation: CRITICAL gap).
This design assumes handwriting conversion will produce errors — it is the
stated reason the link scanner needs fuzzy matching. A capture flow that
knowingly produces garbled text with no way to fix it loses the thought, and
the thought is the entire product.

- **Tap an entry to edit it in place** — reopens `WritePad` with that entry's
  text; committing replaces it and preserves the original `createdAt`.
- **Long-press to delete** — `softDelete`, per project convention, so it is
  recoverable from Trash.
- Both must ship in the first sub-spec. Neither may be deferred.

**When no session is active** (evaluation: IMPORTANT gap). The log is
session-scoped, so opening it without an active session is a defined state, not
an accident:

- **Decision:** block with a "Start a session to begin logging" prompt and a
  button that starts one. Chosen over campaign-scoped buffering because
  buffering introduces an orphan-entry reattachment path for a case that
  barely occurs — session-start is already the table ritual.

### 3.3 Promote flow

Tap an entry to select; tap more to add to the selection. An action bar offers:

- **New note** — sheet with the existing 6 type chips; title prefilled from the
  first ~60 chars of the first selected entry; body = selected entries
  concatenated **in time order**, timestamps retained.
- **Add to existing…** — searchable picker (reuse `useNoteSearch`); appends the
  entries to the target note's body under a `---` divider.
- **Tag** — tag without promoting.

**Promoted entries are never deleted.** They remain in the log with a badge
linking to the target (`promoted_into`). The raw log always survives intact.

### 3.4 `LinkScanner` — deferred wikilink suggestions

Replaces live `[[` autocomplete, which is exactly the mid-play friction being
removed (`QuickNoteAction.tsx` already notes "typing `@Aldric` during live play
is slow").

Dictionary, all from existing repositories:

| Source | Yields |
|---|---|
| `activeParty.members` + linked characters | PC names |
| `creatureTemplateRepository.listByCampaign()` (`category: 'npc'`) | NPC names |
| `getNotesByCampaign()` titles | every existing note, incl. locations |

Behaviour:

- Matches produce **Approve / Dismiss** suggestions; approving replaces the
  matched span with a `wikiLink` node.
- **Fuzzy matching (edit distance ≤ 1–2) is required, not optional.** S Pen
  conversion will produce `0strand` / `Ostrund`; an exact-only scanner silently
  finds nothing and is worse than no scanner because it will be trusted.
  Fuzzy hits surface as lower confidence.
- **Suggests missing records**: "*Ostrand* appears in 4 entries and has no NPC
  note — create one?" This converts the promote pass into the session-prep pass.

Placement:

- **In the promote sheet** — scans the selected entries.
- **End-of-session Review sweep** — scans the whole log at once; this is the AAR pass.
- **Deliberately NOT a live sidebar while writing** — visual noise during play.

False-positive control: whole-word matching, minimum length, and **remembered
dismissals** so a wrong suggestion (a PC called "Hawk", an NPC called "Doc")
does not reappear every session.

## 4. Where log entries appear

- **`NotesGrid`** must exclude `type: 'log'` — a 4-hour session is roughly
  60–100 rows and would drown the grid.

  > **This is not a default, it is explicit work** (evaluation: IMPORTANT gap).
  > `NotesGrid` renders **a filter pill chip per `NoteType`** plus an "All"
  > catch-all. Adding `'log'` to `NOTE_TYPES` automatically creates a "Log"
  > chip *and* sweeps every entry into "All".
  >
  > **Decision:** introduce an explicit `HIDDEN_NOTE_TYPES = ['log']`
  > exclusion, applied to **both** the chip row and the "All" filter, plus an
  > opt-in "show log entries" toggle.

- **Search (`useNoteSearch` / MiniSearch)** — log entries **are** indexed
  (evaluation: IMPORTANT gap, decided). Searching the raw log is a primary
  value of keeping it, so excluding it would defeat the point. The cost is real
  and bounded: the in-memory index gains roughly 80 docs per session
  (~1,600 after 20 sessions).

  **Decision:** index them, and measure. If initial load regresses noticeably,
  move log entries to a lazily-built secondary index rather than dropping them
  from search.
- **Timeline** — their own lane nested under the Notes parent. The
  `parentTrackId` nesting already shipped (`c7ebdaf`); the lane starts
  collapsed.

## 5. AAR export

`renderSessionBundle` gains one behaviour: log entries render as a **single
chronological section inside the session index**, not one `.md` per entry.
Promoted notes keep their own files, and the log links to them.

Result: a session document that reads as a narrative with the extracted records
attached — the after-action report.

## 6. What is retired

In-session, the FAB's Note action opens `SessionLog` instead of the type-chip
form. `QuickNoteAction` and `QuickNoteDrawer` remain reachable **outside** play
but leave the session flow.

## 7. Migration and risk

**No data migration.** Adding a note type is purely additive; existing notes are
untouched.

| Risk | Mitigation |
|---|---|
| Promote is clunky → old path is gone too | Promote is never required during play. An un-promoted log is a complete, exportable session record on its own. |
| S Pen doesn't fire on the textarea in Chrome | Design does not depend on it. A ruled full-screen textarea with no required title beats today's flow **with a keyboard**. Stylus is upside, not a prerequisite. Fallback: Samsung Internet. |
| Link scan false positives | Whole-word + min length + remembered dismissals. |
| Log floods `NotesGrid` / KB graph | Default filter on `type: 'log'`; deliberate `noteTypeToKBNodeType` mapping. |

## 8. Deliberately out of scope

- Collapsing `NOTE_TYPES` to a general bucket + tags. Considered and declined;
  the log *is* the general bucket, so promoted notes keep their types.
- Moving `TagPicker` presets to config (existing backlog item #5).
- Ink storage. Strokes are converted to text at the OS layer and never
  persisted as ink.

## 9. Decided (no further escalation)

These were open questions. They are now committed defaults so no blocker-gate
fires during an autonomous run. Override only if the stated condition holds.

1. **`noteTypeToKBNodeType` mapping for `'log'`** → **Default: excluded from
   the KB graph.** `syncNote` returns early for `type === 'log'`. Log entries
   are raw capture, not knowledge nodes; syncing ~80 nodes per session would
   swamp the graph. *Override if* promoted notes turn out to need the log entry
   as a graph ancestor — they do not today, because `promoted_into` already
   records the lineage in `entityLinks`.
2. **Commit gesture** → **Default: an explicit Commit button, plus
   `Ctrl`/`Cmd`+`Enter`.** A bare `Enter` inserts a newline, because
   multi-line entries are normal and a stray `Enter` mid-thought must not
   commit half a sentence. *Override if* on-device testing shows the S Pen
   pad's own newline handling makes the shortcut unreachable.
3. **Very long entries and paste** → **Default: no length cap.** Entries are
   plain text in a PM doc; `WritePad` scrolls. No truncation, no warning.
4. **Empty commits** → **Default: ignored.** Committing whitespace-only content
   is a no-op and does not create a note.

## 9b. Still to validate (non-blocking)

- Does Samsung's S Pen pad fire on a `<textarea>` in Chrome on the Tab S9?
  Two-minute on-device check. **Does not block the build** — the design is
  justified with a keyboard alone.

## Commander's Intent

**Desired End State:** During a session the user opens one screen, writes, and
commits entries without ever typing a title, choosing a type, or leaving the
screen. Entries are correctable. Afterwards, selected entries promote into
typed notes or append to existing ones, a link scanner proposes wikilinks and
missing records, and the session exports as a single narrative document with
the extracted notes attached.

**Purpose:** Note capture is currently too slow to use at the table, so
in-session notes do not get taken at all. Every decision should be judged by
"does this remove a decision from the moment of writing?"

**Constraints:**
- MUST NOT require a title, type, tag or attach-target to capture an entry.
- MUST NOT blur the capture field on commit (closes the S Pen pad).
- MUST store bodies as ProseMirror docs — a raw string exports as empty.
- MUST use `softDelete`, never `hardDelete`, from UI paths.
- MUST NOT run a data migration; adding a note type is additive.
- MUST keep the raw log intact after promotion.
- MUST use a plain `<textarea>`, never `contenteditable`, for capture.

**Freedoms — the agent MAY decide without asking:**
- Component file layout, internal naming, hook boundaries.
- Exact ruled-background CSS values and spacing.
- Selection-mode interaction details (checkboxes vs. tap-toggle).
- Fuzzy-match algorithm and threshold, provided edit distance ≤2 is supported.
- Test file placement, following existing `*.test.ts` colocation.

## Execution Guidance

**Observe:**
- `npm run build` — the only type-check in the project (`tsc -b` + vite).
- `npm test` — 219 existing tests must stay green.
- Note count in `NotesGrid` after a simulated session: log entries must not appear.

**Orient — codebase conventions (from the repo, not generic advice):**
- Repositories: try/catch + Zod `safeParse` on every read, `console.warn` on
  validation failure, `throw new Error('{repo}.{method} failed: ${e}')`.
  **Use `campaignRepository.ts` as the template — NOT `characterRepository.ts`,
  which is legacy.**
- IDs via `generateId()` (`src/utils/ids.ts`); timestamps via `nowISO()`
  (`src/utils/dates.ts`).
- Hooks live in `src/features/{domain}/`; utilities in `src/utils/`.
- Reads filter soft-deleted rows via `excludeDeleted` (`src/utils/softDelete.ts`).
- New `entityLink` relationship types require updating **both** the table in
  `CLAUDE.md` and the comment atop `entityLinkRepository.ts`.

**Escalate when:**
- A Dexie `version()` bump appears necessary (it should not be — this is additive).
- The export markdown format would change for existing note types.
- A change would touch the character sheet or system engine.

**Shortcuts — apply without deliberation:**
- New note type = add to `NOTE_TYPES`; no schema change (`type` is `z.string()`).
- Soft delete cascades share one `softDeletedBy` txId in one transaction.
- Any user-facing grouping or preset belongs in config, not a component literal.

## Decision Authority

**Agent decides autonomously:** file/folder structure, component and function
naming, CSS values, test organisation, fuzzy-match implementation, selection UX
details, internal state shape.

**Agent recommends, human approves:** any change to `renderNote`/`renderSession`
output for existing types; adding a new npm dependency; changing the
`baseNoteSchema` shape; altering `notesToTimeline` behaviour for non-log notes.

**Human decides:** retiring `QuickNoteDrawer`/`QuickNoteAction` entirely rather
than removing them from the session flow; collapsing `NOTE_TYPES`; any change
to the AAR export format contract.

## War-Game Results

**Most likely failure:** a handwriting-converted entry is garbled and the user
cannot fix it, losing the thought. **Mitigated** by mandatory tap-to-edit and
long-press-delete in the first sub-spec.

**Scale stress:** every log entry flows into three consumers — `NotesGrid`,
MiniSearch, and the timeline. At 20 sessions × 80 entries ≈ 1,600 notes.
**Mitigated** by explicit `HIDDEN_NOTE_TYPES` exclusion, a collapsed timeline
lane, and a measured decision to index in search with a lazy-index fallback.

**Dependency risk:** Samsung's IME behaviour is outside our control and may
change between One UI releases. **Mitigated** — the design is justified with a
keyboard alone; the stylus is upside.

**6-month maintenance:** strong. A log entry is just a `Note`, so a developer
needs no new mental model, no new table, and no new repository.

## Evaluation Metadata

- Evaluated: 2026-07-27
- Cynefin domain: Complicated (plan depth matches — approach comparison present)
- Assumptions audited: 8 (2 confirmed, 1 supported, 4 unsupported, 1 contradicted-in-detail)
- Critical gaps: 1 (1 resolved) · Important: 3 (3 resolved) · Suggestions: 3 (3 resolved)

## References

- `src/features/notes/QuickNoteDrawer.tsx` — required-title blocker
- `src/features/session/quickActions/QuickNoteAction.tsx` — bodyless fast path
- `src/utils/export/resolveWikiLinks.ts` — PM-doc requirement, wikiLink serialization
- `src/features/kb/linkSyncEngine.ts` — `extractLinksFromTiptapJSON`, KB node mapping
- `src/components/timeline/adapters/notesToTimeline.ts` — `noteTrackResolver`
- [Chromium `components/stylus_handwriting`](https://chromium.googlesource.com/chromium/src.git/+/refs/heads/lkgr/components/stylus_handwriting/)
- Vault: `Caleb's Vault/Software/Handwriting to Text/`
