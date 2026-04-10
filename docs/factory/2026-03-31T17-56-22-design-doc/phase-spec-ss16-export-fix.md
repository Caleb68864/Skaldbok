# Phase Spec — SS-16: Export Permission Fix (navigator.share NotAllowedError)
**Sub-Spec:** SPEC-B5-1
**Issue:** #17
**Batch:** 5 — Export Fix
**Dependency:** None — can be implemented independently. Implement after Batches 1–4 are complete.

---

## Intent
Fix `NotAllowedError` thrown by `navigator.share()` during export. The root cause is `navigator.share()` being called in an async gap after a click handler (browser security requires share to be in a synchronous click handler). Implement `navigator.canShare()` + Blob download fallback for reliable PWA export.

---

## File Paths to Modify / Create

| Action | Path |
|--------|------|
| Read & fix | `src/features/export/useExportActions.ts` |

---

## Implementation Steps

1. **Read** `src/features/export/useExportActions.ts` in full.
2. **Trace** the full call chain for both export functions:
   - `exportSessionMarkdown` (produces `.md` download)
   - `exportSessionBundle` (produces `.zip` download)
3. **Identify** where `navigator.share()` is called relative to the originating click handler. Look for any `await` or `.then()` chain that creates an async gap before the `navigator.share()` call — this async gap causes the `NotAllowedError`.
4. **Implement Fix Option B (recommended)** for both export functions:
   ```ts
   // Pattern to apply to both exportSessionMarkdown and exportSessionBundle:
   const blob = new Blob([content], { type: mimeType });
   const canUseShare = navigator.canShare && navigator.canShare({ files: [new File([blob], filename)] });

   if (canUseShare) {
     try {
       await navigator.share({ files: [new File([blob], filename)] });
       return;
     } catch (err) {
       if (!(err instanceof DOMException && err.name === 'NotAllowedError')) throw err;
       // Fall through to Blob download fallback
     }
   }

   // Blob download fallback (no permission required, works reliably in PWA)
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = filename;
   a.click();
   URL.revokeObjectURL(url);
   ```
5. **Apply** this fix to **both** `exportSessionMarkdown` and `exportSessionBundle`.
6. Confirm `URL.revokeObjectURL` is called after the click to avoid memory leaks.
7. Run `tsc --noEmit` to confirm no type errors.

---

## Acceptance Criteria

- [ ] **B5-1-AC1:** `exportSessionMarkdown` produces a downloaded `.md` file without errors.
- [ ] **B5-1-AC2:** `exportSessionBundle` produces a downloaded `.zip` file without errors.
- [ ] **B5-1-AC3:** Export works in Chrome and Edge (primary PWA targets) without permission prompts.
- [ ] **B5-1-AC4:** `navigator.canShare()` is checked before attempting share; Blob download fallback is in place.

---

## Verification Commands

```bash
# TypeScript — must pass with zero errors
npx tsc --noEmit
```

---

## Cross-Cutting Constraints

- No new npm dependencies.
- Cross-platform: `URL.createObjectURL` + `<a download>` works in all modern browsers and PWA contexts.
- No hardcoded colors (not applicable to this spec — purely logic).

---

## Escalation Triggers

Pause and request human input if:
- The `.zip` export uses a third-party library with its own async constraints that make the synchronous Blob pattern impossible.
- `useExportActions.ts` is >500 lines and tracing the call chain is ambiguous.
