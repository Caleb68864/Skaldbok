---
type: phase-spec
sub_spec_id: SS-05
phase: run
depends_on: ['SS-01']
wave: 2
master_spec: "docs/specs/2026-07-27-session-log-note-capture.md"
---

# SS-05 — Link scanner

## Scope

Pure logic, no UI. Build a dictionary from party members, campaign NPC creature templates and note titles; match entry text with whole-word exact matching plus fuzzy matching at edit distance ≤2; report repeated unknown names as missing-record candidates; honour a dismissed list.

## Why fuzzy matching is mandatory

S Pen handwriting conversion produces `0strand` for `Ostrand`. An exact-only scanner silently finds nothing, and a scanner that quietly finds nothing is **worse than no scanner** because it will be trusted. This is the one requirement that would have been skipped if the input were typed.

## Interface Contracts

### scanForLinks
- Direction: SS-05 → SS-06, SS-13
- Owner: SS-05
- Shape:
  ```ts
  scanForLinks(
    entries: Array<{ id: string; text: string }>,
    dictionary: Array<{ id: string; name: string; kind: 'partyMember' | 'creature' | 'note' }>,
    dismissed: string[]
  ): {
    suggestions: Array<{ key: string; entryId: string; matchedText: string; target: { id: string; name: string; kind: string }; confidence: 'exact' | 'fuzzy' }>;
    missingRecords: Array<{ name: string; occurrences: number }>;
  }
  ```
- `key` is a stable `${entryId}:${matchedText}:${target.id}` used for dismissal matching.

## Implementation Steps

### Step 1. Write the failing tests

Create `src/features/notes/linkScanner.test.ts`. Assert:
- Exact whole-word match on a dictionary name produces a suggestion with `confidence: 'exact'`
- `'met 0strand today'` against a dictionary containing `Ostrand` produces `confidence: 'fuzzy'`
- A name appearing as a substring of a longer word (`'Ostrandia'`) produces **no** suggestion
- A suggestion whose `key` is in `dismissed` is not returned
- A capitalised name appearing in 2+ entries with no dictionary entry is returned in `missingRecords`
- A capitalised name appearing once is **not** returned as a missing record
- Names shorter than 3 characters never match (guards against "Al", "Jo")
- An empty dictionary returns no suggestions and does not throw

### Step 2. Run to verify failure

```bash
npm test -- linkScanner
```

### Step 3. Implement

Create `src/features/notes/linkScanner.ts`.

- **Tokenise** entry text on word boundaries, preserving offsets.
- **Exact pass:** case-insensitive whole-word compare against dictionary names (multi-word names compared as phrases).
- **Fuzzy pass:** Levenshtein distance ≤2 for names ≥5 chars, ≤1 for names 3–4 chars. Skip names <3 chars entirely. Implement Levenshtein locally — **do not add an npm dependency** (that is an escalation trigger).
- **Missing records:** capitalised tokens (or capitalised bigrams) not in the dictionary, occurring in ≥2 distinct entries.
- Filter every suggestion whose `key` appears in `dismissed`.

### Step 4. Verify

```bash
npm test -- linkScanner
npm run build
```

### Step 5. Commit

```bash
git add src/features/notes/linkScanner.ts src/features/notes/linkScanner.test.ts
git commit -m "feat(notes): link scanner with fuzzy matching for handwriting errors [factory-managed]"
```

## Verification Commands

```bash
npm test
npm run build
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| scanForLinks exported | [STRUCTURAL] | `grep -q "export function scanForLinks" src/features/notes/linkScanner.ts \|\| (echo "FAIL: scanForLinks not exported" && exit 1)` |
| Fuzzy matching implemented locally | [STRUCTURAL] | `grep -qi "levenshtein\|editDistance" src/features/notes/linkScanner.ts \|\| (echo "FAIL: no edit-distance implementation" && exit 1)` |
| No new npm dependency added | [MECHANICAL] | `git diff --name-only HEAD -- package.json \| grep -q . && (echo "FAIL: package.json modified — new dependency is an escalation trigger" && exit 1) \|\| true` |
| Tests exist and pass | [MECHANICAL] | `test -f src/features/notes/linkScanner.test.ts && npm test > /dev/null 2>&1 \|\| (echo "FAIL: linkScanner tests missing or failing" && exit 1)` |
| Build passes | [MECHANICAL] | `npm run build > /dev/null 2>&1 \|\| (echo "FAIL: npm run build failed" && exit 1)` |
