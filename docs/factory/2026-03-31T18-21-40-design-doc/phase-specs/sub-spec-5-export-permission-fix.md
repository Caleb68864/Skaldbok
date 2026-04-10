---
type: phase-spec
master_spec: "docs/factory/2026-03-31T18-21-40-design-doc/spec.md"
sub_spec_number: 5
title: "Export Permission Fix"
date: 2026-03-31
dependencies: ["none"]
---

# Sub-Spec 5: Export Permission Fix

Refined from spec.md — Factory Run 2026-03-31T18-21-40-design-doc.

## Scope

Fix the `NotAllowedError` in export functions. The issue is that `navigator.share()` is called after an async gap (await for data fetching), which causes the browser to reject the share call as it's no longer in the synchronous click handler path. The fix is to wrap `navigator.share()` in a try/catch and fall back to `downloadBlob()` on any error. Additionally, ensure the share call is as close to the user gesture as possible by restructuring `useExportActions.ts`.

Key existing code:
- `delivery.ts` (25 lines): `shareFile()` checks `canShare()` then calls `navigator.share()`. No try/catch around the share call.
- `useExportActions.ts` (~160 lines): `exportSessionMarkdown` and `exportSessionBundle` do multiple async data fetches before calling `shareFile()`, creating the async gap that triggers `NotAllowedError`.

## Interface Contracts

### Provides
- Updated `shareFile()` in `delivery.ts` with try/catch fallback to `downloadBlob()`.
- Robust export that works in Chrome and Edge PWA contexts.

### Requires
None — no dependencies.

### Shared State
None.

## Implementation Steps

### Step 1: Add try/catch to shareFile in delivery.ts
- **File:** `src/utils/export/delivery.ts` (modify)
- **Action:** modify
- **Changes:**
  1. Wrap `navigator.share()` in a try/catch block.
  2. On any error (including `NotAllowedError`, `AbortError`), fall back to `downloadBlob()`.
  3. Updated implementation:
     ```typescript
     export async function shareFile(blob: Blob, filename: string): Promise<void> {
       const file = new File([blob], filename);
       if (
         typeof navigator !== 'undefined' &&
         navigator.canShare &&
         navigator.canShare({ files: [file] })
       ) {
         try {
           await navigator.share({ files: [file], title: filename });
         } catch {
           // NotAllowedError (async gap), AbortError (user cancelled), etc.
           downloadBlob(blob, filename);
         }
       } else {
         downloadBlob(blob, filename);
       }
     }
     ```
  4. This is the minimal, safe fix. The try/catch ensures any share failure gracefully falls back to download.

### Step 2: Verify useExportActions patterns
- **File:** `src/features/export/useExportActions.ts` (review, minimal modify if needed)
- **Action:** modify (minimal)
- **Changes:**
  1. Review `exportSessionMarkdown` and `exportSessionBundle` — they already have outer try/catch blocks that call `showToast('Export failed')`.
  2. With the `shareFile` fix in place, the outer try/catch in `useExportActions` is a secondary safety net.
  3. Optionally, add a more specific error message: change `catch (e) { showToast('Export failed') }` to check if `e` is a `NotAllowedError` and show a more helpful message, but this is not strictly required since `shareFile` now handles it internally.
  4. No structural changes needed — the fix in `delivery.ts` is sufficient.

### Step 3: Verify TypeScript compilation
- **Run:** `npx tsc --noEmit`
- **Expected:** Zero errors.

### Step 4: Commit
- **Stage:** `git add src/utils/export/delivery.ts`
- **Message:** `fix: export permission error — try/catch on navigator.share with download fallback`

## Acceptance Criteria

- `[STRUCTURAL]` `shareFile()` in `delivery.ts` wraps `navigator.share()` in try/catch and falls back to `downloadBlob()` on any error. (REQ-026)
- `[BEHAVIORAL]` Clicking "Export Session" or "Export + Notes (ZIP)" on SessionScreen produces a downloaded file without errors in Chrome and Edge. (REQ-026, REQ-027)
- `[MECHANICAL]` `npx tsc --noEmit` passes with no errors. (REQ-028)

## Verification Commands

- **Build:** `npx tsc --noEmit`
- **Tests:** No test framework detected — skip TDD steps, implement directly.
- **Acceptance:**
  - Read `delivery.ts` — verify `navigator.share()` is wrapped in try/catch.
  - Verify the catch block calls `downloadBlob(blob, filename)`.
  - Start dev server, navigate to SessionScreen with an active session, click Export Session — verify file downloads without console errors.

## Patterns to Follow

- `src/utils/export/delivery.ts`: Current file — minimal change, add try/catch.
- `src/features/export/useExportActions.ts`: Existing export flow — verify it works after delivery.ts fix.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/utils/export/delivery.ts` | Modify | Add try/catch around navigator.share with downloadBlob fallback |
