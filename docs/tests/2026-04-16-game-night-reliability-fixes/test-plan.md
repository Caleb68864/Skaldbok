---
title: "Game-Night Reliability Fixes Test Plan"
project: "Skaldbok"
date: 2026-04-16
type: test-plan
tags:
  - test-plan
  - game-night-reliability-fixes
  - session-safety
---

# Test Plan: Game-Night Reliability Fixes

## Meta
- Project: Skaldbok
- Date: 2026-04-16
- Author: Caleb Bennett
- Spec Source: `docs/specs/2026-04-16-game-night-reliability-fixes.md`
- Scope: SS-1 through SS-11 (autosave flush bus, atomic encounter reopen, creature-template soft-delete cascade, stale-session route observer, resume prompt + Undo toast, Dexie v9 bestiary migration, TrashScreen)
- Quality Scores (from spec): 35/35
- Ship Status: committed to `main` as `58dc42d`, `48eeb62`, `b54627c`, `c34862b`

## Prerequisites

- Dev server running at `https://localhost:4173` via `build-and-run.bat` (configured in `forge-project.json`).
- `npm install` completed.
- Playwright installed via `npx --yes --package playwright` (the existing `output/playwright/session_smoke.cjs` demonstrates the working tool chain).
- Browser: Chromium is sufficient. Service worker registration may be blocked during tests (matches the existing smoke runner).
- Tests are self-contained per scenario — each seeds its own IndexedDB state via `evaluate`, no shared fixtures.
- Destructive scenarios (`SR-12` which forces a Dexie version bump from seeded v8 state) must be run in **private / incognito** or against a fresh `indexedDB` per run so `skaldbok-db` can be re-seeded at v8.

## Scenarios

| ID | Title | Area | Tool | Priority | Sequential |
|----|-------|------|------|----------|------------|
| SR-01 | autosaveFlush registry: registerFlush + flushAll semantics | Unit | bash | High | No |
| SR-02 | useAutosave registers with bus + flushes pending character save | Hook | playwright | High | No |
| SR-03 | NoteEditor pendingUpdatesRef persists edits on fast navigation | Screen | playwright | Critical | No |
| SR-04 | Combat participant in-flight update flushes on session end | Screen | playwright | High | No |
| SR-05 | SessionScreen.confirmEndSession awaits flushAll + disables button | Screen | playwright | Critical | No |
| SR-06 | Atomic `encounterRepository.reopenEncounter` rolls back on throw | Repo | playwright | High | No |
| SR-07 | `useSessionEncounter.reopenEncounter` delegates to repository | Hook | playwright | Medium | No |
| SR-08 | `entityLinkRepository.softDeleteLinksForCreature` cascades edges | Repo | bash | High | No |
| SR-09 | `creatureTemplateRepository.softDelete` cascades, `archive()` removed | Repo | bash | High | No |
| SR-10 | Stale-session modal re-prompts on route change, honors Continue | Context | playwright | Medium | No |
| SR-11 | Resume session shows ReopenEncounterPrompt + Undo toast closes again | Context | playwright | Medium | No |
| SR-12 | Dexie v9 migration transforms archived rows + writes snapshot | DB | playwright | Critical | Yes |
| SR-13 | BestiaryScreen action labeled "Delete", "View Trash" link routes | Screen | playwright | Medium | No |
| SR-14 | TrashScreen at `/bestiary/trash` lists deleted, Restore round-trip | Screen | playwright | High | No |
| SR-15 | Read-path audit: every `db.creatureTemplates` caller filters deletedAt | Audit | bash | High | No |
| SR-16 | Build + existing session smoke still pass end-to-end | Build | bash | Critical | No |
| INT-01 | End Session with pending note + character + combat update: all persist | Integration | playwright | Critical | Yes |
| INT-02 | Full archived-creature soft-delete round-trip (migration → trash → restore) | Integration | playwright | High | Yes |

Each scenario is in its own file in this directory. Explicit links for the parser:

- [[SR-01-autosave-flush-registry]]
- [[SR-02-useautosave-bus-registration]]
- [[SR-03-note-editor-fast-navigation]]
- [[SR-04-combat-participant-flush]]
- [[SR-05-session-end-flush-and-disable]]
- [[SR-06-atomic-reopen]]
- [[SR-07-hook-delegates-to-repository]]
- [[SR-08-soft-delete-links-for-creature]]
- [[SR-09-creature-soft-delete-cascade]]
- [[SR-10-stale-session-route-check]]
- [[SR-11-resume-prompt-and-undo]]
- [[SR-12-dexie-v9-migration]]
- [[SR-13-bestiary-delete-and-trash-link]]
- [[SR-14-trash-screen-restore]]
- [[SR-15-read-path-audit]]
- [[SR-16-build-and-smoke]]
- [[INT-01-end-session-full-flush]]
- [[INT-02-archived-creature-full-round-trip]]

## Coverage Summary

- Total scenarios: 18
- Spec requirements covered: 16 / 16 (every numbered requirement has at least one SR- scenario)
- Integration scenarios: 2 (both cross multiple sub-spec boundaries)
- Critical-priority scenarios: 5 (SR-03, SR-05, SR-12, SR-16, INT-01)
- Sequential scenarios: 3 (SR-12, INT-01, INT-02 — each mutates DB state or triggers one-way migration; don't parallelize with themselves)
- Tool mix: 12 playwright, 6 bash

## Out of Scope (documented, not tested)

- Undo toast visual polish (hover states, animation timing) — UX detail, not a correctness concern.
- TrashScreen pagination at scale (>1000 deleted creatures) — not a realistic game-night scenario.
- Post-migration snapshot cleanup / TTL — explicitly noted as a follow-up in the spec.
- `beforeunload` defense-in-depth flush — explicitly deferred in the spec.
- Cross-browser validation (Firefox, Safari) — the app is a PWA, Chromium coverage is sufficient for MVP.
