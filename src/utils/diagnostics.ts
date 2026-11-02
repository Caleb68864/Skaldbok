import { nowISO } from './dates';

/**
 * A ring buffer of recent console errors and warnings (roadmap I9).
 *
 * @remarks
 * The target device is a tablet with no devtools, and a console line was the only
 * signal of many failures. Mirroring the console keeps the ~180 existing call sites
 * as they are, and `Copy diagnostics` in Settings hands the result to the user.
 * Messages stay on the device unless the user pastes them somewhere.
 */

export const DIAGNOSTICS_CAPACITY = 200;

export interface DiagnosticEntry {
  at: string;
  level: 'error' | 'warn';
  message: string;
}

let entries: DiagnosticEntry[] = [];

function describe(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function record(level: DiagnosticEntry['level'], args: unknown[]): void {
  entries.push({ at: nowISO(), level, message: args.map(describe).join(' ') });
  if (entries.length > DIAGNOSTICS_CAPACITY) entries = entries.slice(-DIAGNOSTICS_CAPACITY);
}

/** Wraps `error` and `warn` so each call is recorded and then printed as before. */
export function installDiagnosticsCapture(target: Pick<Console, 'error' | 'warn'> = console): void {
  for (const level of ['error', 'warn'] as const) {
    const original = target[level];
    target[level] = (...args: unknown[]) => {
      record(level, args);
      original.apply(target, args);
    };
  }
}

/** The recorded entries, oldest first. */
export function recentDiagnostics(): DiagnosticEntry[] {
  return [...entries];
}

/** Empties the buffer. */
export function clearDiagnostics(): void {
  entries = [];
}

/** What a report states beside the log. Passed in so this module stays pure. */
export interface DiagnosticsContext {
  appVersion: string;
  schemaVersion: number;
  estimateStorage: () => Promise<{ usage?: number; quota?: number }>;
}

/** Renders the plain-text report the Settings button copies. */
export async function buildDiagnosticsReport(context: DiagnosticsContext): Promise<string> {
  let storage = 'unavailable';
  try {
    const { usage, quota } = await context.estimateStorage();
    storage = `${usage ?? '?'} of ${quota ?? '?'} bytes`;
  } catch {
    // A report is most wanted when something is already wrong, so this cannot stop it.
  }
  return [
    `App version: ${context.appVersion}`,
    `Database schema: ${context.schemaVersion}`,
    `Storage: ${storage}`,
    `Generated: ${nowISO()}`,
    '',
    ...entries.map(entry => `${entry.at} [${entry.level}] ${entry.message}`),
  ].join('\n');
}
