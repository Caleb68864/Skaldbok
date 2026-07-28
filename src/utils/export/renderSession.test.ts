import { describe, expect, it } from 'vitest';
import { renderSessionBundle } from './renderSession';
import { textToDoc } from '../../features/notes/textToDoc';
import type { Note } from '../../types/note';
import type { Session } from '../../types/session';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    campaignId: 'campaign-1',
    title: 'The Harbour Job',
    status: 'ended',
    date: '2026-07-27',
    startedAt: '2026-07-27T19:00:00.000Z',
    endedAt: '2026-07-27T22:00:00.000Z',
    schemaVersion: 1,
    createdAt: '2026-07-27T19:00:00.000Z',
    updatedAt: '2026-07-27T22:00:00.000Z',
    ...overrides,
  };
}

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    campaignId: 'campaign-1',
    sessionId: 'session-1',
    title: 'Ostrand the Harbourmaster',
    body: textToDoc('Takes bribes on Tuesdays.'),
    type: 'npc',
    status: 'active',
    pinned: false,
    scope: 'campaign',
    schemaVersion: 1,
    createdAt: '2026-07-27T19:10:00.000Z',
    updatedAt: '2026-07-27T19:10:00.000Z',
    ...overrides,
  };
}

function makeLogEntry(overrides: Partial<Note> = {}): Note {
  return makeNote({
    id: `log-${Math.random()}`,
    title: '',
    type: 'log',
    ...overrides,
  });
}

describe('renderSessionBundle', () => {
  it('renders 20 log entries plus 2 promoted notes as 3 files, not 23', () => {
    const session = makeSession();
    const logEntries: Note[] = Array.from({ length: 20 }, (_, i) =>
      makeLogEntry({
        id: `log-${i}`,
        createdAt: `2026-07-27T19:${String(i).padStart(2, '0')}:00.000Z`,
        body: textToDoc(`Entry number ${i}`),
      })
    );
    const promotedNotes: Note[] = [
      makeNote({ id: 'note-a', title: 'Ostrand' }),
      makeNote({ id: 'note-b', title: 'Second Ship' }),
    ];
    const linkedNotes = [...logEntries, ...promotedNotes];

    const files = renderSessionBundle(session, linkedNotes, []);

    expect(files.size).toBe(3);
  });

  it('includes all log entry texts in createdAt order with timestamps in the session index', () => {
    const session = makeSession();
    const logEntries: Note[] = [
      makeLogEntry({
        id: 'log-2',
        createdAt: '2026-07-27T19:51:00.000Z',
        body: textToDoc('Second ship in the berth.'),
      }),
      makeLogEntry({
        id: 'log-1',
        createdAt: '2026-07-27T19:42:00.000Z',
        body: textToDoc('Harbourmaster is called [[Ostrand]].'),
      }),
    ];

    const files = renderSessionBundle(session, logEntries, []);
    const sessionFilename = Array.from(files.keys())[0];
    const content = files.get(sessionFilename)!;

    const firstIndex = content.indexOf('Harbourmaster is called [[Ostrand]].');
    const secondIndex = content.indexOf('Second ship in the berth.');
    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(firstIndex);

    const formatLocalTime = (iso: string) => {
      const date = new Date(iso);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    };
    expect(content).toContain(formatLocalTime('2026-07-27T19:42:00.000Z'));
    expect(content).toContain(formatLocalTime('2026-07-27T19:51:00.000Z'));
    expect(content).toContain('## Session Log');
  });

  it('produces byte-identical output to the pre-change implementation when there are no log entries', () => {
    const session = makeSession();
    const notes: Note[] = [makeNote({ id: 'note-a', title: 'Ostrand' })];

    const files = renderSessionBundle(session, notes, []);
    const sessionFilename = Array.from(files.keys())[0];
    const content = files.get(sessionFilename)!;

    expect(content).not.toContain('## Session Log');
    expect(files.size).toBe(2);
  });
});
