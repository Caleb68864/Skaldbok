// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';

/**
 * The shell's backup reminder, tested for the thing that went wrong last time.
 *
 * @remarks
 * The autosave banner taught this file its shape. Its guard asserted the tag
 * `<AutosaveErrorBanner` appeared in each screen — which proved the banner was
 * *present*, not that it was *fed*: `<AutosaveErrorBanner error={null} />` plus
 * one `console.warn(saveError)` elsewhere passed the guard and `tsc` together,
 * and the banner rendered nothing forever.
 *
 * So the tests below are behavioural. Each drives the real component with a
 * different backup state and asserts what the user sees, and each positive case
 * is paired with a negative one — a banner that always shows is as useless as
 * one that never does, and only the pairing tells them apart. The one source
 * assertion is the mount, which behaviour in isolation cannot cover: a component
 * nothing renders is the original bug in this family.
 *
 * Testing Library's auto-cleanup does not run here (Vitest globals are off by
 * design), so `cleanup()` is explicit — see `hooks/useAutosave.test.tsx`.
 */

const settings: { lastBackupAt?: string } = {};
let activeCampaign: { id: string } | null = { id: 'camp-1' };
let reminderDays = 30;

vi.mock('../../context/AppStateContext', () => ({
  useAppState: () => ({ settings }),
}));
vi.mock('../../features/campaign/CampaignContext', () => ({
  useCampaignContext: () => ({ activeCampaign }),
}));
vi.mock('../../hooks/useConfigurableDefaults', () => ({
  useBackupReminderDays: () => reminderDays,
}));

const { BackupReminderBanner } = await import('./BackupReminderBanner');

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

beforeEach(() => {
  delete settings.lastBackupAt;
  activeCampaign = { id: 'camp-1' };
  reminderDays = 30;
});

afterEach(() => {
  cleanup();
});

describe('BackupReminderBanner', () => {
  it('warns when the campaign has never been exported', () => {
    render(<BackupReminderBanner />);
    expect(screen.getByRole('status').textContent).toContain('never been exported');
  });

  it('warns when the last export is older than the reminder window', () => {
    settings.lastBackupAt = daysAgo(45);
    render(<BackupReminderBanner />);
    const text = screen.getByRole('status').textContent ?? '';
    expect(text).toContain('45 days ago');
    expect(text).toContain('longer than 30 days');
  });

  it('says nothing when the backup is fresh', () => {
    // The control. Without it every assertion above is satisfied by a banner
    // that renders unconditionally, which would train the user to ignore it —
    // the failure mode that is worse than silence.
    settings.lastBackupAt = daysAgo(2);
    render(<BackupReminderBanner />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('follows the configured window rather than a hardcoded thirty days', () => {
    // `reminderDays` is a user setting. A banner that reads the default instead
    // would be right today and wrong for anyone who changed it.
    settings.lastBackupAt = daysAgo(10);
    reminderDays = 7;
    render(<BackupReminderBanner />);
    expect(screen.getByRole('status').textContent).toContain('longer than 7 days');
  });

  it('says nothing on a device with no campaign', () => {
    // There is nothing to export yet, so the reminder would be advice the user
    // cannot act on.
    activeCampaign = null;
    render(<BackupReminderBanner />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('can be dismissed for the session', () => {
    render(<BackupReminderBanner />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not offer a one-tap export', () => {
    // Deliberate, and worth pinning so it is not "improved" later.
    // `exportCampaign(id, includePrivate = false)` excludes private notes by
    // default and stamps `lastBackupAt` regardless, so a button here would
    // produce a partial copy and then report the campaign as safe.
    render(<BackupReminderBanner />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute('aria-label')).toMatch(/dismiss/i);
  });
});

describe('the shell mounts it', () => {
  it('renders the banner in ShellLayout', () => {
    // Behaviour in isolation cannot see this, and "a component nothing renders"
    // is the bug this whole family keeps producing.
    const shell = readFileSync(join(__dirname, 'ShellLayout.tsx'), 'utf8');
    expect(
      shell,
      'ShellLayout no longer renders <BackupReminderBanner />. The warning is '
      + 'back to being visible only on the Settings screen, which is where nobody '
      + 'is when it matters.',
    ).toContain('<BackupReminderBanner />');
  });
});
