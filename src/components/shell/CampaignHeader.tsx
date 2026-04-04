import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Menu } from 'lucide-react';
import { useCampaignContext } from '../../features/campaign/CampaignContext';
import { useAppState } from '../../context/AppStateContext';
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
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetCloseButton,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { Campaign } from '../../types/campaign';

// ── Campaign Header ─────────────────────────────────────────────

interface CampaignHeaderProps {
  onCreateCampaign?: () => void;
  onManageParty?: () => void;
}

export function CampaignHeader({ onCreateCampaign, onManageParty }: CampaignHeaderProps) {
  const { activeCampaign, activeSession, activeCharacterInCampaign, setActiveCampaign } = useCampaignContext();
  const { settings, toggleMode } = useAppState();
  const { isFullscreen, toggleFullscreen, isSupported: fsSupported } = useFullscreen();
  const { isActive: wakeLockActive, toggleWakeLock, isSupported: wlSupported } = useWakeLock();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
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
            className="flex flex-1 items-center px-3 py-2 min-h-[44px] bg-transparent border-none cursor-pointer text-text text-sm font-semibold"
          >
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
            <SheetTitle>Menu</SheetTitle>
            <SheetCloseButton />
          </SheetHeader>
          <SheetBody className="flex flex-col gap-0 p-0">
            {/* Mode toggle */}
            <button
              onClick={() => { toggleMode(); setSheetOpen(false); }}
              className={cn(
                'flex items-center gap-2 w-full text-left px-4 py-3 min-h-[44px] bg-transparent border-none border-b border-border cursor-pointer text-base font-semibold',
                isPlayMode ? 'text-[var(--color-mode-play)]' : 'text-[var(--color-mode-edit)]',
              )}
            >
              {isPlayMode ? 'PLAY MODE' : 'EDIT MODE'}
            </button>

            <button
              onClick={() => { onManageParty?.(); setSheetOpen(false); }}
              className="block w-full text-left px-4 py-3 min-h-[44px] bg-transparent border-none border-b border-border cursor-pointer text-text text-base"
            >
              Manage Party
            </button>

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
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}
