// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { BillsPanel } from './BillsPanel';
import { AccountsPanel } from './AccountsPanel';
import type { AccountSummary } from '../../utils/ledgerAccounts';
import type { RecurringBill } from '../../types/recurringBill';

/**
 * The ledger's account and recurring-charge forms `void`ed their write and
 * closed straight away. A write that failed threw away everything typed,
 * said nothing, and left an unhandled rejection. Suspend, resume and remove
 * were the same. The failure cases fail on the old panels.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const money = (n: number) => `${n} Cr`;

function bills(onAdd = vi.fn(), onToggle = vi.fn(), list: RecurringBill[] = [], onSetCampaignDate = vi.fn()) {
  render(
    <BillsPanel
      bills={list}
      accounts={[]}
      campaignDate="001-1105"
      formatMoney={money}
      onSetCampaignDate={onSetCampaignDate}
      onAdd={onAdd}
      onToggle={onToggle}
      onRemove={vi.fn()}
    />,
  );
}

const emptySummary = {
  balances: [], primary: null, netWorth: 0, totalAssets: 0, totalOwed: 0, totalAtRisk: 0,
} as unknown as AccountSummary;

describe('BillsPanel', () => {
  it('keeps the new charge form, with what was typed, when the write fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onAdd = vi.fn().mockRejectedValue(new Error('Storage full'));
    bills(onAdd);
    fireEvent.click(screen.getByRole('button', { name: /new recurring charge/i }));
    fireEvent.change(screen.getByLabelText('Charge description'), { target: { value: 'Mortgage' } });
    fireEvent.change(screen.getByLabelText('Charge amount'), { target: { value: '2000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Storage full');
    expect((screen.getByLabelText('Charge description') as HTMLInputElement).value).toBe('Mortgage');
  });

  it('closes the form once the write lands', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    bills(onAdd);
    fireEvent.click(screen.getByRole('button', { name: /new recurring charge/i }));
    fireEvent.change(screen.getByLabelText('Charge description'), { target: { value: 'Mortgage' } });
    fireEvent.change(screen.getByLabelText('Charge amount'), { target: { value: '2000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(screen.queryByLabelText('Charge description')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says so when suspending a charge fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onToggle = vi.fn().mockRejectedValue(new Error('write failed'));
    bills(vi.fn(), onToggle, [{
      id: 'b1', campaignId: 'c', name: 'Berth', amount: -100, everyDays: 30, startDate: '001-1105',
      active: true, schemaVersion: 1, createdAt: 'x', updatedAt: 'x',
    } as RecurringBill]);
    fireEvent.click(screen.getByRole('button', { name: 'Suspend Berth' }));

    expect((await screen.findByRole('alert')).textContent).toContain('write failed');
  });
});

describe('AccountsPanel', () => {
  it('keeps the new account form when the write fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onAdd = vi.fn().mockRejectedValue(new Error('Storage full'));
    render(
      <AccountsPanel summary={emptySummary} formatMoney={money} onAdd={onAdd}
        onRemove={vi.fn()} openings={{}} onEdit={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'New account' }));
    fireEvent.change(screen.getByLabelText('Account name'), { target: { value: 'Ship Fund' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Storage full');
    expect((screen.getByLabelText('Account name') as HTMLInputElement).value).toBe('Ship Fund');
  });
});

/**
 * The campaign date wrote and reloaded the campaign on every keystroke, and
 * showed only what was stored, so the field lagged the keyboard. Fails on the
 * old panel: the typed value never appears (the stored one does not change
 * here) and the write fires per keystroke.
 */
describe('BillsPanel campaign date', () => {
  it('shows what is typed and saves it once, on blur', async () => {
    const onSetCampaignDate = vi.fn().mockResolvedValue(undefined);
    bills(vi.fn(), vi.fn(), [], onSetCampaignDate);
    const input = screen.getByLabelText('Campaign date') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '001-110' } });
    fireEvent.change(input, { target: { value: '001-1106' } });
    expect(input.value).toBe('001-1106');
    expect(onSetCampaignDate).not.toHaveBeenCalled();

    fireEvent.blur(input);
    await waitFor(() => expect(onSetCampaignDate).toHaveBeenCalledTimes(1));
    expect(onSetCampaignDate).toHaveBeenCalledWith('001-1106');
  });

  it('saves on Enter too', async () => {
    const onSetCampaignDate = vi.fn().mockResolvedValue(undefined);
    bills(vi.fn(), vi.fn(), [], onSetCampaignDate);
    const input = screen.getByLabelText('Campaign date');
    fireEvent.change(input, { target: { value: '002-1105' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onSetCampaignDate).toHaveBeenCalledWith('002-1105'));
  });
});
