---
type: phase-spec
master_spec: "docs/specs/2026-04-16-game-night-reliability-fixes.md"
sub_spec: 7
title: "Stale-session route-change re-check"
dependencies: []
phase: 2
---

# Sub-Spec 7: Stale-Session Route-Change Re-Check

## Scope

Move staleness detection in `CampaignContext` from one-shot hydration to a `useLocation`-keyed effect. When Continue is clicked, remember the session id so subsequent route changes on the same session don't re-prompt. Navigation to a different session (or clearing the session) naturally re-arms detection.

## Files

- `src/features/campaign/CampaignContext.tsx` (modified)

## Interface Contracts

None — internal to `CampaignContext`. The existing `<StaleSessionModal>` usage stays unchanged.

## Implementation Steps

1. **Read the current detection logic.** It lives inside the hydration effect around line 248-249 (`if (session && Date.now() - new Date(session.startedAt).getTime() > STALE_SESSION_MS) { setStaleSession(session); }`). This only fires once at hydration.

2. **Add `useLocation` import.** Top of file: `import { useLocation } from 'react-router-dom';`.

3. **Inside `CampaignProvider`, add**:
   ```ts
   const location = useLocation();
   const staleModalDismissedForSessionIdRef = useRef<string | null>(null);
   ```

4. **Add the route-change effect.** Place after the hydration effect:
   ```ts
   useEffect(() => {
     if (!activeSession) return;
     if (staleModalDismissedForSessionIdRef.current === activeSession.id) return;
     if (Date.now() - new Date(activeSession.startedAt).getTime() > STALE_SESSION_MS) {
       setStaleSession(activeSession);
     }
   }, [location.pathname, activeSession]);
   ```

5. **Wire Continue to set the dismissed ref.** Find the `StaleSessionModal` render (around the existing `staleSession &&` block). The modal's `onContinue` must set the ref AND clear `staleSession`:
   ```tsx
   {staleSession && (
     <StaleSessionModal
       sessionTitle={staleSession.title ?? 'Untitled session'}
       onContinue={() => {
         staleModalDismissedForSessionIdRef.current = staleSession.id;
         setStaleSession(null);
       }}
       onEnd={() => {
         // existing onEnd logic
       }}
     />
   )}
   ```

6. **Ensure dismissed ref clears when session changes.** Add a second tiny effect or include in the hydration teardown:
   ```ts
   useEffect(() => {
     if (!activeSession) {
       staleModalDismissedForSessionIdRef.current = null;
     }
   }, [activeSession]);
   ```
   (This is simple enough that inlining at the top of the route-change effect also works — agent's choice.)

7. **Build check.** `npm run build` → exit 0.

8. **Manual smoke.** Seed a stale session (set `startedAt` to 2 days ago via DevTools). Navigate `/session` → `/library` → `/knowledge`. Modal should appear at each navigation. Click Continue. Further navigation should NOT re-prompt. Reload — fresh instance, modal reappears.

9. **Commit.** Message: `fix(campaign): re-check stale session on route change, not only on hydration`

## Verification Commands

```bash
npm run build

# useLocation imported
grep -q "import { useLocation } from 'react-router-dom'\|useLocation," src/features/campaign/CampaignContext.tsx

# Dismissed-ref declared
grep -q "staleModalDismissedForSessionIdRef" src/features/campaign/CampaignContext.tsx

# Route-change effect keyed on pathname
grep -B1 "location.pathname" src/features/campaign/CampaignContext.tsx | grep -q "useEffect"
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| useLocation imported | [STRUCTURAL] | `grep -q "useLocation" src/features/campaign/CampaignContext.tsx \|\| (echo "FAIL: useLocation not imported" && exit 1)` |
| Dismissed ref present | [STRUCTURAL] | `grep -q "staleModalDismissedForSessionIdRef" src/features/campaign/CampaignContext.tsx \|\| (echo "FAIL: dismissed ref missing" && exit 1)` |
| Effect keyed on location.pathname | [STRUCTURAL] | `grep -q "location.pathname" src/features/campaign/CampaignContext.tsx \|\| (echo "FAIL: effect not keyed on pathname" && exit 1)` |
| Continue handler sets the dismissed ref | [STRUCTURAL] | `grep -q "staleModalDismissedForSessionIdRef.current = " src/features/campaign/CampaignContext.tsx \|\| (echo "FAIL: Continue not wiring dismissed ref" && exit 1)` |
| npm run build exits zero | [MECHANICAL] | `npm run build 2>&1 \| tail -3 ; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
