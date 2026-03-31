---
scenario_id: "DB-08"
title: "Settings Persistence"
tool: "playwright"
sequential: true
type: test-scenario
tags:
  - test-scenario
---

# Scenario DB-08: Settings Persistence

## Description
Verify settings persistence: read default settings, change the theme, verify the change persists across a page reload, and validate the IndexedDB `appSettings` table.

## Preconditions
- App is running locally (e.g. http://localhost:5173)
- Database `skaldbok-db` is accessible
- App is in its default state (or settings can be read as-is)

## Steps
1. Navigate to `http://localhost:5173/settings`
2. Take a snapshot to confirm the Settings screen is loaded
3. Use `browser_evaluate` to read the current default settings from IndexedDB:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const settings = await db.table('appSettings').toArray();
   return settings;
   ```
4. Record the current theme value (or note if no settings record exists yet)
5. Locate the theme toggle or theme selector on the Settings screen
6. Change the theme (e.g. toggle from light to dark, or select a different theme)
7. Use `browser_evaluate` to verify the theme change is saved in IndexedDB:
   ```js
   const db = await new Dexie('skaldbok-db').open();
   const settings = await db.table('appSettings').toArray();
   return settings;
   ```
8. Verify the `appSettings` record reflects the new theme value
9. Reload the page: `browser_navigate` to `http://localhost:5173/settings`
10. Take a snapshot to verify the theme persisted visually after reload
11. Use `browser_evaluate` to confirm the setting is still persisted:
    ```js
    const db = await new Dexie('skaldbok-db').open();
    const settings = await db.table('appSettings').toArray();
    return settings;
    ```
12. Verify the theme value matches what was set in step 6

## Expected Results
- Default settings are readable from `appSettings` table (or table is empty on first load)
- Theme change is immediately saved to IndexedDB
- After page reload, the theme setting persists in both IndexedDB and the UI
- The `appSettings` table uses `id` as primary key

## Execution Tool
playwright -- Use browser_evaluate to interact with Dexie DB directly, browser_navigate to load the app

## Pass / Fail Criteria
- **Pass:** Theme change is saved to `appSettings` table, persists across page reload, and the UI reflects the saved theme after reload
- **Fail:** Theme change is not saved to IndexedDB, does not survive page reload, or UI reverts to default after reload
