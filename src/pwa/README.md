# PWA Update Prompt

Self-contained, drop-in React component for Vite + `vite-plugin-pwa` apps.
Surfaces service-worker updates as a user-dismissible banner and never
auto-reloads the app.

## Why manual updates

Auto-reloading a PWA mid-session discards whatever the user was doing —
unsaved inputs, open drawers, in-flight flows. This module shows a visible
prompt and lets the user choose when to reload.

## Files

This folder is the entire module. Copy it as-is into another project.

- `UpdatePrompt.tsx` — the drop-in component you mount at app root.
- `UpdateAvailableBanner.tsx` — pure presentation. Swap for a toast/modal.
- `useUpdateAvailable.ts` — the hook. Owns SW registration internally.
- `index.ts` — public API barrel.
- `vite-env.d.ts` — TS references for the `virtual:pwa-register/react` import.

## Installation in a new project

1. **Install dependencies** (versions used here as of writing):
   ```sh
   npm install vite-plugin-pwa
   ```

2. **Configure `vite.config.ts`** — `registerType` MUST be `'prompt'`:
   ```ts
   import { VitePWA } from 'vite-plugin-pwa';

   export default defineConfig({
     plugins: [
       VitePWA({
         registerType: 'prompt', // ← required; 'autoUpdate' breaks the flow
         // ...manifest, workbox, etc.
       }),
     ],
   });
   ```

3. **Copy this folder** to `src/pwa/` (or anywhere). The module has no
   cross-module imports beyond React and `virtual:pwa-register/react`.

4. **Mount once at app root:**
   ```tsx
   import { UpdatePrompt } from './pwa';

   export function App() {
     return (
       <>
         <Routes />
         <UpdatePrompt />
       </>
     );
   }
   ```

5. **Verify the TS reference.** The module ships a local `vite-env.d.ts` with
   `/// <reference types="vite-plugin-pwa/react" />`. If your app's root
   `tsconfig` doesn't pick it up, add `"vite-plugin-pwa/react"` to
   `compilerOptions.types`.

## API

```ts
<UpdatePrompt
  title="Update Available"
  description="A newer version is ready to install."
  primaryLabel="Update Now"
  secondaryLabel="Later"
  checkIntervalMs={60 * 60 * 1000}  // hourly background checks; 0 disables
  onRegistered={(reg) => { /* ... */ }}
  onError={(err) => { /* ... */ }}
  className="..."                    // replace the banner's wrapper styles
/>
```

For more control, skip `<UpdatePrompt />` and use the hook directly:

```tsx
import { useUpdateAvailable } from './pwa';

function MyCustomNotice() {
  const { updateAvailable, applyUpdate, dismiss } = useUpdateAvailable();
  if (!updateAvailable) return null;
  return (/* your own UI, calling applyUpdate / dismiss */);
}
```

## Theme contract

`UpdateAvailableBanner` uses these CSS custom properties / Tailwind tokens
by default. If your target project doesn't define them, either override the
wrapper via `className`, or fork the banner file and swap the classes.

| Token / utility          | Purpose                              |
| ------------------------ | ------------------------------------ |
| `bg-surface`             | Banner background                    |
| `bg-accent` / `text-bg`  | Primary button bg / fg               |
| `text-text`              | Title color                          |
| `text-text-muted`        | Description + secondary button color |
| `border-border`          | Banner border                        |
| `var(--radius-md/sm)`    | Corner radius                        |
| `var(--size-md/sm)`      | Font size                            |
| `var(--shadow-medium)`   | Drop shadow                          |
| `var(--touch-target-min)`, `var(--space-md)` | Bottom offset above bottom-nav shell |
| `texture-card-bevel`     | Optional bevel utility (safely unused if undefined) |
| `font-[family-name:var(--font-ui)]` | Title font family         |

## Lifecycle

1. A new service worker is detected → installed → waiting.
2. `useRegisterSW` flips `needRefresh` to true; the banner renders.
3. User clicks the primary action → `updateServiceWorker(true)` posts
   `SKIP_WAITING` to the waiting SW.
4. Browser fires `controllerchange` when the new SW takes control; the
   plugin reloads the page.
5. If the user dismisses, the flag resets; the next detected update
   re-opens the prompt. The waiting SW stays waiting until applied or all
   tabs close — no broken loops, no lost updates.

## Gotchas

- **Only mount one `<UpdatePrompt />`** (or one caller of
  `useUpdateAvailable`). Multiple callers each register their own SW
  listener — wasteful but not broken.
- **Don't pair with an imperative `registerSW()` call elsewhere.** The
  module's hook handles registration. An extra imperative registration is
  redundant and confuses the update-detection state.
- **HTTPS in dev.** Service workers require HTTPS or `localhost`. Vite's
  `@vitejs/plugin-basic-ssl` covers the LAN case.
