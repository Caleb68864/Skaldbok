import { BrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AppStateProvider } from '../context/AppStateContext';
import { ActiveCharacterProvider } from '../context/ActiveCharacterContext';
import { ToastProvider } from '../context/ToastContext';
import { CampaignProvider } from '../features/campaign/CampaignContext';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AppStateProvider>
          <ActiveCharacterProvider>
            <ToastProvider>
              <CampaignProvider>
                {children}
              </CampaignProvider>
            </ToastProvider>
          </ActiveCharacterProvider>
        </AppStateProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
