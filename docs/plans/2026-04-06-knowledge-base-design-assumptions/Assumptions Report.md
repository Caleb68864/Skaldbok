# Assumptions Report

**Plan:** docs/plans/2026-04-06-knowledge-base-design.md
**Date:** 2026-04-06
**Scope:** plan_and_repo
**Total Assumptions:** 14 (8 explicit, 6 implicit)
**High/Critical:** 2

## Summary

The knowledge base design is thorough and well-researched — most assumptions are supported by evidence in the technical reference and codebase. The two highest-risk assumptions involve Tiptap Suggestion's multi-character trigger (`[[`) and the `baseNoteSchema` modification for the `scope` field. A Tiptap version mismatch in package.json (some at ^2.11.7, others at ^2.27.2) should be resolved before adding new Tiptap dependencies. The `settings.debugMode` flag referenced in the plan doesn't exist and needs to be added or replaced.

## Confirmed Assumptions

| ID | Assumption | Category |
|----|-----------|----------|
| ASM-10 | d3 packages need to be added (plan correctly identifies) | version_or_dependency |
| ASM-14 | Dexie compound indexes support graph query patterns | library_or_framework_capability |

## Likely Assumptions

| ID | Assumption | Evidence | Notes |
|----|-----------|----------|-------|
| ASM-2 | Dexie equalsIgnoreCase() in v4.0.10 | strongly_supported | Dexie 4 API feature, not used in codebase yet |
| ASM-6 | Tiptap version compatibility | partially_supported | Lockfile resolves correctly but package.json pins diverge |
| ASM-9 | NotesGrid replaceable by VaultBrowser | partially_supported | Plan flags "pending discussion" on session-scoped filtering |
| ASM-12 | MiniSearch extractField for heterogeneous types | strongly_supported | Well-documented MiniSearch feature |
| ASM-14 | PWA service worker caches new routes | strongly_supported | vite-plugin-pwa auto-generates precache |

## Unsupported Assumptions

| ID | Assumption | Impact | Action |
|----|-----------|--------|--------|
| ASM-3 | `settings.debugMode` flag exists | Low — easy to add or replace with `import.meta.env.DEV` | Mitigate: decide gating mechanism before implementation |

## Contradictions or Conflicts

None found that would block implementation. The plan is internally consistent and the technical reference supports the design.

## High-Risk Gaps

### ASM-1: Tiptap Suggestion multi-character trigger (HIGH)

The plan's wikilink architecture depends entirely on `@tiptap/suggestion` accepting `char: '[[' ` — a two-character trigger string. The existing `descriptorMentionExtension.ts` only uses single-character triggers (`#`). The technical reference documents this as researched, but no code in the repo validates it.

**If wrong:** The wikilink autocomplete architecture must use a different trigger mechanism (e.g., InputRule-only approach, or a custom ProseMirror plugin that detects `[[` manually).

**Mitigation:** Build a minimal proof-of-concept before implementing the full extension. Estimated: 30 minutes.

### ASM-7: baseNoteSchema modification for scope field (HIGH)

Adding `scope` to the Note type is central to the reference note migration and cross-campaign knowledge graph. The plan correctly flags this as an escalation point. However, the ripple effect is significant: all note queries that filter by `campaignId` must also consider `scope = 'shared'`.

**If wrong:** Not that it can't be done, but the effort may be larger than anticipated.

**Mitigation:** Audit all note query sites before implementation to size the change.

### ASM-13: Dexie OR queries across campaignId and scope (MEDIUM, escalation risk)

Dexie's WhereClause doesn't natively support `WHERE campaignId = X OR scope = 'shared'` in a single query. This requires two queries merged in JavaScript. At scale, this could impact the 50ms resolution constraint.

**Mitigation:** Design the query pattern explicitly. Use `Promise.all([byCapaignId, bySharedScope])` with client-side dedup.

## Recommended Validations

Priority-ordered by risk:

1. **Validate ASM-1** — Build minimal Tiptap editor with `char: '[[' ` Suggestion config. Confirm popup fires. (30 min)
2. **Validate ASM-7** — Audit all note query sites for campaignId filtering. Count how many need scope-aware updates. (1 hour)
3. **Validate ASM-13** — Prototype the Dexie OR query pattern. Benchmark against 500-node dataset. (30 min)
4. **Mitigate ASM-6** — Align all @tiptap/* package.json versions to ^2.27.2 before adding @tiptap/suggestion. (15 min)
5. **Mitigate ASM-3** — Decide debug gating: add `debugMode` to AppSettings, or use `import.meta.env.DEV`. (5 min)
6. **Validate ASM-4** — Test InputRule with atom node creation in Tiptap. (15 min)
7. **Validate ASM-9** — Read NotesGrid.tsx and list all features VaultBrowser must replicate. (30 min)

## Suggested Plan Changes

1. **Add `debugMode` to plan's schema changes** — either extend AppSettings or note that `import.meta.env.DEV` will be used instead of `settings.debugMode`.
2. **Add Tiptap version alignment step** — before adding `@tiptap/suggestion`, align all Tiptap packages to ^2.27.2 in package.json.
3. **Document the Dexie OR query pattern** — the plan mentions extending `WHERE campaignId = X` to `WHERE campaignId = X OR scope = 'shared'` but should note this requires two separate Dexie queries merged client-side.
4. **Add scope field to baseNoteSchema in the plan's schema section** — the plan describes the field on kb_nodes but doesn't explicitly list it in the Note type changes (only in the migration description).
