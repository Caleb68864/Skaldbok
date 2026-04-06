# Phase Spec — SS-14: Import Preview UI

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 2.6 — Feature B: Import Preview UI
**Depends on:** SS-12 (Bundle parser), SS-13 (Merge engine types), SS-02 (Zod schemas) must be completed first.
**Delivery order note:** Step 14 in execution sequence. Required by SS-15 (hook integration — wires this component).

---

## Objective

Build a preview component that displays bundle metadata, entity counts, validation warnings, and conflicts. Allows per-entity-group checkboxes, campaign targeting, and initiates the import via a callback. This is a pure display + selection component — the actual merge is invoked by the parent hook (SS-15).

---

## File to Create

- `src/components/import/ImportPreview.tsx` — **create new**

---

## Implementation Steps

### Step 1: Inspect existing patterns

Before writing, inspect:
- Existing modal/sheet components (shadcn/ui `Dialog` or `Sheet`)
- How campaigns are listed (likely a `useCampaigns` hook or similar)
- Existing form/checkbox components in shadcn/ui
- Toast utility for any in-component feedback
- The `MergeOptions` type from `mergeEngine.ts` (SS-13)
- The `ParsedBundleResult` type from `bundleParser.ts` (SS-12)
- The `BundleContents` key names used in `selectedEntityTypes`

### Step 2: Define component props

```typescript
import { BundleEnvelope } from '../../types/bundle';
import { ValidationWarning } from '../../utils/import/bundleParser';
import { MergeOptions, MergeReport } from '../../utils/import/mergeEngine';

interface ConflictInfo {
  entityType: string;
  entityId: string;
  entityName?: string;
  bundleUpdatedAt: string;
  localUpdatedAt: string;
}

interface ImportPreviewProps {
  bundle: BundleEnvelope;
  warnings: ValidationWarning[];
  conflicts: ConflictInfo[];         // Pre-computed by hook — hook queries local DB to find conflicts
  contentHashMismatch?: boolean;     // From verifyContentHash()
  onImport: (options: MergeOptions) => Promise<void>;
  onCancel: () => void;
  isImporting?: boolean;
}
```

### Step 3: Define entity display labels

```typescript
const ENTITY_LABELS: Record<string, string> = {
  campaign: 'Campaign',
  sessions: 'Sessions',
  parties: 'Parties',
  partyMembers: 'Party Members',
  characters: 'Characters',
  creatureTemplates: 'Creature Templates',
  encounters: 'Encounters',
  notes: 'Notes',
  entityLinks: 'Entity Links',
  attachments: 'Attachments',
};
```

### Step 4: Implement `ImportPreview.tsx`

```tsx
export function ImportPreview({
  bundle,
  warnings,
  conflicts,
  contentHashMismatch,
  onImport,
  onCancel,
  isImporting = false,
}: ImportPreviewProps) {
  // State: which entity types are checked (default: all present types)
  const availableTypes = getAvailableEntityTypes(bundle.contents);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(availableTypes));
  const [targetCampaignId, setTargetCampaignId] = useState<string | undefined>();

  // Campaign selector needed for session/character bundles
  const needsCampaignSelector = bundle.type === 'session' || bundle.type === 'character';

  // Import button enabled only when:
  // - At least one entity type selected
  // - Campaign selected if needed
  const canImport = selectedTypes.size > 0 && (!needsCampaignSelector || !!targetCampaignId);

  // Count total selected items
  const totalSelected = availableTypes
    .filter(type => selectedTypes.has(type))
    .reduce((sum, type) => sum + getEntityCount(bundle.contents, type), 0);

  const handleImport = async () => {
    await onImport({
      targetCampaignId,
      selectedEntityTypes: selectedTypes as Set<keyof typeof bundle.contents>,
    });
  };

  return (
    <div className="..."> {/* match existing modal/sheet structure */}
      {/* contentHash mismatch warning banner */}
      {contentHashMismatch && (
        <div className="... bg-yellow-50 border-yellow-200 ...">
          ⚠️ File integrity check failed. The file may have been modified after export.
          Import is still allowed.
        </div>
      )}

      {/* Bundle metadata */}
      <div>
        <span>{/* Bundle type badge: character / session / campaign */}</span>
        <span>Exported {formatDate(bundle.exportedAt)}</span>
        {bundle.exportedBy && <span>by {bundle.exportedBy}</span>}
      </div>

      {/* Entity counts table */}
      <table>
        <thead><tr><th>Entity Type</th><th>Count</th><th>Include</th></tr></thead>
        <tbody>
          {availableTypes.map(type => (
            <tr key={type}>
              <td>{ENTITY_LABELS[type] ?? type}</td>
              <td>{getEntityCount(bundle.contents, type)}</td>
              <td>
                <input
                  type="checkbox"
                  checked={selectedTypes.has(type)}
                  onChange={e => {
                    const next = new Set(selectedTypes);
                    e.target.checked ? next.add(type) : next.delete(type);
                    setSelectedTypes(next);
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Validation warnings */}
      {warnings.length > 0 && (
        <div>
          <h4>Validation Warnings ({warnings.length})</h4>
          {warnings.map((w, i) => (
            <div key={i} className="text-sm text-yellow-700">
              {w.entityType}[{w.entityIndex}].{w.path}: {w.message}
            </div>
          ))}
        </div>
      )}

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div>
          <h4>Conflicts ({conflicts.length})</h4>
          <p className="text-sm text-muted">
            Newer bundle versions will overwrite local data.
          </p>
          {conflicts.slice(0, 10).map((c, i) => (
            <div key={i} className="text-sm">
              {c.entityType}: {c.entityName ?? c.entityId}
              — Bundle: {formatDate(c.bundleUpdatedAt)},
              Local: {formatDate(c.localUpdatedAt)}
            </div>
          ))}
          {conflicts.length > 10 && (
            <div className="text-sm text-muted">...and {conflicts.length - 10} more</div>
          )}
        </div>
      )}

      {/* Campaign selector (for session/character imports) */}
      {needsCampaignSelector && (
        <div>
          <label>Import into campaign</label>
          <CampaignSelector
            value={targetCampaignId}
            onChange={setTargetCampaignId}
          />
          {!targetCampaignId && (
            <p className="text-sm text-red-500">Select a campaign to enable import.</p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} disabled={isImporting}>Cancel</button>
        <button
          onClick={handleImport}
          disabled={!canImport || isImporting}
        >
          {isImporting ? 'Importing...' : `Import ${totalSelected} items`}
        </button>
      </div>
    </div>
  );
}
```

### Step 5: Implement helpers

```typescript
function getAvailableEntityTypes(contents: BundleContents): string[] {
  return Object.keys(ENTITY_LABELS).filter(key => {
    const val = (contents as any)[key];
    if (!val) return false;
    if (Array.isArray(val)) return val.length > 0;
    return true; // single object (campaign)
  });
}

function getEntityCount(contents: BundleContents, type: string): number {
  const val = (contents as any)[type];
  if (!val) return 0;
  if (Array.isArray(val)) return val.length;
  return 1;
}
```

### Step 6: Implement `CampaignSelector` (inline or as sub-component)

A dropdown populated from the local `useCampaigns()` hook (or equivalent):
```tsx
function CampaignSelector({ value, onChange }: { value?: string; onChange: (id: string) => void }) {
  const { campaigns } = useCampaigns(); // use existing hook
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)}>
      <option value="">Select a campaign...</option>
      {campaigns.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}
```

---

## Verification Commands

```bash
npx tsc --noEmit
npm run build
```

**Manual verification:**
- Open ImportPreview with a campaign bundle — entity counts table shows all entity types including `creatureTemplates` and `encounters`.
- Uncheck one entity type — "Import N items" label updates correctly.
- For a session bundle — campaign selector appears; import button disabled until campaign selected.
- For a campaign bundle — no campaign selector.
- Validation warnings displayed per entity.
- Conflicts listed (max 10 visible, overflow summarized).
- `contentHashMismatch=true` → yellow warning banner visible, import still enabled.
- Import button triggers `onImport` callback with correct `MergeOptions`.

---

## Acceptance Criteria

- [ ] Shows entity count for each type including `creatureTemplates` and `encounters`
- [ ] Validation warnings from parser displayed per entity (type, index, path, message)
- [ ] Conflicts listed with entity name/id and both `updatedAt` values
- [ ] Per-entity-group checkboxes present and functional (checking/unchecking updates "Import N items" label)
- [ ] Campaign selector shown for session and character bundles; hidden for campaign bundles
- [ ] Import button disabled until target campaign selected (for session/character bundles)
- [ ] "Import N items" button label updates based on total count of checked entities
- [ ] `contentHash` mismatch displayed as non-blocking yellow warning banner
- [ ] `npx tsc --noEmit` passes with no errors

---

## Constraints

- No new npm dependencies — use existing shadcn/ui, Tailwind v4
- This component is display + selection only — no direct DB calls (merge triggered via `onImport` callback)
- Use existing `useCampaigns` hook (or equivalent) for campaign list — do not create a new hook
- Match existing modal/sheet pattern for overall container
- Conflicts list must be pre-computed by the parent hook (SS-15) — this component just renders them
