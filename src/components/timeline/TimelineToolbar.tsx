import { startTransition } from 'react';
import {
  Eye,
  Filter,
  ListFilter,
  RotateCcw,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TimelineAvailableFilters, TimelineScaleUnit, TimelineTrack } from './types';

const scaleOptions: Array<{ value: TimelineScaleUnit; label: string }> = [
  { value: 'custom', label: 'Auto' },
  { value: 'minute', label: 'Minutes' },
  { value: 'hour', label: 'Hours' },
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
];

interface TimelineToolbarProps {
  title?: string;
  tracks: TimelineTrack[];
  availableFilters: TimelineAvailableFilters;
  visibleTrackCount: number;
  visibleItemCount: number;
  searchText: string;
  hiddenTrackIds: string[];
  includedKinds: string[];
  tagFilters: string[];
  statusFilters: string[];
  scaleUnit: TimelineScaleUnit;
  onSearchChange: (value: string) => void;
  onToggleTrack: (trackId: string) => void;
  onToggleKind: (kind: string) => void;
  onToggleTag: (tag: string) => void;
  onToggleStatus: (status: string) => void;
  onScaleUnitChange: (scaleUnit: TimelineScaleUnit) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

function renderToggleLabel(label: string, active: boolean) {
  return (
    <span className="flex w-full items-center justify-between gap-4">
      <span>{label}</span>
      <span className={active ? 'text-accent' : 'text-text-muted'}>{active ? 'On' : 'Off'}</span>
    </span>
  );
}

export function TimelineToolbar({
  title = 'Timeline Explorer',
  tracks,
  availableFilters,
  visibleTrackCount,
  visibleItemCount,
  searchText,
  hiddenTrackIds,
  includedKinds,
  tagFilters,
  statusFilters,
  scaleUnit,
  onSearchChange,
  onToggleTrack,
  onToggleKind,
  onToggleTag,
  onToggleStatus,
  onScaleUnitChange,
  onZoomIn,
  onZoomOut,
  onReset,
}: TimelineToolbarProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-4 texture-card-bevel">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg text-text">{title}</h2>
          <p className="text-sm text-text-muted">
            {visibleTrackCount} visible track{visibleTrackCount === 1 ? '' : 's'} and {visibleItemCount} visible event{visibleItemCount === 1 ? '' : 's'}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" type="button">
                <Eye className="h-4 w-4" />
                Tracks
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Visible tracks</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {tracks.map((track) => {
                const active = !hiddenTrackIds.includes(track.id);
                return (
                  <DropdownMenuItem
                    key={track.id}
                    onSelect={(event) => {
                      event.preventDefault();
                      onToggleTrack(track.id);
                    }}
                  >
                    {renderToggleLabel(track.label, active)}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" type="button">
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              {availableFilters.kinds.length > 0 ? (
                <>
                  <DropdownMenuLabel>Kinds</DropdownMenuLabel>
                  {availableFilters.kinds.map((kind) => (
                    <DropdownMenuItem
                      key={kind}
                      onSelect={(event) => {
                        event.preventDefault();
                        onToggleKind(kind);
                      }}
                    >
                      {renderToggleLabel(kind, includedKinds.length === 0 || includedKinds.includes(kind))}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              ) : null}
              {availableFilters.statuses.length > 0 ? (
                <>
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  {availableFilters.statuses.map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onSelect={(event) => {
                        event.preventDefault();
                        onToggleStatus(status);
                      }}
                    >
                      {renderToggleLabel(status, statusFilters.includes(status))}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              ) : null}
              {availableFilters.tags.length > 0 ? (
                <>
                  <DropdownMenuLabel>Tags</DropdownMenuLabel>
                  {availableFilters.tags.map((tag) => (
                    <DropdownMenuItem
                      key={tag}
                      onSelect={(event) => {
                        event.preventDefault();
                        onToggleTag(tag);
                      }}
                    >
                      {renderToggleLabel(tag, tagFilters.includes(tag))}
                    </DropdownMenuItem>
                  ))}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" type="button">
                <ListFilter className="h-4 w-4" />
                Scale
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Axis scale</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {scaleOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onSelect={(event) => {
                    event.preventDefault();
                    onScaleUnitChange(option.value);
                  }}
                >
                  {renderToggleLabel(option.label, option.value === scaleUnit)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" type="button" onClick={onZoomOut}>
            <ZoomOut className="h-4 w-4" />
            Zoom Out
          </Button>
          <Button variant="outline" size="sm" type="button" onClick={onZoomIn}>
            <ZoomIn className="h-4 w-4" />
            Zoom In
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          value={searchText}
          onChange={(event) => {
            const nextValue = event.target.value;
            startTransition(() => onSearchChange(nextValue));
          }}
          placeholder="Search timeline events, tags, or kinds"
          className="h-11 w-full rounded-[var(--radius-md)] border border-border bg-surface-alt pl-10 pr-4 text-sm text-text shadow-[var(--shadow-inset-soft)]"
          aria-label="Search timeline events"
        />
      </label>
    </div>
  );
}
