---
scenario_id: "EC-11"
title: "PWA Install Flow"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EC-11: PWA Install Flow

## Description
Verifies that the PWA manifest is valid and the app meets installability criteria: manifest.json has required fields (name, icons, display, start_url), and the Settings screen provides an install prompt or related PWA information.

## Preconditions
- App is running at localhost

## Steps
1. Navigate to the app root (`/`).
2. Use `browser_evaluate` to check for the web app manifest link:
   ```js
   const manifestLink = document.querySelector('link[rel="manifest"]');
   return manifestLink ? manifestLink.href : 'no manifest link found';
   ```
3. If a manifest link is found, fetch and validate its contents:
   ```js
   const manifestLink = document.querySelector('link[rel="manifest"]');
   if (!manifestLink) return 'no manifest';
   const response = await fetch(manifestLink.href);
   const manifest = await response.json();
   return JSON.stringify({
     name: manifest.name,
     short_name: manifest.short_name,
     description: manifest.description,
     display: manifest.display,
     start_url: manifest.start_url,
     theme_color: manifest.theme_color,
     background_color: manifest.background_color,
     iconCount: manifest.icons?.length,
     icons: manifest.icons?.map(i => ({ src: i.src, sizes: i.sizes, type: i.type })),
   });
   ```
4. Verify manifest contains:
   - `name`: "Skaldbok: The Adventurer's Ledger"
   - `short_name`: "Skaldbok"
   - `display`: "standalone"
   - `start_url`: "/"
   - `theme_color`: "#1a1a2e"
   - `background_color`: "#1a1a2e"
   - At least 2 icons (192x192 and 512x512)
5. Verify icon files are accessible:
   ```js
   const results = [];
   for (const path of ['icons/icon-192.png', 'icons/icon-512.png']) {
     const resp = await fetch('/' + path);
     results.push({ path, status: resp.status, ok: resp.ok });
   }
   return JSON.stringify(results);
   ```
6. Verify both icon files return 200 OK.
7. Navigate to `/settings`.
8. Take a snapshot of the Settings screen.
9. Look for any PWA-related UI elements: install button, "Add to Home Screen" prompt, app version info, or update notification (VitePWA registerType: 'prompt' means an update prompt should appear when available).
10. Use `browser_evaluate` to check PWA installability signals:
    ```js
    // Check if beforeinstallprompt event was captured
    return {
      isStandalone: window.matchMedia('(display-mode: standalone)').matches,
      hasServiceWorker: 'serviceWorker' in navigator,
    };
    ```
11. Verify `hasServiceWorker` is true (browser capability).
12. Check `browser_console_messages` for any manifest-related warnings.

## Expected Results
- Web app manifest is present and linked in the HTML.
- Manifest contains all required PWA fields with correct values.
- Icon files (192x192, 512x512) are accessible.
- Settings screen may include PWA install or update UI.
- Browser reports service worker capability.
- No manifest validation warnings in console.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Manifest valid with all required fields; icons accessible; PWA criteria met; no manifest warnings.
- **Fail:** Manifest missing or invalid, icons 404, required fields absent, or installability criteria not met.
