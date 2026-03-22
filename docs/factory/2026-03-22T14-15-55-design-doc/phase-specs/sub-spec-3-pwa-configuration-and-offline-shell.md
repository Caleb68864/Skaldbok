---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 3
title: "PWA Configuration and Offline Shell"
date: 2026-03-22
dependencies: ["1"]
---

# Sub-Spec 3: PWA Configuration and Offline Shell

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Configure vite-plugin-pwa in the Vite config to generate a web app manifest and service worker. Set up app-shell precaching so the app loads offline after first visit. Implement an update-available notification flow that detects new service worker versions and prompts the user to refresh. Create placeholder PWA icons.

## Interface Contracts

### Provides
- `vite.config.ts` (modified): vite-plugin-pwa configuration with manifest, workbox settings, and app-shell precaching
- `src/pwa/registerPwa.ts`: Exports `registerPwa()` function that registers the service worker and handles update detection
- `public/icons/icon-192.png`, `public/icons/icon-512.png`: Placeholder PWA icons
- `public/favicon.svg`: App favicon

### Requires
- From sub-spec 1: Working Vite project with `vite.config.ts` and `src/main.tsx`

### Shared State
None.

## Implementation Steps

### Step 1: Create placeholder PWA icons
- **File:** `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/favicon.svg`
- **Action:** create
- **Changes:** Create simple placeholder icons. For PNG icons, use a solid-color square with text or generate minimal valid PNGs. For favicon, create a simple SVG.

### Step 2: Configure vite-plugin-pwa
- **File:** `vite.config.ts`
- **Action:** modify
- **Changes:** Add VitePWA plugin configuration:
  ```ts
  import { VitePWA } from 'vite-plugin-pwa';
  // In plugins array:
  VitePWA({
    registerType: 'prompt',
    includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
    manifest: {
      name: 'Skaldbok: The Adventurer\'s Ledger',
      short_name: 'Skaldbok',
      description: 'Dragonbane character sheet PWA',
      theme_color: '#1a1a2e',
      background_color: '#1a1a2e',
      display: 'standalone',
      start_url: '/',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      runtimeCaching: []
    }
  })
  ```

### Step 3: Create registerPwa utility
- **File:** `src/pwa/registerPwa.ts`
- **Action:** create
- **Changes:** Export a `registerPwa()` function that:
  1. Imports `registerSW` from `virtual:pwa-register`
  2. Calls `registerSW` with `onNeedRefresh` callback that sets a flag or dispatches an event for the UI to show an update prompt
  3. Provides an `updateServiceWorker` callback that the UI can call to apply the update
  4. Handles `onOfflineReady` to optionally notify the user

### Step 4: Wire registerPwa into main.tsx
- **File:** `src/main.tsx`
- **Action:** modify
- **Changes:** Import and call `registerPwa()` after React root render.

### Step 5: Verify build produces manifest
- **Run:** `npm run build && ls dist/manifest.webmanifest`
- **Expected:** Build succeeds and `manifest.webmanifest` exists in dist/

### Step 6: Commit
- **Stage:** `git add vite.config.ts src/pwa/ src/main.tsx public/icons/ public/favicon.svg`
- **Message:** `feat: pwa configuration and offline shell`

## Acceptance Criteria

- `[MECHANICAL]` `npm run build` produces a dist/ with a manifest.webmanifest file (REQ-008)
- `[STRUCTURAL]` manifest.webmanifest contains name, icons, display, start_url, and theme_color fields (REQ-008)
- `[BEHAVIORAL]` After building and serving dist/, the app loads when the network is disconnected (REQ-009)
- `[STRUCTURAL]` registerPwa.ts contains logic for detecting service worker updates and prompting the user (REQ-010)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework configured -- verify manually.
- **Acceptance:**
  - Verify manifest: `npm run build && cat dist/manifest.webmanifest` -- should contain name, icons, display, start_url, theme_color
  - Verify offline: Build, serve with `npx serve dist`, load in browser, disconnect network, reload -- should still work
  - Verify registerPwa: Read `src/pwa/registerPwa.ts` -- should contain `onNeedRefresh` callback logic

## Patterns to Follow

- Use `vite-plugin-pwa` with `registerType: 'prompt'` to avoid silent updates that could confuse users.
- Keep service worker configuration minimal -- only precache the app shell, no runtime caching of external resources.
- The update prompt UI will be added in a later sub-spec or during polish; for now just wire the detection logic.

## Files

| File | Action | Purpose |
|------|--------|---------|
| vite.config.ts | Modify | Add vite-plugin-pwa configuration |
| src/pwa/registerPwa.ts | Create | Service worker registration and update detection |
| src/main.tsx | Modify | Call registerPwa on startup |
| public/icons/icon-192.png | Create | PWA icon 192x192 |
| public/icons/icon-512.png | Create | PWA icon 512x512 |
| public/favicon.svg | Create | Browser favicon |
