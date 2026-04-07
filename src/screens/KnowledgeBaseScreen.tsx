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
import { useParams, useSearchParams } from 'react-router-dom';
import { KnowledgeBaseProvider } from '../features/kb/KnowledgeBaseContext';
import { VaultBrowser } from '../features/kb/VaultBrowser';
import { NoteReader } from '../features/kb/NoteReader';
import { GraphView } from '../features/kb/GraphView';
import { CommandPalette } from '../features/kb/CommandPalette';
import { useCommandPalette } from '../features/kb/useCommandPalette';
import { bulkRebuildGraph } from '../features/kb/linkSyncEngine';
import { db } from '../storage/db/client';
import { useCampaignContext } from '../features/campaign/CampaignContext';

export default function KnowledgeBaseScreen() {
  const { nodeId } = useParams<{ nodeId?: string }>();
  const [searchParams] = useSearchParams();
  const isGraphView = searchParams.get('view') === 'graph';
  const { activeCampaign } = useCampaignContext();
  const [isBuilding, setIsBuilding] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const { isOpen: isPaletteOpen, open: openPalette, close: closePalette } = useCommandPalette();

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
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={closePalette}
        campaignId={activeCampaign.id}
      />
      {/* Search FAB — opens command palette */}
      {!isPaletteOpen && (
        <button
          onClick={openPalette}
          aria-label="Search knowledge base"
          className="fixed bottom-[136px] right-4 z-[99] w-12 h-12 rounded-full bg-[var(--color-surface-raised)] text-[var(--color-text)] border border-[var(--color-border)] shadow-lg cursor-pointer flex items-center justify-center"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      )}
    </KnowledgeBaseProvider>
  );
}
