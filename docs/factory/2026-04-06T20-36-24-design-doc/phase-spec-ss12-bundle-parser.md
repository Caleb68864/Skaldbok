# Phase Spec — SS-12: Bundle Parser + Validator

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 2.4 — Feature B: Bundle Parser + Validator
**Depends on:** SS-02 (Zod schemas — bundle.ts, creatureTemplate.ts, encounter.ts) must be completed first.
**Delivery order note:** Step 12 in execution sequence. Required by SS-13 (merge engine) and SS-14 (import preview UI).

---

## Objective

Parse and validate `.skaldmark.json` and legacy `.skaldbok.json` files at the import boundary using `safeParse()`. Return a typed result object with warnings for per-entity failures — never throw. Support version detection and legacy file wrapping.

---

## File to Create

- `src/utils/import/bundleParser.ts` — **create new**

---

## Implementation Steps

### Step 1: Define result types

```typescript
import { BundleEnvelope } from '../../types/bundle';

export interface ValidationWarning {
  entityType: string;
  entityIndex: number;
  path: string;
  message: string;
}

export type ParsedBundleResult =
  | { success: true; bundle: BundleEnvelope; warnings: ValidationWarning[] }
  | { success: false; error: string; partialBundle?: Partial<BundleEnvelope> };
```

### Step 2: Implement `parseBundle`

```typescript
import { bundleEnvelopeSchema, bundleContentsSchema, BundleEnvelope } from '../../types/bundle';
import { creatureTemplateSchema } from '../../types/creatureTemplate';
import { encounterSchema } from '../../types/encounter';
// Import other entity schemas as needed

export function parseBundle(json: string): ParsedBundleResult {
  // 1. Parse raw JSON
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { success: false, error: 'Invalid JSON: file could not be parsed.' };
  }

  if (typeof raw !== 'object' || raw === null) {
    return { success: false, error: 'Invalid format: expected a JSON object.' };
  }

  const obj = raw as Record<string, unknown>;

  // 2. Detect legacy .skaldbok.json (bare CharacterRecord — no version field)
  if (!('version' in obj)) {
    return handleLegacySkaldbok(obj);
  }

  // 3. Version checks
  const version = obj['version'];
  if (typeof version !== 'number') {
    return { success: false, error: 'Invalid bundle: version field is not a number.' };
  }
  if (version > 1) {
    return {
      success: false,
      error: 'Unsupported bundle version. Please upgrade Skaldmark to import this file.',
    };
  }
  if (version < 1) {
    // Apply migration transforms for pre-v1 bundles
    const migrated = migratePreV1Bundle(obj);
    return parseBundle(JSON.stringify(migrated));
  }

  // 4. Validate envelope structure (top-level fields)
  const envelopeResult = bundleEnvelopeSchema.safeParse(obj);

  if (!envelopeResult.success) {
    // Try partial parse to gather what we can
    return {
      success: false,
      error: `Bundle structure invalid: ${envelopeResult.error.issues[0]?.message ?? 'unknown error'}`,
      partialBundle: obj as Partial<BundleEnvelope>,
    };
  }

  const bundle = envelopeResult.data;
  const warnings: ValidationWarning[] = [];

  // 5. Per-entity validation with warnings (not hard failures)
  bundle.contents = validateContentsEntities(bundle.contents, warnings);

  // 6. contentHash verification (non-blocking warning)
  if (bundle.contentHash) {
    // Cannot do async SHA-256 in a sync function — skip hash verification here.
    // Async verification is handled by the caller or in the preview UI.
    // If caller wants to verify: recompute SHA-256 of JSON.stringify(bundle.contents)
    // and compare to bundle.contentHash. Mismatch → add a warning.
  }

  return { success: true, bundle, warnings };
}
```

### Step 3: Implement legacy `.skaldbok.json` handler

```typescript
function handleLegacySkaldbok(obj: Record<string, unknown>): ParsedBundleResult {
  // A .skaldbok.json is a bare CharacterRecord (no version, no envelope)
  // Wrap it in a v1 envelope
  const warnings: ValidationWarning[] = [];

  // Validate the character record
  // (Use characterRecordSchema.safeParse(obj) — import from types)
  const characterResult = characterRecordSchema.safeParse(obj);

  if (!characterResult.success) {
    warnings.push({
      entityType: 'character',
      entityIndex: 0,
      path: characterResult.error.issues[0]?.path.join('.') ?? '',
      message: characterResult.error.issues[0]?.message ?? 'Character validation failed',
    });
  }

  const wrappedBundle: BundleEnvelope = {
    version: 1,
    type: 'character',
    exportedAt: new Date().toISOString(),
    system: 'dragonbane',
    contents: {
      characters: characterResult.success ? [characterResult.data] : [],
    },
  };

  return { success: true, bundle: wrappedBundle, warnings };
}
```

### Step 4: Implement per-entity validation

```typescript
function validateContentsEntities(
  contents: BundleEnvelope['contents'],
  warnings: ValidationWarning[]
): BundleEnvelope['contents'] {
  const validated = { ...contents };

  // Validate creatureTemplates
  if (contents.creatureTemplates) {
    validated.creatureTemplates = contents.creatureTemplates.filter((item, index) => {
      const result = creatureTemplateSchema.safeParse(item);
      if (!result.success) {
        warnings.push({
          entityType: 'creatureTemplates',
          entityIndex: index,
          path: result.error.issues[0]?.path.join('.') ?? '',
          message: result.error.issues[0]?.message ?? 'Validation failed',
        });
        return false; // Skip this entity
      }
      return true;
    });
  }

  // Validate encounters
  if (contents.encounters) {
    validated.encounters = contents.encounters.filter((item, index) => {
      const result = encounterSchema.safeParse(item);
      if (!result.success) {
        warnings.push({
          entityType: 'encounters',
          entityIndex: index,
          path: result.error.issues[0]?.path.join('.') ?? '',
          message: result.error.issues[0]?.message ?? 'Validation failed',
        });
        return false;
      }
      return true;
    });
  }

  // Repeat for other entity arrays (notes, characters, sessions, etc.)
  // Use the appropriate schema for each — import from types/

  return validated;
}
```

### Step 5: Implement pre-v1 migration transforms

```typescript
function migratePreV1Bundle(obj: Record<string, unknown>): Record<string, unknown> {
  // Currently no known pre-v1 format — return as-is with version set to 1
  // If future migration transforms are needed, add them here
  return { ...obj, version: 1 };
}
```

### Step 6: Async contentHash verification (exported separately)

```typescript
/**
 * Verifies contentHash asynchronously. Call from UI/hook after parsing.
 * Returns true if hash matches or no hash present, false if mismatch.
 */
export async function verifyContentHash(bundle: BundleEnvelope): Promise<boolean> {
  if (!bundle.contentHash) return true;
  try {
    const contentsJson = JSON.stringify(bundle.contents);
    const encoded = new TextEncoder().encode(contentsJson);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computed = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return computed === bundle.contentHash;
  } catch {
    return true; // Cannot verify — do not block import
  }
}
```

---

## Verification Commands

```bash
npx tsc --noEmit
```

**Manual verification:**

```typescript
// Valid .skaldmark.json
const valid = '{"version":1,"type":"campaign","exportedAt":"2026-04-06T00:00:00Z","system":"dragonbane","contents":{}}';
const r1 = parseBundle(valid);
assert(r1.success === true);
assert(r1.warnings.length === 0);

// Invalid JSON
const r2 = parseBundle('not json');
assert(r2.success === false);
assert(r2.error.includes('Invalid JSON'));

// version > 1
const r3 = parseBundle('{"version":2,"type":"campaign","system":"dragonbane","contents":{}}');
assert(r3.success === false);
assert(r3.error.includes('upgrade'));

// Legacy .skaldbok.json (bare character)
const legacy = JSON.stringify({ id: 'c1', name: 'Thorin', /* other character fields */ });
const r4 = parseBundle(legacy);
assert(r4.success === true);
assert(r4.bundle.type === 'character');
assert(r4.bundle.contents.characters?.length === 1);

// Per-entity failure (one bad encounter, others fine)
const withBadEncounter = JSON.stringify({
  version: 1, type: 'campaign', system: 'dragonbane', exportedAt: '...',
  contents: {
    encounters: [
      { id: 'e1', /* valid */ },
      { id: 'e2', type: 'INVALID_TYPE' /* invalid */ },
    ]
  }
});
const r5 = parseBundle(withBadEncounter);
assert(r5.success === true);
assert(r5.warnings.length > 0);
assert(r5.bundle.contents.encounters?.length === 1); // bad one skipped
```

---

## Acceptance Criteria

- [ ] Valid `.skaldmark.json` parses successfully with `{ success: true }`
- [ ] Legacy `.skaldbok.json` (bare CharacterRecord — no version field) detected and wrapped as `type: 'character'` bundle
- [ ] Invalid JSON returns `{ success: false, error: 'Invalid JSON...' }`
- [ ] `version > 1` returns `{ success: false }` with upgrade prompt message
- [ ] Per-entity Zod failures produce `warnings[]` with entityType, entityIndex, path; other valid entities still present in result
- [ ] `contentHash` mismatch verification available as separate `verifyContentHash(bundle)` async function
- [ ] No use of `JSON.parse` without try/catch
- [ ] All Zod validation via `safeParse()` (never `.parse()`)
- [ ] `npx tsc --noEmit` passes with no errors

---

## Constraints

- No new npm dependencies
- `parseBundle` must be synchronous (no async — contentHash verification is async but separate)
- Never use `.parse()` — only `.safeParse()`
- Always wrap `JSON.parse` in try/catch
- Legacy detection: a JSON object without a `version` field is treated as `.skaldbok.json`
- `partialBundle` in failure result is best-effort — may be undefined
