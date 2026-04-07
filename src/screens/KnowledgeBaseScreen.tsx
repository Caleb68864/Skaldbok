/**
 * Root screen for the Knowledge Base at `/kb` and `/kb/:nodeId`.
 *
 * @remarks
 * Wraps children in `<KnowledgeBaseProvider>` so all KB context hooks
 * are available to sub-components. Renders either:
 * - `VaultBrowser` (list view at `/kb`)
 * - `NoteReader` (detail view at `/kb/:nodeId`)
 * - `GraphView` (graph view at `/kb?view=graph`)
 *
 * On first visit, checks for `migration_kb_graph_v1` metadata key. If absent,
 * triggers `bulkRebuildGraph` with a loading indicator.
 */

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { KnowledgeBaseProvider } from '../features/kb/KnowledgeBaseContext';
import { VaultBrowser } from '../features/kb/VaultBrowser';
import { NoteReader } from '../features/kb/NoteReader';
import { GraphView } from '../features/kb/GraphView';
import { bulkRebuildGraph } from '../features/kb/linkSyncEngine';
import { db } from '../storage/db/client';
import { useCampaignContext } from '../features/campaign/CampaignContext';

export default function KnowledgeBaseScreen() {
  const navigate = useNavigate();
  const { nodeId } = useParams<{ nodeId?: string }>();
  const [searchParams] = useSearchParams();
  const isGraphView = searchParams.get('view') === 'graph';
  const { activeCampaign } = useCampaignContext();
  const [isBuilding, setIsBuilding] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // On mount: check for migration and rebuild if needed
  useEffect(() => {
    let mounted = true;

    async function checkAndRebuild() {
      if (!activeCampaign?.id) return;
      try {
        const meta = await db
          .table('metadata')
          .where('key')
          .equals('migration_kb_graph_v1')
          .first();
        if (!meta) {
          if (mounted) setIsBuilding(true);
          await bulkRebuildGraph(activeCampaign.id);
          if (mounted) setIsBuilding(false);
        }
      } catch (err) {
        if (import.meta.env.DEV)
          console.warn('[KBScreen] bulkRebuildGraph failed', err);
        if (mounted) setIsBuilding(false);
      }
      if (mounted) setIsReady(true);
    }

    checkAndRebuild();
    return () => {
      mounted = false;
    };
  }, [activeCampaign?.id]);

  if (!activeCampaign) {
    return (
      <div className="p-4 text-center text-[var(--color-text-muted)]">
        No active campaign. Select a campaign first.
      </div>
    );
  }

  return (
    <KnowledgeBaseProvider campaignId={activeCampaign.id}>
      {/* Header with back, title, and actions */}
      {!isGraphView && (
        <div className="flex items-center gap-3 p-4 pb-0">
          <button onClick={() => navigate(-1)} className="min-h-11 min-w-11 flex items-center justify-center bg-transparent border-none cursor-pointer text-[var(--color-text)]" aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          </button>
          <h2 className="text-[var(--color-text)] m-0 flex-1">Knowledge Base</h2>
          <button
            onClick={() => navigate('/note/new')}
            className="min-h-11 px-3 py-1.5 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg cursor-pointer text-xs font-semibold"
          >
            + Note
          </button>
          <button
            onClick={() => navigate('/kb?view=graph')}
            className="min-h-11 px-3 py-1.5 bg-[var(--color-surface-raised)] text-[var(--color-text)] border border-[var(--color-border)] rounded-lg cursor-pointer text-xs font-semibold"
            aria-label="Graph view"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1 align-[-2px]"><circle cx="5" cy="6" r="3"/><circle cx="19" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><line x1="7.5" y1="7.5" x2="10.5" y2="16.5"/><line x1="16.5" y1="7.5" x2="13.5" y2="16.5"/></svg>
            Graph
          </button>
        </div>
      )}
      {isBuilding && (
        <div className="p-8 text-center">
          <div className="text-[var(--color-text-muted)] text-sm">
            Building knowledge graph...
          </div>
        </div>
      )}
      {!isBuilding && isReady && (
        isGraphView ? (
          <GraphView campaignId={activeCampaign.id} centeredNodeId={nodeId} />
        ) : nodeId ? (
          <NoteReader noteId={nodeId} />
        ) : (
          <VaultBrowser campaignId={activeCampaign.id} />
        )
      )}
    </KnowledgeBaseProvider>
  );
}
