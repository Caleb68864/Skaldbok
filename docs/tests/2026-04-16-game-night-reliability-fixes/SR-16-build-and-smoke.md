---
scenario_id: "SR-16"
title: "Build + existing session smoke still pass end-to-end"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
  - build
sequential: false
---

# Scenario SR-16: Build + Existing Session Smoke Still Pass

## Description

Verifies R16. The production build must remain green after all 11 sub-specs, and the pre-existing Playwright session smoke at `output/playwright/session_smoke.cjs` must still return `SESSION_SMOKE_PASS`. The smoke is the baseline "did we regress anything obvious" check.

## Preconditions

- Repo at `main` HEAD.
- Preview server reachable at `http://127.0.0.1:4177` (the smoke script's expected URL — launched by the developer via `build-and-run.bat` or manually via `npm run preview`).
- `npx --yes --package playwright` works (first run may download the Chromium binary).

## Steps

1. From the repo root, run the production build:
   ```bash
   npm run build 2>&1 | tail -20
   ```

2. Verify the build exited 0 (no TypeScript errors, no Vite errors):
   ```bash
   echo "Exit: $?"
   ```

3. Confirm the dist directory was produced:
   ```bash
   test -f dist/index.html || { echo "FAIL: dist/index.html not produced"; exit 1; }
   ```

4. Run the existing Playwright session smoke:
   ```bash
   npx --yes --package playwright node output/playwright/session_smoke.cjs 2>&1 | tail -30
   ```

5. Confirm the smoke returned success:
   ```bash
   npx --yes --package playwright node output/playwright/session_smoke.cjs 2>&1 | tail -5 | grep -q "SESSION_SMOKE_PASS" \
     && echo "SR-16 PASS" \
     || { echo "FAIL: session smoke did not report SESSION_SMOKE_PASS"; exit 1; }
   ```

## Expected Results

- `npm run build` exits 0.
- `dist/index.html` exists.
- The Playwright smoke output ends with `SESSION_SMOKE_PASS`.
- Final line printed: `SR-16 PASS`.

## Execution Tool

bash — runs build and the existing smoke script. **Requires a live preview server** at `http://127.0.0.1:4177`; bring one up via `build-and-run.bat` or `npm run preview` before running this scenario.

## Pass / Fail Criteria

- **Pass:** Build exits 0 AND smoke output contains `SESSION_SMOKE_PASS`.
- **Fail:** Build fails, or smoke output does not contain `SESSION_SMOKE_PASS`, or server is unreachable.
