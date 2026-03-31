---
scenario_id: "EC-09"
title: "Offline / PWA Functionality"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EC-09: Offline / PWA Functionality

## Description
Verifies that the app registers a service worker via VitePWA, loads from cache when offline, and that IndexedDB data persists across simulated offline/online transitions.

## Preconditions
- App is running at localhost (production build recommended for service worker testing)
- Browser supports service workers

## Steps
1. Navigate to the app root (`/`).
2. Wait for the app to fully load.
3. Use `browser_evaluate` to check service worker registration:
   ```js
   const registrations = await navigator.serviceWorker.getRegistrations();
   return JSON.stringify(registrations.map(r => ({
     scope: r.scope,
     active: !!r.active,
     waiting: !!r.waiting,
     installing: !!r.installing,
   })));
   ```
4. If running a dev build, service worker may not be registered -- note this as expected and check for VitePWA virtual module:
   ```js
   // Check if the PWA plugin is configured (dev mode check)
   return typeof __PWA_SW_REGISTERED__ !== 'undefined' || document.querySelector('link[rel="manifest"]') !== null;
   ```
5. Create test data that should persist offline:
   ```js
   const { db } = await import('/src/storage/db/client');
   const campaigns = await db.campaigns.toArray();
   if (campaigns.length > 0) {
     await db.notes.put({
       id: 'offline-test-note',
       campaignId: campaigns[0].id,
       title: 'Offline Persistence Test',
       body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'This should survive offline' }] }] },
       type: 'generic',
       status: 'active',
       pinned: false,
       tags: ['offline-test'],
       schemaVersion: 1,
       createdAt: new Date().toISOString(),
       updatedAt: new Date().toISOString(),
     });
   }
   return 'data-created';
   ```
6. Use `browser_evaluate` to simulate offline mode:
   ```js
   // Note: true offline simulation requires Playwright's network interception
   // This checks the offline detection capability
   return navigator.onLine;
   ```
7. If the Playwright instance supports network emulation, set the browser to offline mode.
8. Attempt to navigate to `/notes`.
9. Take a snapshot.
10. If service worker is active (production build): verify the app loads from cache and shows the notes screen.
11. If dev build: verify IndexedDB data is still accessible:
    ```js
    const { db } = await import('/src/storage/db/client');
    const note = await db.notes.get('offline-test-note');
    return note?.title;
    ```
12. Verify the title is "Offline Persistence Test" (IndexedDB persists regardless of network state).
13. Re-enable network (if it was disabled).
14. Navigate to `/notes` and verify the app works normally again.
15. Clean up test data.

## Expected Results
- Service worker is registered in production builds (VitePWA with workbox config).
- IndexedDB data persists across network state changes.
- In production builds, the app shell loads from service worker cache when offline.
- App recovers gracefully when network is restored.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Service worker registered (prod) or PWA config present (dev); IndexedDB data persists offline; app recovers online.
- **Fail:** Service worker missing in production build, data lost offline, or app fails to recover.
