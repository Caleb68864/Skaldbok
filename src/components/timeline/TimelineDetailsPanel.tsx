import type { ReactNode } from 'react';
import { ExternalLink, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetBody,
  SheetCloseButton,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { TimelineItem, TimelineTrack } from './types';
import { formatTimelineDate, normalizeDateInput } from './utils/date';

interface TimelineDetailsPanelProps {
  item: TimelineItem | null;
  track?: TimelineTrack;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToSource?: (item: TimelineItem) => void;
  renderItemDetails?: (item: TimelineItem, track?: TimelineTrack) => ReactNode;
}

function getRangeLabel(item: TimelineItem): string | null {
  const startMs = normalizeDateInput(item.start);
  if (startMs == null) {
    return null;
  }

  const endMs = normalizeDateInput(item.end);
  if (endMs != null && endMs > startMs) {
    return `${formatTimelineDate(startMs, 'hour')} to ${formatTimelineDate(endMs, 'hour')}`;
  }

  return formatTimelineDate(startMs, 'hour');
}

export function TimelineDetailsPanel({
  item,
  track,
  open,
  onOpenChange,
  onNavigateToSource,
  renderItemDetails,
}: TimelineDetailsPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className="min-w-0">
            <SheetTitle>{item?.title ?? 'Timeline event'}</SheetTitle>
            <SheetDescription>
              {track ? `${track.label}${item?.kind ? ` - ${item.kind}` : ''}` : 'Timeline details'}
            </SheetDescription>
          </div>
          <SheetCloseButton />
        </SheetHeader>
        <SheetBody className="space-y-5">
          {item ? (
            <>
              {renderItemDetails ? (
                renderItemDetails(item, track)
              ) : (
                <>
                  {item.subtitle ? <p className="text-sm text-text-muted">{item.subtitle}</p> : null}
                  <div className="rounded-[var(--radius-md)] border border-border bg-surface-alt p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-text-muted">When</p>
                    <p className="mt-1 text-sm text-text">{getRangeLabel(item) ?? 'Unknown date'}</p>
                  </div>
                  {item.tooltip ? (
                    <div className="rounded-[var(--radius-md)] border border-border bg-surface-alt p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Summary</p>
                      <p className="mt-1 text-sm text-text">{item.tooltip}</p>
                    </div>
                  ) : null}
                  {item.tags?.length ? (
                    <div className="rounded-[var(--radius-md)] border border-border bg-surface-alt p-4">
                      <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-text-muted">
                        <Tags className="h-3.5 w-3.5" />
                        Tags
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {item.tags.map((tag) => (
                          <span key={tag} className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-text">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
              {onNavigateToSource && item.sourceId ? (
                <Button type="button" onClick={() => onNavigateToSource(item)}>
                  <ExternalLink className="h-4 w-4" />
                  Open source
                </Button>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-text-muted">Select a timeline event to inspect it in detail.</p>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
