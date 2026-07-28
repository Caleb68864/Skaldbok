# Global Search — Design

**Date:** 2026-07-28
**Status:** Approved, ready for implementation planning
**Driver:** Traveller campaign, player seat

## Problem

Skaldbok captures well and recalls poorly. Session log, quick-log tray, notes,
tags, KB graph, entity links, and the timeline all feed data in. Almost nothing
gets it back out.

Three months into a campaign the recurring table moment is not "what are my
odds" — the skills screen already answers that. It is *"who was that broker on
Regina?"* or *"what did we agree to with the patron?"* Today the only way to
answer is to guess the session and scroll. That is the moment the tablet goes
down and the question goes to the GM instead.

The fix is system-agnostic. It serves every system, not just Traveller.

## What already exists

The machinery is largely built and mostly unwired.

| Asset | State |
|---|---|
| `minisearch` ^7.2.0 | Already a dependency. |
| `useNoteSearch` | Full-text index over every note — title, body text, tags, descriptors — with field boosting, `fuzzy: 0.2`, `prefix: true`, and incremental maintenance. Indexes log entries deliberately. **Consumed only by `PromoteEntriesSheet`.** |
| `useKBSearch` | Fuzzy index over KB node labels, built async with `addAllAsync({ chunkSize: 200 })`. **No live consumers.** |
| `CommandPalette` | Full-screen overlay: portal-rendered, autofocus, swipe-down dismiss, type badges, quick actions. **Never mounted anywhere.** Searches KB labels only. |

So this is not "build search." It is **wire up and unify search that already
exists.**

## Decisions

Settled with the user before design:

- **Surface:** overlay that can escalate to a full screen.
- **Scope:** everything — notes, KB nodes, sessions and encounters, gear,
  skills, ships.
- **Matching:** fuzzy / typo-tolerant, matching the settings both existing
  hooks already use.

## Architecture

### One index, not federated

A single module-level MiniSearch index over a normalized document:

```ts
interface SearchDoc {
  id: string;            // `${entityType}:${entityId}` — MiniSearch requires unique ids
  entityType: 'note' | 'kb' | 'session' | 'encounter' | 'gear' | 'skill' | 'ship';
  title: string;         // boost 3
  subtitle: string;      // note type, session date, KB node type — boost 1.5
  text: string;          // body / notes / description — boost 1
  tags: string;          // boost 2
  route: string;         // navigation target
}
```

One index rather than seven gives one query, one comparable relevance score,
and turns grouping into a `groupBy` over results instead of a
merge-and-rerank problem.

Per-type adapters (`noteToDoc`, `kbNodeToDoc`, `sessionToDoc`, …) convert
entities to documents. Adding a searchable entity later costs one adapter and
nothing else.

Search options: `fuzzy: 0.2`, `prefix: true` — the values already proven in
both existing hooks.

### Index lifecycle: rebuild on open

Build the index when the palette opens, using `addAllAsync({ chunkSize: 200 })`
so indexing never blocks the main thread.

Incremental maintenance was considered and rejected. Keeping an index live
means hooking every repository write path — six for notes alone
(`createNote`, `updateNote`, `createLogEntry`, `updateLogEntry`,
`promoteEntriesToNewNote`, `appendEntriesToNote`), and more across seven entity
types — with "silently stale results" as the failure mode. Rebuilding a few
thousand documents takes tens of milliseconds, once, on a deliberate user
gesture. Always fresh, no invalidation logic.

All reads go through repositories, so soft-deleted rows are excluded by
default.

### Scoping

- **Campaign-scoped:** notes, KB nodes, sessions, encounters, ships.
- **Active character only:** gear and skills. Indexing every character's
  inventory would return four characters' rifles for one query.

## Surface

### Palette

Reuse `CommandPalette` structurally. Changes:

- Swap `useKBSearch` for the new `useGlobalSearch`.
- Group results under type headings.
- Render a match snippet beneath each result title.
- Remove the dead "Export all" quick action.
- Add a "See all results" footer routing to `/search?q=`.

The snippet carries more weight than its size suggests. At the table,
"…the broker **Regina** put us onto, an Oberlindes agent…" often *is* the
answer, and the user never taps through.

**Entry points:** a search icon in `CampaignHeader`, reachable from every
screen, plus `Ctrl/Cmd+K` on desktop.

### `/search`

A thin route over the same hook: persistent type filters, longer snippets, no
auto-dismiss. For digging rather than looking up.

## Result routing

| Type | Route |
|---|---|
| note | `/kb/:noteId` — the existing `NoteReader` surface, rendered by `KnowledgeBaseScreen` |
| kb | `/kb/:nodeId` |
| session | `/session` |
| encounter | `/session` |
| gear | `/character/gear` |
| skill | `/character/skills` |
| ship | `/ships` |

Notes route to the reader, not the editor. Search answers a question; it should
not open an edit surface mid-scene.

## Explicitly out of scope

- **`useNoteSearch` is left untouched**, still serving `PromoteEntriesSheet`.
  It duplicates some of `useGlobalSearch`, but collapsing them means modifying
  a working promote flow to save roughly thirty lines. Revisit after global
  search has survived a real session.
- **`useKBSearch` is retired** into the unified hook, since the palette was its
  only consumer.
- No search operators (`tag:`, `type:`). Type filters on `/search` cover the
  need without new syntax to remember.
- No saved searches or search history.

## Risks

- **`/kb/:nodeId` taking a note id needs verifying during implementation.**
  `KnowledgeBaseScreen` passes the route param straight to
  `NoteReader noteId={nodeId}`, which implies note ids and KB node ids share a
  namespace here. If they do not, note results need a different route.
- **Index build time** grows with campaign size. Mitigated by chunked async
  indexing; revisit only if a real campaign makes the palette feel slow.
- **No test setup for components.** Verification is `npm run build` plus
  running the app. The adapters and the grouping logic are pure functions and
  should get Vitest coverage.

## Related gaps, deferred

Surfaced while scoping this, not part of it:

1. **Difficulty-aware odds.** `travellerEngine.ts` hardcodes the target to `8`,
   so every skill shows only its Average-difficulty odds. A difficulty picker
   plus a situational-DM stepper on the existing skills screen. Small and real.
2. **Worlds and travel.** Probably a KB node type plus this search, not a new
   entity.
3. **Author-your-own reference cards.** The quick-reference is six hardcoded
   tables in `system.json`. Real, but gated on content entry, and bundled
   commercial rules tables are out of the question.
