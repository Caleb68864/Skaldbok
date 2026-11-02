// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { buildSessionTimelineDataset } from './sessionTimelineAdapter';
import { useTimelineTrackCatalog } from '../../hooks/useConfigurableDefaults';
import { DEFAULT_TIMELINE_TRACK_CATALOG } from '../../config/defaults/timelineTracks';
import type { Session } from '../../types/session';

const appState = vi.hoisted(() => ({ settings: {} as Record<string, unknown> }));
vi.mock('../../context/AppStateContext', () => ({ useAppState: () => appState }));

const session = { id: 's', campaignId: 'c', title: 'S', status: 'ended', startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-01T01:00:00.000Z' } as Session;
const timelineData = { notes: [], links: [] } as never;

afterEach(cleanup);

describe('timeline track grouping is configuration (roadmap G1)', () => {
  it('the dataset uses the catalog it is given', () => {
    const catalog = { ...DEFAULT_TIMELINE_TRACK_CATALOG, session: { ...DEFAULT_TIMELINE_TRACK_CATALOG.session, label: 'Evening' } };
    const dataset = buildSessionTimelineDataset({ session, encounters: [], timelineData, trackCatalog: catalog });
    expect(dataset.tracks.find(t => t.id === 'track-session')?.label).toBe('Evening');
  });

  it('the hook prefers the stored setting and falls back to the default', () => {
    appState.settings = {};
    expect(renderHook(() => useTimelineTrackCatalog()).result.current).toBe(DEFAULT_TIMELINE_TRACK_CATALOG);
    const stored = { session: DEFAULT_TIMELINE_TRACK_CATALOG.session };
    appState.settings = { timelineTrackCatalog: stored };
    expect(renderHook(() => useTimelineTrackCatalog()).result.current).toBe(stored);
  });
});
