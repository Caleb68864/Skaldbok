import { ConfirmProvider } from '../components/primitives/ConfirmDialog';
import { BrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AppStateProvider } from '../context/AppStateContext';
import { ActiveCharacterProvider } from '../context/ActiveCharacterContext';
import { ToastProvider } from '../context/ToastContext';
import { CampaignProvider } from '../features/campaign/CampaignContext';

export interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AppStateProvider>
          <ActiveCharacterProvider>
            <ToastProvider>
<ConfirmProvider>
              <CampaignProvider>
                {children}
              </CampaignProvider>
            </ConfirmProvider>
</ToastProvider>
          </ActiveCharacterProvider>
        </AppStateProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
