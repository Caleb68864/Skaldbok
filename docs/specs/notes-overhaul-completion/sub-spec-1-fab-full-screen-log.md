---
sub_spec_id: SS-01
phase: run
depends_on: []
dispatch: factory
---

# Sub-Spec 1 — FAB navigates to the full-screen log

## Scope

Rewire `GlobalFAB` from a drawer host into a navigation trigger, and make
`/session/log` render correctly as a full-screen route inside the shell.

`SessionLog` was built to be mounted inside `SessionQuickActions`' explicit
`<div className="flex h-[70vh] flex-col gap-3">` wrapper, which this work
deletes. As a bare route it renders into
`<main className="flex-1 overflow-y-auto overflow-x-hidden pb-[140px]">`
(`ShellLayout.tsx`) — itself a scroll container. The docked `WritePad` must not
fall below the fold: on the Tab S9 with the handwriting pad open, that is the
entire screen misbehaving.

> **Corrected during implementation.** This paragraph originally reasoned that
> `h-full` "resolves to the full main height *plus* 140px of padding". That is
> backwards — under `box-sizing: border-box` the padding sits *inside* main's
> height, so main's content box is already `H - 140` and `h-full` measures
> exactly that, with scroll height equal to client height. The factory shipped
> the opposite error, `h-[calc(100%-140px)]`, subtracting the padding twice and
> wasting ~140px of writing area. The shipped answer is plain `h-full`; see the
> comment in `SessionLog.tsx`.

## Files

- **Files (modify):**
  - `src/components/shell/GlobalFAB.tsx`
  - `src/features/session/sessionLog/SessionLog.tsx`

## Decisions

- **Hide mechanism:** `useLocation().pathname === '/session/log'` — the route is
  the fact being tested. A context flag would need threading through
  `ShellLayout`. `ShellLayout.tsx:46` already uses this exact idiom
  (`location.pathname.startsWith('/character')` for `isCharacterTab`); follow it.
- **No-session behaviour:** navigate to `/session/log` anyway. `SessionLog`
  already renders "Start a session to begin logging" with a Start session button
  (`SessionLog`'s no-session empty state). Delete the `showToast('Start a session first')`
  calls — routing to the action the user wanted beats a dead-end toast.
- **Header (red-team A-1):** render a minimal header on the log showing the
  active session's title. The bottom nav is the back affordance — do **not** add
  a separate back button.
- **Layout:** constrain `SessionLog`'s root so the entry list is the only
  scrolling element in the route's subtree. Do **not** change `ShellLayout`'s
  `pb-[140px]` — other routes depend on it.
- **Context members:** stop consuming `requestedQuickLogAction`,
  `requestedQuickLogNonce` and `clearQuickLogRequest` here. SS-03 removes the
  members from the context itself; this sub-spec only removes GlobalFAB's use of
  them. Leaving unused context members in place between SS-01 and SS-03 compiles
  fine.
- **Retained:** the `settings.showGlobalFAB === false` early return stays.

## Implementation Steps

### Step 1. Read the current shape

Read `src/components/shell/GlobalFAB.tsx` in full (107 lines) and
`src/features/session/sessionLog/SessionLog.tsx` lines 187-253 (the empty state
and the render tree). Note that `GlobalFAB` currently imports `Drawer`,
`SessionQuickActions`, `useToast` and four members of `useSessionRefresh`.

### Step 2. Rewire GlobalFAB to navigate

Replace the drawer machinery with navigation:

- Remove imports: `Drawer`, `SessionQuickActions`, and the `useEffect` that
  reacted to `requestedQuickLogNonce`.
- Remove state: `drawerOpen`, `closeDrawer`.
- Add `useNavigate` and `useLocation` from `react-router-dom`.
- `handleFABPress` becomes `navigate('/session/log')` unconditionally — no
  session check, no toast.
- Add an early `return null` when `useLocation().pathname === '/session/log'`,
  placed **alongside** the existing `settings.showGlobalFAB === false` guard.
- The button keeps its position classes and its icon. Drop the `rotate-45`
  transform tied to `drawerOpen`; there is no open state any more.
- Update `aria-label` to something route-accurate, e.g. `'Open session log'`.
- Rewrite the JSDoc block — it currently describes a "16-action grid" and the
  `openQuickLog` external-caller contract, both of which are being deleted.

### Step 3. Constrain the log route's height

In `SessionLog.tsx`, the root is currently `<div className="flex h-full flex-col">`.
Give it a height that resolves against the viewport rather than an unconstrained
parent, accounting for the shell chrome above (`CampaignHeader`) and below
(`BottomNav`). A viewport-relative max-height on the root plus `min-h-0` on the
scrolling entry-list wrapper is the standard fix for a flex child that refuses to
shrink inside a scroll container.

Verify by resizing: the entry list must scroll internally while the `WritePad`
commit button stays pinned in view.

### Step 4. Add the session-title header

Add a compact header row above the entry list showing
`activeSession.title` (the component already destructures `activeSession` from
`useCampaignContext()` at `SessionLog`'s `useCampaignContext()` call). Match the muted-label typography
used elsewhere in the file
(`text-xs text-[var(--color-text-muted,#666)]`). Do not add a back button.

### Step 5. Build

```bash
npm run build
```

Expect exit 0. `GlobalFAB` still imports `SessionQuickActions`? No — that import
must be gone, or SS-02's deletion will break the build.

### Step 6. Commit

```bash
git add src/components/shell/GlobalFAB.tsx src/features/session/sessionLog/SessionLog.tsx
git commit -m "feat(session-log): make the FAB open the log full-screen [factory-managed]"
```

## Interface Contracts

### GlobalFAB → SessionRefreshContext quick-log members

- Direction: Sub-spec 1 → Sub-spec 3
- Owner: Sub-spec 3 (which deletes the members)
- Shape: after SS-01, `GlobalFAB` must reference **none** of
  `openQuickLog`, `clearQuickLogRequest`, `requestedQuickLogAction`,
  `requestedQuickLogNonce`. SS-03 cannot delete them until this holds.

### GlobalFAB → SessionQuickActions

- Direction: Sub-spec 1 → Sub-spec 2
- Owner: Sub-spec 2 (which deletes the file)
- Shape: after SS-01, `GlobalFAB` must not import
  `features/session/SessionQuickActions`. SS-02's deletion depends on it.

## Verification Commands

```bash
npm run build
grep -c "SessionQuickActions" src/components/shell/GlobalFAB.tsx   # expect 0
grep -c "Drawer" src/components/shell/GlobalFAB.tsx                # expect 0
grep -c "useNavigate" src/components/shell/GlobalFAB.tsx           # expect >=1
```

## Checks

Auto-generated from `[MECHANICAL]` and `[STRUCTURAL]` criteria. Each command
exits 0 on pass, 1 with a one-line summary on fail.

| Criterion | Type | Command |
|-----------|------|---------|
| GlobalFAB no longer references SessionQuickActions | [MECHANICAL] | `[ $(grep -c "SessionQuickActions" src/components/shell/GlobalFAB.tsx) -eq 0 ] \|\| (echo "FAIL: GlobalFAB still references SessionQuickActions" && exit 1)` |
| GlobalFAB renders no Drawer | [MECHANICAL] | `[ $(grep -c "Drawer" src/components/shell/GlobalFAB.tsx) -eq 0 ] \|\| (echo "FAIL: GlobalFAB still renders a Drawer" && exit 1)` |
| GlobalFAB navigates to /session/log | [STRUCTURAL] | `grep -q "navigate('/session/log')" src/components/shell/GlobalFAB.tsx \|\| (echo "FAIL: GlobalFAB does not navigate to /session/log" && exit 1)` |
| GlobalFAB hides on the log route | [STRUCTURAL] | `grep -q "'/session/log'" src/components/shell/GlobalFAB.tsx && grep -q "useLocation" src/components/shell/GlobalFAB.tsx \|\| (echo "FAIL: GlobalFAB has no route-based hide check" && exit 1)` |
| showGlobalFAB guard retained | [STRUCTURAL] | `grep -q "showGlobalFAB" src/components/shell/GlobalFAB.tsx \|\| (echo "FAIL: showGlobalFAB guard was removed" && exit 1)` |
| Log route renders the session title | [STRUCTURAL] | `grep -q "activeSession.title\|activeSession?.title" src/features/session/sessionLog/SessionLog.tsx \|\| (echo "FAIL: log route has no session-title header" && exit 1)` |
| Project builds | [MECHANICAL] | `npm run build \|\| (echo "FAIL: npm run build failed" && exit 1)` |

## Behavioral Criteria (manual / reviewer judgment)

- With a session active, pressing the FAB from `/character/sheet` lands on
  `/session/log` showing the entry list and `WritePad`.
- With no session active, pressing the FAB lands on `/session/log` showing the
  "Start a session to begin logging" empty state and its Start session button.
- While on `/session/log`, no FAB is rendered — nothing overlaps `WritePad` or
  the entry list.
- At a 1600×2560 tablet viewport with ~30 committed entries, the entry list
  scrolls internally and the `WritePad` commit button is visible without
  scrolling the page.
