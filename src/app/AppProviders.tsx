import { BrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AppStateProvider } from '../context/AppStateContext';
import { ActiveCharacterProvider } from '../context/ActiveCharacterContext';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AppStateProvider>
          <ActiveCharacterProvider>
            {children}
          </ActiveCharacterProvider>
        </AppStateProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
