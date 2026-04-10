# Phase Spec — SS-15: Export/Import Hook Integration

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 2.7 — Feature B: Export/Import Hook Integration
**Depends on:** ALL prior SS must be completed: SS-09 (collectors), SS-10 (privacy filter), SS-11 (serializer), SS-12 (parser), SS-13 (merge engine), SS-14 (import preview UI).
**Delivery order note:** Step 15 in execution sequence. This is the final wiring step for Feature B.

---

## Objective

Wire export and import flows to UI entry points (character detail, session screen, campaign settings). Extend the existing `useExportActions.ts` with new export functions and create `useImportActions.ts`. Trigger `ImportPreview` for import flows and display `MergeReport` as a toast.

---

## Files to Modify / Create

- `src/features/export/useExportActions.ts` — **extend existing** (add new export functions; do not change existing exports)
- `src/features/import/useImportActions.ts` — **create new** (or extend if it exists)

## Files to Modify (entry point wiring)

Locate and modify the following screens to add export/import buttons:
- Character detail screen — add "Export character" button
- Session screen — add "Export session" button
- Campaign settings screen — add "Export campaign" button and "Import" button (or global import entry point)

---

## Implementation Steps

### Step 1: Inspect existing `useExportActions.ts`

Read the full file to understand:
- Existing export function signatures and patterns
- How errors are handled (try/catch, toast, result object)
- What toast utility is used and its import path — likely `showToast` from `useToast()`, NOT `toast.error`/`toast.success`
- How file slug is generated for exported files
- Whether the hook uses context (campaign ID, session ID) or accepts params

Do not modify any existing exported function — only add new ones.

### Step 2: Extend `useExportActions.ts` — add three new export functions

```typescript
// Add to useExportActions.ts (do not remove or change existing exports)

import { collectCharacterBundle, collectSessionBundle, collectCampaignBundle } from '../../utils/export/collectors';
import { applyPrivacyFilter } from '../../utils/export/privacyFilter';
import { serializeBundle, deliverBundle } from '../../utils/export/bundleSerializer';

export function useExportActions() {
  // ... existing hook body ...

  const exportCharacter = async (characterId: string, includePrivate = false) => {
    try {
      const result = await collectCharacterBundle(characterId);
      if (!result.success) {
        toast.error(`Export failed: ${result.error}`);
        return;
      }
      const filtered = applyPrivacyFilter(result.contents, includePrivate);
      const json = await serializeBundle('character', filtered, { exportedBy: undefined });
      const slug = `character-${characterId}-${Date.now()}`;
      await deliverBundle(slug, json);
      toast.success('Character exported');
    } catch (err) {
      toast.error('Export failed. Please try again.');
      console.error('[useExportActions] exportCharacter error', err);
    }
  };

  const exportSession = async (sessionId: string, includePrivate = false) => {
    try {
      const result = await collectSessionBundle(sessionId);
      if (!result.success) {
        toast.error(`Export failed: ${result.error}`);
        return;
      }
      const filtered = applyPrivacyFilter(result.contents, includePrivate);
      const json = await serializeBundle('session', filtered);
      const slug = `session-${sessionId}-${Date.now()}`;
      await deliverBundle(slug, json);
      toast.success('Session exported');
    } catch (err) {
      toast.error('Export failed. Please try again.');
      console.error('[useExportActions] exportSession error', err);
    }
  };

  const exportCampaign = async (campaignId: string, includePrivate = false) => {
    try {
      const result = await collectCampaignBundle(campaignId);
      if (!result.success) {
        toast.error(`Export failed: ${result.error}`);
        return;
      }
      const filtered = applyPrivacyFilter(result.contents, includePrivate);
      const json = await serializeBundle('campaign', filtered);
      const slug = `campaign-${campaignId}-${Date.now()}`;
      await deliverBundle(slug, json);
      toast.success('Campaign exported');
    } catch (err) {
      toast.error('Export failed. Please try again.');
      console.error('[useExportActions] exportCampaign error', err);
    }
  };

  return {
    // ... existing return values ...
    exportCharacter,
    exportSession,
    exportCampaign,
  };
}
```

### Step 3: Create `useImportActions.ts`

```typescript
// src/features/import/useImportActions.ts
import { useState, useCallback } from 'react';
import { parseBundle, verifyContentHash, ParsedBundleResult, ValidationWarning } from '../../utils/import/bundleParser';
import { mergeBundle, MergeOptions, MergeReport } from '../../utils/import/mergeEngine';
import { BundleEnvelope } from '../../types/bundle';
// Import toast utility — match existing pattern

export function useImportActions() {
  const [isImporting, setIsImporting] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedBundleResult | null>(null);
  const [contentHashMismatch, setContentHashMismatch] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  /**
   * Opens file picker, parses the selected file, shows ImportPreview.
   * Accepts .skaldmark.json and .skaldbok.json
   */
  const startImport = useCallback(async () => {
    const file = await pickFile(['.skaldmark.json', '.skaldbok.json', 'application/json']);
    if (!file) return;

    const json = await file.text();
    const result = parseBundle(json);
    setParsedResult(result);

    if (result.success) {
      // Async hash verification
      const hashOk = await verifyContentHash(result.bundle);
      setContentHashMismatch(!hashOk);
      setShowPreview(true);
    } else {
      toast.error(`Import failed: ${result.error}`);
    }
  }, []);

  /**
   * Computes conflict list by comparing bundle entities to local DB.
   * Called after parsing, before showing preview.
   */
  const computeConflicts = useCallback(async (bundle: BundleEnvelope) => {
    // For each entity type, check if a local entity exists with a different updatedAt
    // Return array of ConflictInfo objects
    // (This is a read-only operation — no mutations)
    const conflicts = [];
    // ... iterate bundle.contents, getById for each entity, compare updatedAt ...
    return conflicts;
  }, []);

  /**
   * Executes the merge with user-selected options. Called by ImportPreview's onImport.
   */
  const executeImport = useCallback(async (options: MergeOptions) => {
    if (!parsedResult || !parsedResult.success) return;

    setIsImporting(true);
    try {
      const report = await mergeBundle(parsedResult.bundle, options);

      if (report.errors.length > 0) {
        toast.error(
          `Import completed with ${report.errors.length} error(s). ` +
          `Imported ${report.inserted} new, updated ${report.updated}, skipped ${report.skipped}.`
        );
      } else {
        toast.success(
          `Imported ${report.inserted} new, updated ${report.updated}, skipped ${report.skipped}.`
        );
      }

      setShowPreview(false);
      setParsedResult(null);
    } catch (err) {
      toast.error('Import failed unexpectedly. Please try again.');
      console.error('[useImportActions] executeImport error', err);
    } finally {
      setIsImporting(false);
    }
  }, [parsedResult]);

  const cancelImport = useCallback(() => {
    setShowPreview(false);
    setParsedResult(null);
  }, []);

  return {
    isImporting,
    parsedResult,
    contentHashMismatch,
    showPreview,
    startImport,
    computeConflicts,
    executeImport,
    cancelImport,
  };
}
```

### Step 4: Implement `pickFile` helper

```typescript
function pickFile(accept: string[]): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept.join(',');
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0] ?? null;
      resolve(file);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
```

### Step 5: Wire export buttons to screens

**Character detail screen:**
```tsx
const { exportCharacter } = useExportActions();
// Add button:
<button onClick={() => exportCharacter(character.id)}>Export character</button>
```

**Session screen:**
```tsx
const { exportSession } = useExportActions();
// Add button:
<button onClick={() => exportSession(session.id)}>Export session</button>
```

**Campaign settings screen:**
```tsx
const { exportCampaign } = useExportActions();
const { startImport, showPreview, parsedResult, contentHashMismatch, executeImport, cancelImport, computeConflicts, isImporting } = useImportActions();
// Add buttons:
<button onClick={() => exportCampaign(campaign.id)}>Export campaign</button>
<button onClick={startImport}>Import</button>
// Render ImportPreview when showPreview is true
{showPreview && parsedResult?.success && (
  <ImportPreview
    bundle={parsedResult.bundle}
    warnings={parsedResult.warnings}
    conflicts={conflicts} // pre-computed via computeConflicts
    contentHashMismatch={contentHashMismatch}
    onImport={executeImport}
    onCancel={cancelImport}
    isImporting={isImporting}
  />
)}
```

### Step 6: Conflicts pre-computation

Call `computeConflicts(parsedResult.bundle)` after parsing and store the result in state. Pass to `ImportPreview` as `conflicts` prop.

---

## Verification Commands

```bash
npx tsc --noEmit
npm run build
```

**Manual end-to-end verification:**
- Character detail → "Export character" → `.skaldmark.json` file downloads/shares.
- Session screen → "Export session" → file includes encounters and creature templates.
- Campaign settings → "Export campaign" → file includes all entity types.
- Campaign settings → "Import" → file picker opens, accepts `.skaldmark.json` and `.skaldbok.json`.
- Select `.skaldmark.json` → `ImportPreview` opens with entity counts, warnings, and conflicts.
- Complete import → toast: "Imported N new, updated M, skipped K".
- Error in merge → toast with error message.

---

## Acceptance Criteria

- [ ] Character export produces `.skaldmark.json` with character + linked notes + attachments
- [ ] Session export includes encounters and creature templates
- [ ] Campaign export includes all entity types
- [ ] Import file picker accepts `.skaldmark.json` and `.skaldbok.json`
- [ ] `ImportPreview` component shown after file selection (before merge executes)
- [ ] `MergeReport` displayed as toast after import: `"Imported {N} new, updated {M}, skipped {K}"`
- [ ] Errors displayed as toast with actionable message
- [ ] No new npm dependencies introduced
- [ ] Existing exports from `useExportActions.ts` are unchanged (no regressions)
- [ ] `npx tsc --noEmit` passes with no errors

---

## Constraints

- No new npm dependencies
- Do not modify or remove any existing exported function from `useExportActions.ts`
- Toast pattern must match existing toast usage in the codebase
- File picker uses DOM `<input type="file">` (no third-party library)
- Import flow: pick file → parse → preview → merge → toast (must follow this sequence)
- `executeImport` must never throw — errors handled internally with toast
