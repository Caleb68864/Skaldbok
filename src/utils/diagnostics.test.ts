import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDiagnosticsReport,
  clearDiagnostics,
  DIAGNOSTICS_CAPACITY,
  installDiagnosticsCapture,
  recentDiagnostics,
} from './diagnostics';

beforeEach(() => clearDiagnostics());
afterEach(() => vi.restoreAllMocks());

describe('diagnostics capture', () => {
  it('records console errors and warnings and still prints them', () => {
    const printed = vi.fn();
    const target = { error: printed, warn: vi.fn() };
    installDiagnosticsCapture(target);

    target.error('[thing] failed', new Error('disk full'));
    target.warn('careful');

    expect(printed).toHaveBeenCalledTimes(1);
    expect(recentDiagnostics().map(e => e.level)).toEqual(['error', 'warn']);
    expect(recentDiagnostics()[0].message).toContain('disk full');
  });

  it('keeps only the newest entries', () => {
    const target = { error: vi.fn(), warn: vi.fn() };
    installDiagnosticsCapture(target);
    for (let i = 0; i < DIAGNOSTICS_CAPACITY + 5; i++) target.error(`entry ${i}`);
    const entries = recentDiagnostics();
    expect(entries).toHaveLength(DIAGNOSTICS_CAPACITY);
    expect(entries[entries.length - 1].message).toBe(`entry ${DIAGNOSTICS_CAPACITY + 4}`);
  });

  it('survives an argument that cannot be serialised', () => {
    const target = { error: vi.fn(), warn: vi.fn() };
    installDiagnosticsCapture(target);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => target.error(cyclic)).not.toThrow();
    expect(recentDiagnostics()).toHaveLength(1);
  });
});

describe('buildDiagnosticsReport', () => {
  it('includes version, schema, storage and the log', async () => {
    const target = { error: vi.fn(), warn: vi.fn() };
    installDiagnosticsCapture(target);
    target.error('boom');
    const report = await buildDiagnosticsReport({
      appVersion: '1.2.3',
      schemaVersion: 20,
      estimateStorage: async () => ({ usage: 10, quota: 100 }),
    });
    expect(report).toContain('App version: 1.2.3');
    expect(report).toContain('Database schema: 20');
    expect(report).toContain('Storage: 10 of 100 bytes');
    expect(report).toContain('boom');
  });

  it('still produces a report when the storage estimate fails', async () => {
    const report = await buildDiagnosticsReport({
      appVersion: '1',
      schemaVersion: 20,
      estimateStorage: async () => { throw new Error('nope'); },
    });
    expect(report).toContain('Storage: unavailable');
  });
});
