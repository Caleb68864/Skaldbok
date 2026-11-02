// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppStateProvider } from './AppStateContext';

const systems = vi.hoisted(() => ({ getById: vi.fn().mockResolvedValue(undefined), save: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../storage/repositories/systemRepository', () => systems);
vi.mock('./ThemeContext', () => ({ useTheme: () => ({ setTheme: () => {} }) }));
vi.mock('../theme/ThemeProvider', () => ({ useTheme: () => ({ setTheme: () => {} }) }));
vi.mock('../features/settings/useAppSettings', () => ({
  useAppSettings: () => ({ settings: { theme: 'dark', mode: 'edit' }, updateSettings: vi.fn(), isLoading: false, error: null, storageError: null }),
}));

afterEach(cleanup);

describe('AppStateProvider startup (roadmap I8)', () => {
  it('leaves system seeding to useSystemDefinition and its version gate', async () => {
    render(<AppStateProvider><p>ready</p></AppStateProvider>);
    expect(await screen.findByText('ready')).toBeTruthy();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(systems.getById).not.toHaveBeenCalled();
    expect(systems.save).not.toHaveBeenCalled();
  });
});
