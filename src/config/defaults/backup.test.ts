import { describe, expect, it } from 'vitest';
import { classifyBackup, describeBackup, DEFAULT_BACKUP_REMINDER_DAYS } from './backup';

const NOW = new Date('2026-08-05T12:00:00.000Z');
const daysBefore = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('classifyBackup', () => {
  it('reports never when no export has been recorded', () => {
    expect(classifyBackup(undefined, NOW)).toEqual({ state: 'never' });
    expect(classifyBackup(null, NOW)).toEqual({ state: 'never' });
  });

  it('reports never for an unparseable timestamp rather than trusting it', () => {
    expect(classifyBackup('not a date', NOW)).toEqual({ state: 'never' });
  });

  it('reports never for a future timestamp', () => {
    // A clock that moved backwards must not be able to report a campaign as
    // freshly backed up when it is not. Failing safe here means over-warning.
    expect(classifyBackup(daysBefore(-5), NOW)).toEqual({ state: 'never' });
  });

  it('reports fresh inside the reminder window', () => {
    expect(classifyBackup(daysBefore(0), NOW)).toEqual({ state: 'fresh', daysAgo: 0 });
    expect(classifyBackup(daysBefore(DEFAULT_BACKUP_REMINDER_DAYS - 1), NOW)).toEqual({
      state: 'fresh',
      daysAgo: DEFAULT_BACKUP_REMINDER_DAYS - 1,
    });
  });

  it('reports stale on the boundary day and beyond', () => {
    expect(classifyBackup(daysBefore(DEFAULT_BACKUP_REMINDER_DAYS), NOW)).toEqual({
      state: 'stale',
      daysAgo: DEFAULT_BACKUP_REMINDER_DAYS,
    });
    expect(classifyBackup(daysBefore(120), NOW)).toEqual({ state: 'stale', daysAgo: 120 });
  });

  it('honours a custom reminder window', () => {
    expect(classifyBackup(daysBefore(8), NOW, 7)).toEqual({ state: 'stale', daysAgo: 8 });
    expect(classifyBackup(daysBefore(8), NOW, 90)).toEqual({ state: 'fresh', daysAgo: 8 });
  });
});

describe('describeBackup', () => {
  it('reads naturally at the boundaries', () => {
    expect(describeBackup({ state: 'never' })).toBe('Never backed up');
    expect(describeBackup({ state: 'fresh', daysAgo: 0 })).toBe('Backed up today');
    expect(describeBackup({ state: 'fresh', daysAgo: 1 })).toBe('Backed up yesterday');
    expect(describeBackup({ state: 'stale', daysAgo: 42 })).toBe('Backed up 42 days ago');
  });
});
