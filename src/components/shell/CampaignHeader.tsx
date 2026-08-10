import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Menu } from 'lucide-react';
import { useCampaignContext } from '../../features/campaign/CampaignContext';
import { useExportActions } from '../../features/export/useExportActions';
import { useImportActions } from '../../features/import/useImportActions';
import { ImportPreview } from '../../components/import/ImportPreview';
import { useAppState } from '../../context/AppStateContext';
import { useSystemDefinition } from '../../features/systems/useSystemDefinition';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useWakeLock } from '../../hooks/useWakeLock';
import { db } from '../../storage/db/client';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetCloseButton,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { Campaign } from '../../types/campaign';
import { AppLogo } from '../primitives/AppLogo';

// ── Campaign Header ─────────────────────────────────────────────

/** Props for {@link CampaignHeader}: callbacks the shell wires to open the create-campaign modal and party drawer. */
export interface CampaignHeaderProps {
  onCreateCampaign?: () => void;
  onManageParty?: () => void;
}

/**
 * Top app-bar: campaign switcher, active-session indicator, and the overflow menu
 * for import/export, play-mode toggle, fullscreen, and wake-lock.
 *
 * @remarks
 * Import runs through {@link useImportActions}, which may surface a preview /
 * conflict step ({@link ImportPreview}) before committing — the header hosts that
 * modal. Fullscreen and wake-lock are best-effort browser features (via
 * {@link useFullscreen}/{@link useWakeLock}) and silently no-op where unsupported,
 * which matters for tablets at the table.
 */
export function CampaignHeader({ onCreateCampaign, onManageParty }: CampaignHeaderProps) {
  const { activeCampaign, activeSession, activeCharacterInCampaign, setActiveCampaign } = useCampaignContext();
  const { exportAllNotes, exportCampaign } = useExportActions();
  const { startImport, showPreview, parsedResult, contentHashMismatch, conflicts, executeImport, cancelImport, isImporting } = useImportActions();
  const { settings, toggleMode } = useAppState();
  const [includePrivateExport, setIncludePrivateExport] = useState(false);
  const { isFullscreen, toggleFullscreen, isSupported: fsSupported } = useFullscreen();
  const { isActive: wakeLockActive, toggleWakeLock, isSupported: wlSupported } = useWakeLock();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Resolved from the *campaign*, not the active character: the overflow sheet
  // is campaign-scoped and is most often opened with no character loaded.
  const { system } = useSystemDefinition(activeCampaign?.system ?? 'classic-fantasy');
  const vehicles = system?.vehicles;
  const isPlayMode = settings.mode === 'play';

  useEffect(() => {
    if (!selectorOpen) return;
    let mounted = true;
    db.campaigns.toArray().then(all => {
      if (mounted) setCampaigns(all);
    });
    return () => { mounted = false; };
  }, [selectorOpen]);

  return (
    <div className="flex items-center w-full min-h-[44px] bg-surface-alt border-b border-border">
      {/* Campaign selector dropdown */}
      <DropdownMenu open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Select campaign"
            className="flex flex-1 items-center gap-2 px-3 py-2 min-h-[44px] bg-transparent border-none cursor-pointer text-text text-sm font-semibold"
          >
            <AppLogo size="sm" className="shadow-sm shadow-black/30" />
            <span className="flex flex-1 items-center text-left gap-2">
              <span className="font-[family-name:var(--font-display)]">
                {activeCampaign ? activeCampaign.name : 'No campaign'}
              </span>
              {activeSession && (
                <span className="flex items-center gap-2 text-text-muted font-normal text-xs">
                  <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse" />
                  {activeSession.title}
                </span>
              )}
              {activeCharacterInCampaign?.name && (
                <span className="text-text-muted font-normal text-xs">
                  · {activeCharacterInCampaign.name}
                </span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 text-text-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[min(480px,90vw)]">
          {campaigns.length === 0 && (
            <div className="px-3 py-3 text-text-muted text-sm">
              No campaigns yet
            </div>
          )}
          {campaigns.map(campaign => (
            <DropdownMenuItem
              key={campaign.id}
              onClick={() => { setActiveCampaign(campaign.id); setSelectorOpen(false); }}
              className={cn(
                campaign.id === activeCampaign?.id && 'text-accent font-semibold',
              )}
            >
              {campaign.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => { onCreateCampaign?.(); setSelectorOpen(false); }}
            className="text-accent"
          >
            + Create Campaign
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hamburger menu -> Sheet from right */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <button
            aria-label="Menu"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-transparent border-none border-l border-border cursor-pointer text-text"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <div className="flex items-center gap-3">
              <AppLogo size="sm" />
              <SheetTitle>Menu</SheetTitle>
            </div>
            <SheetCloseButton />
            {/* Radix warns when a Dialog has no description; the menu is a list
                of links that needs no visible blurb, so this is screen-reader
                only rather than an invented subtitle. */}
            <SheetDescription className="sr-only">
              Campaign, mode, navigation and data export actions
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="flex flex-col gap-0 p-0">
            {/* Mode toggle */}
            <button
              onClick={() => { toggleMode(); setSheetOpen(false); }}
              className={cn(
                'flex w-full flex-col items-start gap-1 px-4 py-3 min-h-[44px] bg-transparent border-none border-b border-border cursor-pointer text-base font-semibold',
                isPlayMode ? 'text-[var(--color-mode-play)]' : 'text-[var(--color-mode-edit)]',
              )}
            >
              <span>{isPlayMode ? 'PLAY MODE' : 'EDIT MODE'}</span>
              <span className="text-sm font-normal text-[var(--color-text-muted)]">
                {isPlayMode ? 'Switch to Edit Mode to change identity and attributes' : 'Switch to Play Mode to lock prep fields for table use'}
              </span>
            </button>

            <button
              onClick={() => { onManageParty?.(); setSheetOpen(false); }}
              className="block w-full text-left px-4 py-3 min-h-[44px] bg-transparent border-none border-b border-border cursor-pointer text-text text-base"
            >
              Manage Party
            </button>

            {/* Only for rulesets that have vehicles at all, and named as they
                name them — the same gating the route tab gets. A dungeon crawl
                has no ships and should not be offered a starship sheet. */}
            {vehicles && (
              <Link
                to="/ships"
                onClick={() => setSheetOpen(false)}
                className="block w-full text-left px-4 py-3 min-h-[44px] no-underline border-b border-border text-text text-base"
              >
                {vehicles.label}
              </Link>
            )}

            {/* Ledger and route deliberately absent: both are used constantly
                at the table and now live as tabs on the session sub-nav, one
                tap away. Listing them here as well would be a second, slower
                path to the same screens. See `SessionSubNav`. */}

            <Link
              to="/settings"
              onClick={() => setSheetOpen(false)}
              className="block w-full text-left px-4 py-3 min-h-[44px] no-underline border-b border-border text-text text-base"
            >
              Settings
            </Link>
            <Link
              to="/reference"
              onClick={() => setSheetOpen(false)}
              className="block w-full text-left px-4 py-3 min-h-[44px] no-underline border-b border-border text-text text-base"
            >
              Reference
            </Link>
            <Link
              to="/library"
              onClick={() => setSheetOpen(false)}
              className="block w-full text-left px-4 py-3 min-h-[44px] no-underline border-b border-border text-text text-base"
            >
              Character Library
            </Link>
            <Link
              to="/profile"
              onClick={() => setSheetOpen(false)}
              className="block w-full text-left px-4 py-3 min-h-[44px] no-underline border-b border-border text-text text-base"
            >
              Profile
            </Link>

            {fsSupported && (
              <button
                onClick={() => { toggleFullscreen(); setSheetOpen(false); }}
                className="block w-full text-left px-4 py-3 min-h-[44px] bg-transparent border-none border-b border-border cursor-pointer text-text text-base"
              >
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
            )}

            {wlSupported && (
              <button
                onClick={() => { toggleWakeLock(); setSheetOpen(false); }}
                className="block w-full text-left px-4 py-3 min-h-[44px] bg-transparent border-none border-b border-border cursor-pointer text-text text-base"
              >
                {wakeLockActive ? 'Wake Lock On' : 'Wake Lock Off'}
              </button>
            )}

            {/* Export / Import section */}
            {activeCampaign && (
              <>
                <div className="px-4 pt-4 pb-1 text-text-muted text-xs uppercase tracking-widest font-semibold">
                  Data
                </div>
                <button
                  onClick={() => { exportAllNotes(); setSheetOpen(false); }}
                  className="block w-full text-left px-4 py-3 min-h-[44px] bg-transparent border-none border-b border-border cursor-pointer text-text text-base"
                >
                  Export All Notes (.zip)
                </button>
                <button
                  onClick={() => { exportCampaign(activeCampaign.id, includePrivateExport); setSheetOpen(false); }}
                  className="block w-full text-left px-4 py-3 min-h-[44px] bg-transparent border-none border-b border-border cursor-pointer text-text text-base"
                >
                  Export Campaign (.skaldbok)
                </button>
                <button
                  onClick={() => { startImport(); setSheetOpen(false); }}
                  className="block w-full text-left px-4 py-3 min-h-[44px] bg-transparent border-none border-b border-border cursor-pointer text-text text-base"
                >
                  Import (.skaldbok)
                </button>
                <label className="flex items-center gap-2 px-4 py-2 text-text-muted text-sm">
                  <input type="checkbox" checked={includePrivateExport} onChange={e => setIncludePrivateExport(e.target.checked)} className="w-4 h-4 accent-[var(--color-accent)]" />
                  Include private notes
                </label>
              </>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>

      {/* Import preview modal */}
      {showPreview && parsedResult?.success && (
        <ImportPreview
          bundle={parsedResult.bundle}
          warnings={parsedResult.warnings}
          conflicts={conflicts}
          contentHashMismatch={contentHashMismatch}
          onImport={executeImport}
          onCancel={cancelImport}
          isImporting={isImporting}
        />
      )}
    </div>
  );
}
