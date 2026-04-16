---
scenario_id: "SR-02"
title: "useAutosave registers with bus + flushes pending character save"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - hook
sequential: false
---

# Scenario SR-02: useAutosave Registers with Flush Bus

## Description

Verifies R2. The `useAutosave` hook must register a flush callback on mount (empty-dep effect, stable) and that callback must persist `pendingRef.current` when `flushAll()` fires. This is the mechanism that makes `endSession`, `clearCharacter`, and `deleteCharacter` data-safe.

## Preconditions

- Preview server up at `https://localhost:4173` (per `forge-project.json`).
- Playwright browser (Chromium) available.
- Service worker registration blocked so the fresh build is loaded each run.
- A character exists in the app. If none, seed via `evaluate` on the `skaldbok-db` IndexedDB.

## Steps

1. `browser.navigate_page("https://localhost:4173/character/profile")`.
2. Seed a character and select it active if not already:
   ```js
   await page.evaluate(async () => {
     const db = await new Promise((resolve, reject) => {
       const req = indexedDB.open('skaldbok-db');
       req.onsuccess = () => resolve(req.result);
       req.onerror = () => reject(req.error);
     });
     // assumes a character exists from prior test seed; otherwise creates one via characterRepository at this URL
   });
   ```
3. Edit a character field via the Profile screen (e.g., name), keystroke it rapidly — do NOT wait 1s.
4. Without waiting for the autosave debounce to elapse, run the following directly in the page:
   ```js
   await page.evaluate(async () => {
     // The flush bus is an ES module — import it via dynamic import on the module URL exposed by Vite.
     const mod = await import('/src/features/persistence/autosaveFlush.ts');
     const results = await mod.flushAll();
     return results;
   });
   ```
5. Reload the page (`browser.navigate_page("...")`).
6. Observe whether the character field reflects the last edit.

## Expected Results

- Step 4 returns an array (not empty) — at least the `useAutosave` flush is registered.
- After reload, the character field shows the last-typed value, NOT the pre-edit value.
- No console errors from `autosaveFlush` or `useAutosave`.

## Execution Tool

playwright — via the session_smoke.cjs-style runner or Playwright CLI. Adapt the script to run against the live server.

## Pass / Fail Criteria

- **Pass:** Post-reload field shows the latest edit, confirming the bus flushed the pending save before reload-simulated unmount.
- **Fail:** Post-reload field shows the pre-edit value (data lost), or `flushAll()` returns empty (hook not registered), or any console error surfaces from the flush bus.
