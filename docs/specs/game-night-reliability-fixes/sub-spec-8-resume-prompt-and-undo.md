---
type: phase-spec
master_spec: "docs/specs/2026-04-16-game-night-reliability-fixes.md"
sub_spec: 8
title: "Resume with reopen prompt + Undo toast"
dependencies: [4]
phase: 2
tag: "[INTEGRATION]"
---

# Sub-Spec 8: Resume With Reopen Prompt + Undo Toast `[INTEGRATION]`

## Scope

When user resumes an ended session, query the most-recently-ended non-deleted encounter. If one exists, prompt whether to reopen it. On Reopen, show an Undo toast (calls `endEncounter` to close the just-pushed segment). On Skip or no-encounter, show a "Session resumed" toast.

## Files

- `src/features/campaign/CampaignContext.tsx` (modified — `resumeSession` queries last encounter and dispatches prompt)
- `src/components/modals/ReopenEncounterPrompt.tsx` (new)
- `src/context/ToastContext.tsx` (modified — extend `showToast` to accept an optional action button)

## Interface Contracts

### Consumes `reopenEncounter` (from Sub-spec 4)
- Implements contract from Sub-spec 4

### Consumes `endEncounter` (existing API on `useSessionEncounter`)
- Used for the Undo action — call `endEncounter(lastEncounter.id)` to close the just-pushed segment.

### Consumes `flushAll` (from Sub-spec 1)
- Resume must await `flushAll()` before flipping session status.

## Implementation Steps

0. **Extend `ToastContext` to support action buttons.** Current signature at `src/context/ToastContext.tsx:6` is `showToast: (message: string, variant?: ToastVariant, duration?: number) => void` — no action-button support, so the Undo behavior has nowhere to live without this extension. Change to:
   ```ts
   interface ToastAction {
     label: string;
     onClick: () => void | Promise<void>;
   }

   showToast: (
     message: string,
     variant?: ToastVariant,
     options?: { duration?: number; action?: ToastAction }
   ) => void;
   ```
   Update the implementation at line 20 (the useCallback) to accept the new options-bag. For backwards compatibility with existing callers that pass a raw `number` as the third arg, accept either shape by checking `typeof optionsOrDuration === 'number'`. Update the toast render layer (wherever `<Toast>` or equivalent is rendered) to include a button when `action` is present: `<button onClick={action.onClick}>{action.label}</button>`. Keep the toast dismissable both by action-click and by duration-timeout.
   Check all existing `showToast(...)` call sites via `git grep -n "showToast(" src/` and verify the backwards-compatible branch covers them (they pass `message` and optionally `variant` + numeric duration — nothing uses the 3rd arg as an object today).

1. **Create `ReopenEncounterPrompt` component.** `src/components/modals/ReopenEncounterPrompt.tsx`:
   ```tsx
   import { Modal } from '../primitives/Modal';
   import type { Encounter } from '../../types/encounter';

   interface Props {
     encounter: Encounter;
     open: boolean;
     onReopen: () => void;
     onSkip: () => void;
   }

   export function ReopenEncounterPrompt({ encounter, open, onReopen, onSkip }: Props) {
     return (
       <Modal
         open={open}
         onClose={onSkip}
         title="Resume encounter?"
         actions={
           <>
             <button onClick={onSkip}>Skip</button>
             <button onClick={onReopen}>Reopen &quot;{encounter.title ?? 'encounter'}&quot;</button>
           </>
         }
       >
         <p>
           The most recently active encounter in this session was &quot;{encounter.title ?? 'untitled'}&quot;.
           Reopen it, or skip and resume without any open encounter.
         </p>
       </Modal>
     );
   }
   ```
   Adjust imports to match actual `Modal` primitive props (check `src/components/primitives/Modal.tsx` for real prop names — if `actions` isn't the real name, use whatever the primitive expects).

2. **Modify `CampaignContext.resumeSession`** to query + show the prompt. Extract:
   ```ts
   import { ReopenEncounterPrompt } from '../../components/modals/ReopenEncounterPrompt';
   import { flushAll } from '../persistence/autosaveFlush';
   import * as encounterRepository from '../../storage/repositories/encounterRepository';

   const [reopenCandidate, setReopenCandidate] = useState<Encounter | null>(null);
   // ... inside resumeSession:
   async function resumeSession(sessionId: string) {
     await flushAll();
     await db.sessions.update(sessionId, { status: 'active', endedAt: undefined, updatedAt: nowISO() });
     // refresh activeSession via existing mechanism

     const endedEncounters = await encounterRepository.listBySession(sessionId);
     // Selection rule: the encounter whose last segment's endedAt is the most recent,
     // skipping anything currently active or with no segments. listBySession already
     // filters soft-deleted rows via excludeDeleted, but we defensively re-check.
     const candidate = endedEncounters
       .filter(e => !e.deletedAt && e.status !== 'active')
       .map(e => ({ enc: e, lastEnd: lastSegmentEnd(e) }))
       .filter(({ lastEnd }) => lastEnd !== null)
       .sort((a, b) => (b.lastEnd as string).localeCompare(a.lastEnd as string))[0]?.enc;

     // lastSegmentEnd returns the final segment's endedAt ISO string, or null when
     // the encounter has no segments or its final segment is still open (shouldn't
     // happen on an ended encounter but guarded anyway).
     function lastSegmentEnd(enc: Encounter): string | null {
       if (!enc.segments || enc.segments.length === 0) return null;
       const last = enc.segments[enc.segments.length - 1];
       return last.endedAt ?? null;
     }

     if (candidate) {
       setReopenCandidate(candidate);
     } else {
       showToast('Session resumed', 'info');
     }
   }
   ```
   Where `lastSegmentEnd(enc)` returns the timestamp of the last segment's `endedAt`, or 0 if none. Inline this helper or place it in a utility file.

3. **Render the prompt + wire Reopen/Skip handlers** in the provider's JSX tree:
   ```tsx
   {reopenCandidate && (
     <ReopenEncounterPrompt
       encounter={reopenCandidate}
       open={!!reopenCandidate}
       onReopen={async () => {
         const target = reopenCandidate;
         setReopenCandidate(null);
         try {
           await encounterRepository.reopenEncounter(target.sessionId, target.id);
           showToast(`Reopened "${target.title ?? 'encounter'}"`, 'info', {
             duration: 6000,
             action: {
               label: 'Undo',
               onClick: async () => {
                 try {
                   await encounterRepository.end(target.id);
                 } catch (e) {
                   console.error('[resume] undo failed', e);
                   showToast('Undo failed', 'error');
                 }
               },
             },
           });
         } catch (e) {
           console.error('[resume] reopen failed', e);
           showToast('Could not reopen encounter', 'error');
         }
       }}
       onSkip={() => {
         setReopenCandidate(null);
         showToast('Session resumed', 'info');
       }}
     />
   )}
   ```
   The `showToast` third-arg shape depends on the existing `ToastContext` API — if it doesn't support action buttons today, either extend the toast type or fall back to a simple "Reopened X" toast (document the limitation). Check `src/context/ToastContext.tsx` before committing.

4. **(Step 0 already handles this.)** The Undo button is rendered inline by the extended toast. No separate fallback UI needed.

5. **Build check.** `npm run build` → exit 0.

6. **Playwright** — manually or via smoke: end a session with an open encounter, resume it. Prompt should appear. Reopen, then click Undo within the toast lifetime. Verify DB: target encounter status === 'ended', last segment `endedAt` set. Skip path: prompt closes, "Session resumed" toast appears.

7. **Commit.** Message: `feat(resume): prompt for prior-encounter reopen with Undo`

## Verification Commands

```bash
npm run build

# Component file exists
test -f src/components/modals/ReopenEncounterPrompt.tsx

# CampaignContext consumes the new helpers
grep -q "encounterRepository.reopenEncounter" src/features/campaign/CampaignContext.tsx
grep -q "flushAll()" src/features/campaign/CampaignContext.tsx
grep -q "ReopenEncounterPrompt" src/features/campaign/CampaignContext.tsx

# Toast messages present
grep -q "'Session resumed'" src/features/campaign/CampaignContext.tsx
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| ToastContext extended with action support | [STRUCTURAL] | `grep -q "action" src/context/ToastContext.tsx && grep -q "label" src/context/ToastContext.tsx \|\| (echo "FAIL: ToastContext not extended with action button" && exit 1)` |
| ReopenEncounterPrompt file exists | [STRUCTURAL] | `test -f src/components/modals/ReopenEncounterPrompt.tsx \|\| (echo "FAIL: ReopenEncounterPrompt missing" && exit 1)` |
| CampaignContext uses reopenEncounter | [STRUCTURAL] | `grep -q "encounterRepository.reopenEncounter" src/features/campaign/CampaignContext.tsx \|\| (echo "FAIL: resume flow not using reopenEncounter" && exit 1)` |
| resumeSession awaits flushAll | [STRUCTURAL] | `grep -B2 -A10 "function resumeSession\|resumeSession =" src/features/campaign/CampaignContext.tsx \| grep -q "flushAll" \|\| (echo "FAIL: resumeSession not flushing" && exit 1)` |
| Prompt is rendered in the provider | [STRUCTURAL] | `grep -q "ReopenEncounterPrompt" src/features/campaign/CampaignContext.tsx \|\| (echo "FAIL: prompt not rendered" && exit 1)` |
| Session resumed toast present | [STRUCTURAL] | `grep -q "Session resumed" src/features/campaign/CampaignContext.tsx \|\| (echo "FAIL: missing Session resumed toast" && exit 1)` |
| npm run build exits zero | [MECHANICAL] | `npm run build 2>&1 \| tail -3 ; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
