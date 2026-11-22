// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

/**
 * S25 at the Markdown exits. The hook built a privacy-filtered corpus, which
 * did nothing for a `[[wikilink]]` chip: `resolveWikiLinks` renders it from
 * its stored label, so a private note's title was copied out in a public
 * note's text. Fails on the old hook.
 */

const SECRET = 'Lady Sable Is The Hierophant';
const notes = [
  { id: 'secret', campaignId: 'c1', title: SECRET, body: null, type: 'npc', visibility: 'private', tags: [], createdAt: 'x', updatedAt: 'x' },
  {
    id: 'open', campaignId: 'c1', title: 'The Toll House', type: 'location', visibility: 'public', tags: [],
    createdAt: 'x', updatedAt: 'x',
    body: { type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'Ask ' }, { type: 'wikiLink', attrs: { id: 'secret', label: SECRET } },
    ] }] },
  },
];
const copyToClipboard = vi.fn().mockResolvedValue(undefined);

vi.mock('../campaign/CampaignContext', () => ({
  useCampaignContext: () => ({ activeCampaign: { id: 'c1', name: 'C', system: 'classic-fantasy' } }),
}));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../context/AppStateContext', () => ({
  useAppState: () => ({ settings: {}, updateSettings: vi.fn(), isLoading: false }),
}));
vi.mock('../../storage/repositories/noteRepository', () => ({
  getNoteById: vi.fn(async (id: string) => notes.find((n) => n.id === id)),
  getNotesByCampaign: vi.fn(async () => notes),
  getNotesBySession: vi.fn(async () => []),
}));
vi.mock('../../storage/repositories/entityLinkRepository', () => ({ getLinksFrom: vi.fn(async () => []) }));
vi.mock('../../utils/export/delivery', () => ({
  copyToClipboard: (...a: unknown[]) => copyToClipboard(...a),
  shareFile: vi.fn(),
}));

const { useExportActions } = await import('./useExportActions');

afterEach(cleanup);

describe('copying a note that links a private note', () => {
  it('redacts the link instead of copying the private title', async () => {
    const { result } = renderHook(() => useExportActions());
    await act(async () => { await result.current.copyNoteAsMarkdown('open'); });

    const text = String(copyToClipboard.mock.calls[0]?.[0] ?? '');
    expect(text).toContain('Ask [private note]');
    expect(text).not.toContain(SECRET);
  });
});
