---
date: 2026-04-15
evaluated_date: 2026-04-15
topic: "Staged split plan for engines, packages, and future multi-repo extraction"
author: Caleb Bennett
status: evaluated
tags:
  - design
  - architecture
  - modularization
  - packages
  - monorepo
  - multi-repo
  - skaldbok
---

# Engine And Project Split Plan

## Summary

Skaldbok is now at the point where modularization is realistic, but not at
the point where immediate multi-repo extraction would be the safest move.
The right path is:

1. Keep shipping in the current app.
2. Harden boundaries inside the repo first.
3. Split into local packages while still in one repo.
4. Move only the truly stable and reused engines into separate repos later.

The small hardening pass completed on 2026-04-15 supports this direction:

- the timeline barrel is now treated as a protected generic boundary
- canonical note creation policy now lives in one shared service
- note write policy is documented in [docs/reference/note-write-path.md](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/docs/reference/note-write-path.md)

This plan describes how to turn those seams into package boundaries over time
without slowing feature work.

## Goals

- split reusable engines out of app screens and feature glue
- support future rulesets beyond Dragonbane
- keep the app usable during every step of migration
- avoid a premature repo explosion
- make AI-assisted work safer by clarifying ownership and boundaries

## Non-Goals

- no immediate rewrite into packages
- no forced multi-repo move before APIs stabilize
- no extraction of app-specific session screens or workflow-heavy UI yet

## What Counts As An Engine

For this plan, an "engine" means logic that can survive outside the current
screen tree and outside the Dragonbane-specific app shell.

Examples:

- timeline layout and rendering contracts
- note write policy and note domain logic
- entity graph / linking rules
- ruleset adapters
- import/export bundle logic

Not engines:

- `SessionScreen`
- current quick-action drawers
- campaign/session shell state
- feature-specific routing and navigation

## Recommended End State

Target a layered architecture that can live in one repo first and expand to
multiple repos later:

```text
apps/
  skaldbok-app/

packages/
  timeline-core/
  notes-core/
  entity-graph-core/
  ruleset-core/
  ruleset-dragonbane/
  import-export-core/
```

Possible later repo split:

```text
repo: skaldbok-app
repo: timeline-core
repo: campaign-notes-core
repo: tabletop-rulesets
```

## Package Candidates

### 1. `timeline-core`

Current source:

- [src/components/timeline](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/src/components/timeline)

Owns:

- timeline types
- layout math
- filtering and selection state
- rendering primitives

Should not own:

- notes
- sessions
- encounters
- repository lookups
- app-specific adapters

Readiness:

- best first extraction target
- move to local package first
- likely first candidate for its own repo later

### 2. `notes-core`

Current source:

- [src/types/note.ts](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/src/types/note.ts)
- [src/features/notes/noteCreationService.ts](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/src/features/notes/noteCreationService.ts)
- selected note utilities under `src/utils/notes`

Owns:

- note record construction
- note defaults
- note linking policy
- note filtering/search helpers
- note-type contracts once stabilized

Should not own:

- React hooks
- Tiptap components
- Dexie repository implementations
- toasts

Readiness:

- extractable into a local package after a little more cleanup
- not yet ready for its own repo

### 3. `entity-graph-core`

Current source:

- [src/types/entityLink.ts](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/src/types/entityLink.ts)
- [src/storage/repositories/entityLinkRepository.ts](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/src/storage/repositories/entityLinkRepository.ts)

Owns:

- entity-link contracts
- relationship semantics
- traversal helpers
- soft-delete-friendly edge policies

Should not own:

- Dexie-specific storage details in the long term
- screen-level workflows

Readiness:

- strong candidate for local package extraction
- possible later merge with `notes-core` if reuse remains tightly related

### 4. `ruleset-core`

Current source:

- [src/types/system.ts](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/src/types/system.ts)
- [src/features/systems/useSystemDefinition.ts](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/src/features/systems/useSystemDefinition.ts)

Owns:

- ruleset interfaces
- adapter contracts
- registration/loading model

Should not own:

- Dragonbane data itself
- app shell behavior

Readiness:

- design boundary first
- implementation package later

### 5. `ruleset-dragonbane`

Current source:

- [src/systems/dragonbane](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/src/systems/dragonbane)
- Dragonbane logic currently scattered across screens, utils, and session flows

Owns:

- system definition JSON
- Dragonbane labels and presets
- quick action definitions
- derived values
- Dragonbane timeline grouping rules

Should not own:

- generic note logic
- generic timeline UI

Readiness:

- not extractable yet
- first consolidate scattered Dragonbane assumptions into one layer

### 6. `import-export-core`

Current source:

- [src/utils/export](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/src/utils/export)
- [src/utils/import](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/src/utils/import)

Owns:

- bundle shape
- serialization/parsing
- privacy filtering
- format-specific render helpers

Readiness:

- extractable later
- should wait until system assumptions are less Dragonbane-specific

## What Should Stay In The App

Keep these local even after package extraction starts:

- [src/screens](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/src/screens)
- [src/features/campaign](/C:/Users/CalebBennett/Documents/GitHub/Skaldbok/src/features/campaign)
- current session quick-action drawers
- encounter-specific flow components
- current knowledge-base screen composition

These files are still workflow-heavy and tightly coupled to the active app.

## Staged Extraction Plan

## Phase 0 — Current State

Status: started

Completed:

- protected the generic timeline barrel
- created canonical note write policy service
- documented the canonical note write path

Result:

- the codebase has cleaner seams than before, but the app is still one deployable unit

## Phase 1 — Local Package Boundaries Inside The Existing Repo

Status: recommended next implementation phase

Create package-like folders or actual workspace packages inside this repo:

- `packages/timeline-core`
- `packages/notes-core`
- `packages/entity-graph-core`

Rules for this phase:

- no external publishing
- no separate repos yet
- imports may still be internal workspace imports
- keep one CI and one release flow

Success criteria:

- timeline core no longer imports app adapters
- note write policy is fully consumed through shared core helpers
- graph contracts are separate from app feature code

## Phase 2 — Ruleset Extraction Inside The Repo

Status: after Phase 1 settles

Create:

- `packages/ruleset-core`
- `packages/ruleset-dragonbane`

Work required:

- define a `RulesetAdapter` contract
- move Dragonbane quick action data out of UI components
- move Dragonbane-derived formulas out of generic `utils`
- move note-type labels, track mappings, and presets into ruleset or config

Success criteria:

- new rulesets can be added without changing timeline core or note core
- Dragonbane assumptions are no longer spread across many features

## Phase 3 — App Consumption Cleanup

Status: after internal packages exist

Refactor the app to consume the packages as if they were external libraries:

- minimize deep cross-package imports
- keep only app glue in `apps/skaldbok-app`
- add README files per package
- add owner-style boundaries in docs

Success criteria:

- package APIs are explicit
- package internals are not imported ad hoc from app code

## Phase 4 — Decide Which Packages Deserve Separate Repos

Status: only after actual reuse appears

Use these tests before creating a separate repo:

- is the API stable for at least a few weeks of active use?
- is another app or prototype consuming it?
- does it have a release cadence different from the app?
- would independent versioning be valuable?
- is the package mostly free of app-specific branding and assumptions?

If the answer is "not yet", keep it in the monorepo.

## Multi-Repo Recommendation

### Start With One Repo

Preferred near-term shape:

- one app repo
- multiple internal packages
- one lockfile
- one CI

Why:

- safer for a live solo project
- easier refactors across boundaries
- less release and versioning overhead
- simpler AI-assisted edits

### Move To Multiple Repos Later, Selectively

Only split to multiple repos when reuse is proven.

Recommended order if separate repos become justified:

1. `timeline-core`
2. `campaign-notes-core` or combined `notes-core + entity-graph-core`
3. `tabletop-rulesets` containing `ruleset-core` plus `ruleset-dragonbane`

### Repo Candidates

#### Repo: `timeline-core`

Good candidate because:

- already has a clean generic contract
- likely reusable outside Skaldbok
- low dependency on local-first storage details

#### Repo: `campaign-notes-core`

Possible candidate once stable because:

- note construction, linking, and filtering are broadly reusable
- still needs stronger typing and less app-specific leakage first

#### Repo: `tabletop-rulesets`

Good candidate only after ruleset interfaces are stable because:

- this can hold Dragonbane and future rulesets together
- avoids one repo per tiny ruleset too early

## Folder Proposal For The Current Repo

If you want to begin the split without changing deployment shape, this is the
recommended target:

```text
apps/
  skaldbok-app/

packages/
  timeline-core/
    src/
    README.md
  notes-core/
    src/
    README.md
  entity-graph-core/
    src/
    README.md
  ruleset-core/
    src/
    README.md
  ruleset-dragonbane/
    src/
    README.md
  import-export-core/
    src/
    README.md
```

## API Boundaries To Protect

### `timeline-core`

Public API should expose:

- timeline types
- `TimelineRoot`
- timeline hooks and layout helpers

Public API should not expose:

- mock data
- examples
- note-specific adapters

### `notes-core`

Public API should expose:

- note record builder
- note link policy
- note-type registry interfaces later

Public API should not expose:

- React hooks
- repositories
- attachment UI

### `ruleset-core`

Public API should expose:

- adapter interfaces
- note taxonomy interfaces
- track grouping interfaces
- quick action definition interfaces

Public API should not expose:

- Dragonbane constants directly

## Risks

### Risk: Splitting Repos Too Early

Cost:

- versioning overhead
- slower refactors
- duplicated setup and CI
- more brittle local linking

Mitigation:

- stay in one repo until packages are stable and reused

### Risk: Extracting App Glue As If It Were Generic

Cost:

- bad package APIs
- fake abstractions
- extra churn with little payoff

Mitigation:

- keep screens, workflow-heavy hooks, and session shell logic local

### Risk: Dragonbane Leakage Into Core Packages

Cost:

- future rulesets become awkward
- generic packages are not actually generic

Mitigation:

- force all Dragonbane defaults behind a ruleset/config layer before repo extraction

## Concrete Next Steps

1. Keep using the new canonical note write path for all new note flows.
2. Stop adding app-specific exports to the timeline barrel.
3. Add `README.md` files for `notes`, `session`, and `systems` explaining boundaries.
4. Convert the timeline folder into the first real internal package boundary.
5. After that settles, move note-core and entity-graph-core behind package APIs.
6. Only then start the ruleset-core and ruleset-dragonbane split.

## Recommendation

Do not jump straight to many repos.

The best practical path is:

- one repo now
- several internal packages next
- a few separate repos later, only where reuse is real

If you want one immediate follow-up task after this plan, it should be:

**turn `src/components/timeline` into the first local package boundary while
leaving the rest of the app in place.**
