import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/AppProviders';
import { App } from './app/App';
import './styles/tailwind.css';
import './styles/fonts.css';

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
