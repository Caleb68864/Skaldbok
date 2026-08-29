import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/AppProviders';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { ensurePersistentStorage } from './storage/persistence';
import './styles/tailwind.css';
import './styles/fonts.css';

// Ask before rendering, and do not await: the request is advisory and must
// never gate the first paint. Without a persistence grant the browser treats
// this origin's IndexedDB as best-effort and may evict it under storage
// pressure — and IndexedDB is the only place a campaign exists. Idempotent, so
// an already-granted origin never re-prompts. See storage/persistence.ts.
void ensurePersistentStorage();

// Screens are code-split (see routes/index.tsx). After a deploy the hashed
// chunk a still-open page asks for may no longer exist on the server or in the
// old service-worker cache; Vite reports that as `vite:preloadError`. Reloading
// once picks up the new index and its matching chunks instead of stranding the
// user on the error boundary. The session flag stops a reload loop when the
// chunk is genuinely unreachable (offline with a cold cache).
window.addEventListener('vite:preloadError', (event) => {
  const key = 'skaldbok:chunk-reload';
  let alreadyReloaded = false;
  try {
    alreadyReloaded = sessionStorage.getItem(key) === '1';
    if (!alreadyReloaded) sessionStorage.setItem(key, '1');
  } catch {
    // Storage unavailable (private mode) — a single reload is still the best bet.
  }
  if (alreadyReloaded) return;
  event.preventDefault();
  window.location.reload();
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

// Two boundaries: the one inside <App /> resets per route; this outer one
// exists because the providers themselves can throw while rendering (a
// storage accessor that the browser blocks, a context initialiser that
// reads a corrupt record). Without it that was a blank page.
createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>
);

// Service-worker registration is owned by the PWA module — mounted via
// <UpdatePrompt /> inside <App />. See src/pwa/README.md.
