# Phase Spec — SS-09: Bundle Size Constraint

**Run:** 2026-04-03T22-16-42-design-doc
**Sub-Spec:** SS-09
**Score:** 88 | Priority: Must | Risk: Medium
**Dependency:** ⚠️ DEPENDS ON SS-01 (Foundation Setup) — baseline measurement is taken immediately after SS-01 completes. Final measurement taken after SS-05 (Polish Layer) completes. Monitoring runs throughout all phases.

---

## Intent

The net bundle size increase from adding Tailwind, Lucide, and Radix packages must remain under **50KB gzipped** compared to the pre-overhaul baseline. This constraint protects PWA offline performance and load time.

---

## Expected Size Profile

| Package | Estimated Gzipped |
|---------|-------------------|
| Tailwind CSS output | ~10–30KB |
| Lucide (per icon, tree-shaken) | ~1KB each |
| Radix primitives (adopted only) | ~15–25KB total |
| CVA + clsx + tailwind-merge | ~5KB |
| **Total estimate** | **~35–60KB** |

> Note: Tailwind replaces previous CSS — the delta is the **net difference** (new CSS size − old CSS size), not the total Tailwind output size.

---

## File Paths to Create / Modify

| Action | Path |
|--------|------|
| CREATE | `docs/factory/2026-04-03T22-16-42-design-doc/bundle-baseline.txt` — record pre-overhaul sizes |
| CREATE | `docs/factory/2026-04-03T22-16-42-design-doc/bundle-after-ss01.txt` — record post-SS-01 sizes |
| CREATE | `docs/factory/2026-04-03T22-16-42-design-doc/bundle-final.txt` — record final sizes after SS-05 |
| MODIFY | `tailwind.config.ts` — add safelist entries or purge config if needed to minimize output |
| MODIFY | `package.json` — only permitted Radix packages (no extras) |

---

## Implementation Steps

### Step 1: Establish Pre-Overhaul Baseline (Before SS-01)

Before any changes, capture the baseline build output:
```bash
vite build
# Note: dist/assets/*.js gzipped sizes
# Note: dist/assets/*.css gzipped sizes
# Record total gzipped JS + CSS in bundle-baseline.txt
```

> If SS-01 has already started, use `git stash` or a separate clean branch to get a baseline, or use the last clean commit's build artifacts if available.

### Step 2: Measure After SS-01 (Post-Foundation)

After SS-01 completes and the build passes:
```bash
vite build
# Capture gzipped sizes of all assets in dist/
# Record in bundle-after-ss01.txt
# Calculate delta: (new total) - (baseline total)
```

If the SS-01 delta alone exceeds 40KB gzipped, **escalate immediately** — this leaves too little headroom for remaining phases.

### Step 3: Monitor Per-Phase

After each phase (SS-02 through SS-05), run `vite build` and note the output sizes. Track the cumulative delta.

### Step 4: Enforce Tree-Shaking for Lucide

Verify Lucide imports throughout the codebase use named imports only:
```bash
grep -rn "from 'lucide-react'" src/
```
Every match must be a named import like `import { ChevronDown } from 'lucide-react'`. Zero wildcard imports.

### Step 5: Enforce Radix Package Allowlist

Only these Radix packages are permitted in `package.json`:
- `@radix-ui/react-tooltip`
- `@radix-ui/react-dialog`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-tabs`
- `@radix-ui/react-toast`
- `@radix-ui/react-collapsible` (for SectionPanel)
- `@radix-ui/react-sheet` does not exist; shadcn Sheet uses `@radix-ui/react-dialog` internally — check actual shadcn Sheet Radix dep

Verify:
```bash
grep "@radix-ui" package.json
```
No unlisted Radix packages may be present.

### Step 6: Final Measurement After SS-05

After SS-05 (Polish Layer) completes:
```bash
vite build
# Capture gzipped sizes
# Record in bundle-final.txt
# Calculate final delta: (final total) - (baseline total)
```

Final delta must be ≤ 50KB gzipped.

### Step 7: If Delta Exceeds 50KB

If the delta exceeds 50KB:
1. First mitigation: verify Tailwind purge is working (no unused classes generated).
2. Second mitigation: check for any accidental full-library imports.
3. Third mitigation: defer SS-05 grain texture if it contributes a PNG asset.
4. If still over limit: **escalate to human** before proceeding.

---

## Acceptance Criteria

| ID | Criterion | Verification Command / Method |
|----|-----------|-------------------------------|
| 9.1 | Bundle size delta after Phase 1 is measured and recorded | `vite build` output captured; gzipped size noted in `bundle-after-ss01.txt` |
| 9.2 | Bundle size delta after Phase 5 ≤ 50KB gzipped vs pre-overhaul baseline | Compare `bundle-final.txt` vs `bundle-baseline.txt`: delta ≤ 50KB |
| 9.3 | No full Lucide library imported (tree-shaking enforced) | `grep -rn "from 'lucide-react'" src/` shows named imports only, not `* as` |
| 9.4 | Only adopted shadcn Radix packages in bundle | `grep "@radix-ui" package.json` lists only permitted packages |

---

## Verification Commands

```bash
# Production build and size inspection
vite build && ls -lh dist/assets/

# Gzipped size calculation (cross-platform alternative: use vite's own output)
# On Unix: gzip -c dist/assets/*.js | wc -c

# Check Lucide tree-shaking
grep -rn "from 'lucide-react'" src/
grep -rn "import \* as" src/ | grep lucide

# Check Radix package allowlist
grep "@radix-ui" package.json

# TypeScript check
tsc -b
```

---

## Notes

- PWA offline must remain unchanged — do NOT add any new runtime network dependencies.
- The 50KB delta is net of removed CSS (old inline styles / CSS modules replaced by Tailwind). The Tailwind output is much smaller than the equivalent hand-rolled CSS in many cases.
- Record all measurements in the `docs/factory/2026-04-03T22-16-42-design-doc/` directory for traceability.
