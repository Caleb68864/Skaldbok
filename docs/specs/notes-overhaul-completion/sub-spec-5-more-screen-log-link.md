---
sub_spec_id: SS-05
phase: run
depends_on: []
dispatch: factory
---

# Sub-Spec 5 — Reach the log from the More screen

## Scope

Add a "Session Log" link to `MoreScreen`'s existing link list pointing at
`/session/log`. This is the fallback route when `settings.showGlobalFAB` is off,
so the capture screen is never unreachable.

## Files

- **Files (modify):**
  - `src/screens/MoreScreen.tsx`

## Decisions

- **Position:** **first** in the list, ahead of Settings — it is the most
  frequently needed destination during play.
- **Markup:** the screen renders a literal array of `{ to, label }` objects
  mapped to `<Link>` elements (`MoreScreen.tsx:24-37`). Add one entry to that
  array. Do **not** introduce a new list-item component or change the existing
  `className` string.
- **Manage Party** stays where it is — it is a `<button>` above the link array,
  not part of it.

## Implementation Steps

### Step 1. Add the entry

In `src/screens/MoreScreen.tsx`, prepend `{ to: '/session/log', label: 'Session Log' }`
to the array at line ~24, so it reads:

```tsx
{[
  { to: '/session/log', label: 'Session Log' },
  { to: '/settings', label: 'Settings' },
  { to: '/reference', label: 'Reference' },
  { to: '/library', label: 'Character Library' },
  { to: '/profile', label: 'Profile' },
].map(({ to, label }) => (
```

### Step 2. Build

```bash
npm run build
```

### Step 3. Commit

```bash
git add src/screens/MoreScreen.tsx
git commit -m "feat(nav): reach the session log from the More screen [factory-managed]"
```

## Interface Contracts

None — no dependencies, and nothing depends on this before SS-06.

## Verification Commands

```bash
npm run build
grep -n "/session/log" src/screens/MoreScreen.tsx
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| More screen links to the log | [MECHANICAL] | `[ $(grep -c "/session/log" src/screens/MoreScreen.tsx) -ge 1 ] \|\| (echo "FAIL: MoreScreen has no /session/log link" && exit 1)` |
| Link is labelled Session Log | [STRUCTURAL] | `grep -q "label: 'Session Log'" src/screens/MoreScreen.tsx \|\| (echo "FAIL: no 'Session Log' label in MoreScreen" && exit 1)` |
| Link is first in the array | [STRUCTURAL] | `grep -A1 "^      {\[$" src/screens/MoreScreen.tsx \| grep -q "/session/log" \|\| (echo "FAIL: Session Log is not the first link entry" && exit 1)` |
| Project builds | [MECHANICAL] | `npm run build \|\| (echo "FAIL: npm run build failed" && exit 1)` |

## Behavioral Criteria (manual / reviewer judgment)

- With `settings.showGlobalFAB` set to off, More → Session Log still reaches the
  capture screen.
