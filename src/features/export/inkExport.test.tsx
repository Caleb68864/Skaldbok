// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

/**
 * Exporting a handwritten note shipped a Markdown file that said the
 * handwriting existed and drew none of it. Fails on the old hook, which sent a
 * lone .md with no drawing.
 */

const note = {
  id: 'ink-1', campaignId: 'c1', title: 'Cave sketch', type: 'generic', body: null, visibility: 'public',
  tags: [], createdAt: 'x', updatedAt: 'x',
  typeData: { ink: { version: 1, pageHeight: 20, strokes: [{ tool: 'pen', color: '#000', width: 2, points: [[1, 1, 1], [5, 5, 1]] }] } },
};
const zipped: Array<Map<string, string | Blob>> = [];

vi.mock('../campaign/CampaignContext', () => ({
  useCampaignContext: () => ({ activeCampaign: { id: 'c1', name: 'C', system: 'classic-fantasy' } }),
}));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../context/AppStateContext', () => ({ useAppState: () => ({ settings: {}, updateSettings: vi.fn() }) }));
vi.mock('../../storage/repositories/noteRepository', () => ({
  getNoteById: vi.fn(async () => note),
  getNotesByCampaign: vi.fn(async () => [note]),
  getNotesBySession: vi.fn(async () => []),
}));
vi.mock('../../storage/repositories/entityLinkRepository', () => ({ getLinksFrom: vi.fn(async () => []) }));
vi.mock('../../storage/repositories/attachmentRepository', () => ({ getAttachmentsByNote: vi.fn(async () => []) }));
vi.mock('../../utils/export/bundleToZip', () => ({
  bundleToZip: vi.fn(async (files: Map<string, string | Blob>) => { zipped.push(files); return new Blob(['zip']); }),
}));
vi.mock('../../utils/export/delivery', () => ({ shareFile: vi.fn(async () => 'downloaded'), copyToClipboard: vi.fn() }));

const { useExportActions } = await import('./useExportActions');

afterEach(cleanup);

describe('exporting a handwritten note', () => {
  it('ships the drawing as an SVG beside the note, embedded in it', async () => {
    const { result } = renderHook(() => useExportActions());
    await act(async () => { await result.current.exportNote('ink-1'); });

    const files = zipped[0];
    expect(files, 'a handwritten note now exports as a ZIP').toBeDefined();
    const names = [...files!.keys()];
    const svgName = names.find((n) => n.endsWith('.ink.svg'))!;
    expect(svgName).toBeDefined();
    const md = String(files!.get(names.find((n) => n.endsWith('.md'))!));
    expect(md).toContain(`![[${svgName}]]`);
    expect(await (files!.get(svgName) as Blob).text()).toContain('<path');
  });
});
