import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/AppProviders';
import { App } from './app/App';
import { ensurePersistentStorage } from './storage/persistence';
import './styles/tailwind.css';
import './styles/fonts.css';

// Ask before rendering, and do not await: the request is advisory and must
// never gate the first paint. Without a persistence grant the browser treats
// this origin's IndexedDB as best-effort and may evict it under storage
// pressure — and IndexedDB is the only place a campaign exists. Idempotent, so
// an already-granted origin never re-prompts. See storage/persistence.ts.
void ensurePersistentStorage();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>
);

// Service-worker registration is owned by the PWA module — mounted via
// <UpdatePrompt /> inside <App />. See src/pwa/README.md.
