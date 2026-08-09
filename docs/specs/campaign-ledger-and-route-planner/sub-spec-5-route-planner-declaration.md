---
type: phase-spec
sub_spec_id: SS-05
sub_spec: 5
phase: run
depends_on: []
wave: 1
master_spec: "docs/specs/2026-08-08-campaign-ledger-and-route-planner.md"
---

# Sub-Spec 5 — `routePlanner` on the system contract

## Why this exists

A route planner with UWP and parsecs is nonsense in Dragonbane. Rather than
branch on `systemId`, the system *declares* its route fields; the screen exists
only where a declaration does. The same declaration supplies "UWP" and "parsecs"
as Traveller's words rather than the app's.

## Codebase analysis

- `src/types/system.ts:202` — `identityFields` is the exact precedent: an optional
  array of `{ id, label, type? }` whose values live in a per-record bag. Match its
  shape and TSDoc density.
- `schemas/system.schema.ts` — **repo root, not under `src/`.** This is the file
  everyone forgets. Zod strips unknown keys, so a type without a schema entry
  works for bundled systems and silently vanishes for imported ones.
- `src/features/systems/engine/systemDefinitionSchema.test.ts` parses every
  bundled definition through the schema and has a `superRefine` cross-reference
  suite. Line 66 already carries a comment about a field reaching the engine as
  `undefined` "silently, and only for imported systems" — this trap has been hit
  before.
- `src/systems/traveller/system.json:833` — where `identityFields` sits; put
  `routePlanner` nearby.

## Interface Contracts

### SystemDefinition.routePlanner
- Direction: Sub-spec 5 → Sub-spec 8
- Owner: Sub-spec 5
- Shape:
  ```ts
  routePlanner?: {
    label: string;
    distanceFieldId?: string;
    fields: Array<{ id: string; label: string; type?: 'text' | 'textarea' | 'number' }>;
  }
  ```

**Provides:** the type, the Zod entry, and Traveller's declaration.
**Requires:** nothing.
**Shared state:** `system.json`'s `version` counter.

## Decisions (committed — do not escalate)

- **Traveller declares exactly five fields**, in this order:
  `name` (text), `uwp` (text), `hex` (text), `jump` (number), `notes` (textarea).
  `label: 'Jump Route'`, `distanceFieldId: 'jump'`.
- **Bump `src/systems/traveller/system.json`'s `version`.** Without it the change
  is invisible to anyone who has already run the app — including you locally,
  because the IndexedDB cache survives reload.
- **Do NOT bump `sheet.json`.** The sheet layout is untouched. The two counters
  are independent and nothing cross-checks them.
- **classic-fantasy and savage-worlds declare nothing.** Their absence is the
  gate.
- **The Zod entry ships in this sub-spec, not later.** A type without a schema
  entry is the failure mode this whole sub-spec exists to avoid.

## Implementation steps

### Step 1. Write the failing test

Extend `src/features/systems/engine/systemDefinitionSchema.test.ts` with a case
asserting that parsing the Traveller definition yields
`result.data.routePlanner.fields.length === 5`. This is the assertion that proves
Zod is not stripping the key — a plain "does it parse" check would pass even with
no schema entry, which is precisely the bug.

### Step 2. Verify it fails

```bash
npx vitest run src/features/systems/engine/systemDefinitionSchema.test.ts
```

### Step 3. Add the type

`src/types/system.ts`, beside `identityFields`, with TSDoc explaining that the
declaration both gates the screen and supplies its vocabulary.

### Step 4. Add the Zod entry

`schemas/system.schema.ts` — repo root. `label` and `fields` required; each field
needs `id` and `label`; `type` is an optional enum.

### Step 5. Declare Traveller's fields and bump the version

`src/systems/traveller/system.json`. Increment `version` by one.

### Step 6. Verify

```bash
npx vitest run src/features/systems/engine/systemDefinitionSchema.test.ts
npm run build
```

### Step 7. Commit

```bash
git add src/types/system.ts schemas/system.schema.ts src/systems/traveller/system.json
git commit -m "feat(traveller): declare the jump route's world fields"
```

## Verification Commands

```bash
npx vitest run src/features/systems/engine/systemDefinitionSchema.test.ts
npm run build
```

## Checks

| Criterion | Type | Command |
|---|---|---|
| Zod schema knows the key | [STRUCTURAL] | `grep -q "routePlanner" schemas/system.schema.ts \|\| (echo "FAIL: schemas/system.schema.ts has no routePlanner entry — imported systems will silently lose it" && exit 1)` |
| Type declares the key | [STRUCTURAL] | `grep -q "routePlanner" src/types/system.ts \|\| (echo "FAIL: SystemDefinition missing routePlanner" && exit 1)` |
| Traveller declares it | [STRUCTURAL] | `grep -q "routePlanner" src/systems/traveller/system.json \|\| (echo "FAIL: traveller system.json missing routePlanner" && exit 1)` |
| Other systems do not | [STRUCTURAL] | `! grep -q "routePlanner" src/systems/classic-fantasy/system.json && ! grep -q "routePlanner" src/systems/savage-worlds/system.json \|\| (echo "FAIL: a non-Traveller system declares routePlanner" && exit 1)` |
| Traveller system.json version bumped | [MECHANICAL] | `[ "$(git show HEAD:src/systems/traveller/system.json \| grep -m1 '\"version\"' \| grep -oE '[0-9]+')" -lt "$(grep -m1 '\"version\"' src/systems/traveller/system.json \| grep -oE '[0-9]+')" ] \|\| (echo "FAIL: traveller system.json version not bumped — your change will be invisible behind the IndexedDB cache" && exit 1)` |
| sheet.json NOT bumped | [MECHANICAL] | `git diff HEAD --quiet -- src/systems/traveller/sheet.json \|\| (echo "FAIL: sheet.json changed — the sheet layout is out of scope here" && exit 1)` |
| Schema suite passes | [MECHANICAL] | `npx vitest run src/features/systems/engine/systemDefinitionSchema.test.ts \|\| (echo "FAIL: systemDefinitionSchema" && exit 1)` |
