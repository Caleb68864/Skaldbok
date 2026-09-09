import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_THEME, THEME_LIST, THEME_STORAGE_KEY } from './themes';
import type { ThemeName } from './themes';
import './theme.css';

export interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    // Guarded: this runs while the outermost provider renders, and a browser
    // that blocks site data (Safari private mode) throws on the accessor
    // itself. Unguarded, that was a blank page with nothing to catch it.
    let stored: string | null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored && (THEME_LIST as string[]).includes(stored)) {
      return stored as ThemeName;
    }
    return DEFAULT_THEME;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Theme just will not persist across reloads here; the app still works.
    }
  }, [theme]);

  // `useCallback` over a plain function so the memo below can actually hit:
  // a function redefined on every render makes any surrounding memo a no-op.
  // The state setter is stable, so an empty dependency array is exact here.
  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
