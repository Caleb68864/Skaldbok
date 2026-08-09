---
type: phase-spec
sub_spec_id: SS-08
sub_spec: 8
phase: run
depends_on: ['SS-05', 'SS-06', 'SS-07']
wave: 4
master_spec: "docs/specs/2026-08-08-campaign-ledger-and-route-planner.md"
---

# Sub-Spec 8 — Route screen with declaration-driven fields and gated nav

## Why it waits for SS-07

SS-08 has no logical dependency on the ledger. It is sequenced behind SS-07
because **both edit `src/routes/index.tsx` and
`src/components/shell/CampaignHeader.tsx`**, and concurrent worktrees would
collide on both files. (Red-team C-2.) Do not remove this edge.

## Codebase analysis

- `src/screens/SheetScreen.tsx:582` and `src/components/PrintableSheet.tsx:55`
  both render from `system?.identityFields ?? []` — the same shape this screen
  renders from. Follow their loop-and-switch-on-`type` pattern.
- `CampaignHeader.tsx:177` — the `Ships` link. **Ships is ungated**, which is the
  wart this sub-spec must not copy: the Route link renders only when
  `system?.routePlanner` is present.
- `src/routes/index.tsx` — catch-all `'*'` already redirects unknown URLs, so a
  Dragonbane user hitting `/route` needs the screen itself to redirect.

## Interface Contracts

**Requires:** `SystemDefinition.routePlanner` from SS-05; `readNumericField`,
`reorder`, `totalDistance`, `routeRepository` from SS-06.
**Provides:** `src/screens/RouteScreen.tsx` — the mount point SS-09 adds an
export control to.

## Decisions (committed — do not escalate)

- **This sub-spec contains the `routePlanner` reader** that satisfies
  `declaredCapabilities.test.ts`. Never resolve that test by adding
  `routePlanner` to `KNOWN_UNIMPLEMENTED`.
- **Up/down reorder controls, not drag.** Reliable under a stylus on a tablet,
  and there is no existing drag primitive in the codebase to reuse.
- **Field `type` drives the input element only.** Every value is stored as a
  string; every numeric read goes through `readNumericField`.
- **No Traveller vocabulary in this file.** "UWP" and "parsecs" come from the
  declaration. A literal `UWP` in the screen defeats the entire design.
- **Direct navigation to `/route` with no declaration redirects**, matching the
  catch-all convention. Do not render an error page.

## Implementation steps

### Step 1. `useRoute` hook

Loads stops by campaign, exposes `stops`, `fields` (from
`system.routePlanner.fields`), `totalDistance`, `addStop`, `updateStop`,
`removeStop`, `moveStop`.

### Step 2. `RouteScreen` with generated inputs

Loop `fields`; `text` → input, `textarea` → textarea, `number` → numeric input.
`name` binds to the column; everything else to `values[field.id]`.

### Step 3. Reorder controls

Up/down per row calling `routeRepository.reorder` with the new id order.

### Step 4. Gate the route and the nav link

`/route` in `src/routes/index.tsx`; the link in `CampaignHeader.tsx` rendered
only when `system?.routePlanner` is truthy. The screen itself redirects when the
declaration is absent.

### Step 5. Verify both systems in a browser

Traveller: five labelled inputs per stop, reorder persists across reload.
Dragonbane: no nav link, `/route` redirects.

### Step 6. Commit

```bash
git add src/screens/RouteScreen.tsx src/features/route src/routes/index.tsx src/components/shell/CampaignHeader.tsx
git commit -m "feat(traveller): a jump route the system declares its own fields for"
```

## Verification Commands

```bash
npm run build
npx vitest run src/features/systems/declaredCapabilities.test.ts
```

## Checks

| Criterion | Type | Command |
|---|---|---|
| A real reader exists | [MECHANICAL] | `grep -rq "routePlanner" src/screens src/features/route src/components/shell \|\| (echo "FAIL: routePlanner has no reader outside the type files" && exit 1)` |
| Not allowlisted instead of read | [STRUCTURAL] | `! grep -q "routePlanner" src/features/systems/declaredCapabilities.test.ts \|\| (echo "FAIL: routePlanner was added to KNOWN_UNIMPLEMENTED instead of being read" && exit 1)` |
| No Traveller vocabulary in the screen | [MECHANICAL] | `! grep -rqi "uwp\|parsec" src/screens/RouteScreen.tsx src/features/route \|\| (echo "FAIL: Traveller vocabulary hardcoded in system-neutral UI" && exit 1)` |
| Parsing lives only in routeMath | [MECHANICAL] | `! grep -rqE "parseFloat\|parseInt\|Number\(" src/features/route src/screens/RouteScreen.tsx \|\| (echo "FAIL: numeric parsing outside readNumericField" && exit 1)` |
| No systemId branching | [MECHANICAL] | `! grep -rq "systemId ===" src/features/route src/screens/RouteScreen.tsx \|\| (echo "FAIL: systemId branch in route UI" && exit 1)` |
| Route registered | [STRUCTURAL] | `grep -q "'/route'" src/routes/index.tsx \|\| (echo "FAIL: /route not registered" && exit 1)` |
| Nav link is gated | [STRUCTURAL] | `grep -q "routePlanner" src/components/shell/CampaignHeader.tsx \|\| (echo "FAIL: Route nav link is ungated — do not repeat the Ships wart" && exit 1)` |
| Declared capabilities green | [MECHANICAL] | `npx vitest run src/features/systems/declaredCapabilities.test.ts \|\| (echo "FAIL: declaredCapabilities" && exit 1)` |
| Build clean | [MECHANICAL] | `npm run build \|\| (echo "FAIL: build" && exit 1)` |
