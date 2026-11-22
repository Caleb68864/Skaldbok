// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

/**
 * The quick-log bar's save was try/finally with no catch: a failed write was
 * an unhandled rejection and the text stayed in the box with nothing said.
 * Fails on the old bar.
 */

const logToSession = vi.fn();
const showToast = vi.fn();
vi.mock('../session/useSessionLog', () => ({ useSessionLog: () => ({ logToSession }) }));
vi.mock('../campaign/CampaignContext', () => ({ useCampaignContext: () => ({ activeSession: { id: 's1' } }) }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('../../components/shell/ShellDock', () => ({ ShellDock: ({ children }: { children: ReactNode }) => <>{children}</> }));

const { QuickLogBar } = await import('./QuickLogBar');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('QuickLogBar', () => {
  it('says so when the note could not be saved, and keeps the text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    logToSession.mockRejectedValue(new Error('Storage full'));
    render(<QuickLogBar />);
    fireEvent.click(screen.getByText('Log a note…'));
    const input = screen.getByLabelText('Log a session note') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'The bridge fell' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(String(showToast.mock.calls[0][0])).toContain('Storage full');
    expect(input.value).toBe('The bridge fell');
  });
});
