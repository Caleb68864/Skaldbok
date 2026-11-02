// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConfirmProvider, useConfirm, type ConfirmApi } from './ConfirmDialog';

let api: ConfirmApi;
function Capture() {
  api = useConfirm();
  return null;
}
const mount = () => render(<ConfirmProvider><Capture /></ConfirmProvider>);

afterEach(cleanup);

describe('useConfirm', () => {
  it('resolves true on confirm and closes', async () => {
    mount();
    let answer: Promise<boolean> = Promise.resolve(false);
    act(() => { answer = api.confirm('Delete this entry?'); });
    expect(screen.getByText('Delete this entry?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await expect(answer).resolves.toBe(true);
    expect(screen.queryByText('Delete this entry?')).toBeNull();
  });

  it('resolves false on cancel', async () => {
    mount();
    let answer: Promise<boolean> = Promise.resolve(true);
    act(() => { answer = api.confirm('Delete?'); });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await expect(answer).resolves.toBe(false);
  });

  it('asks for text and returns what was typed', async () => {
    mount();
    let answer: Promise<string | null> = Promise.resolve(null);
    act(() => { answer = api.promptText('URL'); });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'https://example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await expect(answer).resolves.toBe('https://example.com');
  });

  it('returns null when the prompt is cancelled', async () => {
    mount();
    let answer: Promise<string | null> = Promise.resolve('x');
    act(() => { answer = api.promptText('URL'); });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await expect(answer).resolves.toBeNull();
  });

  it('settles an open request when a second one arrives, so no caller hangs', async () => {
    mount();
    let first: Promise<boolean> = Promise.resolve(true);
    act(() => { first = api.confirm('First'); });
    act(() => { void api.confirm('Second'); });
    await expect(first).resolves.toBe(false);
    expect(screen.getByText('Second')).toBeTruthy();
  });
});
