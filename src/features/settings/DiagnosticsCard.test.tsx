// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DiagnosticsCard } from './DiagnosticsCard';

const showToast = vi.fn();
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ showToast }) }));

afterEach(cleanup);

describe('DiagnosticsCard', () => {
  it('copies a report and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: async () => ({ usage: 1, quota: 2 }) },
    });
    render(<DiagnosticsCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy diagnostics' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Diagnostics copied', 'success'));
    expect(writeText.mock.calls[0][0]).toContain('App version: ');
  });
});
