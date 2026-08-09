import { CalendarDays } from 'lucide-react';
import { TimelineGrid } from './TimelineGrid';
import type { TimelineMarkerLayout, TimelineScaleUnit, TimelineTick } from './types';

/** Props for {@link TimelineHeaderAxis}: layout widths, the ticks/markers to label, and the active scale unit. */
export interface TimelineHeaderAxisProps {
  labelColumnWidth: number;
  timelineWidth: number;
  ticks: TimelineTick[];
  markers: TimelineMarkerLayout[];
  scaleUnit: TimelineScaleUnit;
}

/** Sticky top axis: the label-column header plus major-tick date labels and marker chips over the shared {@link TimelineGrid}. */
export function TimelineHeaderAxis({
  labelColumnWidth,
  timelineWidth,
  ticks,
  markers,
  scaleUnit,
}: TimelineHeaderAxisProps) {
  const majorTicks = ticks.filter((tick) => tick.isMajor);

  return (
    <div
      className="sticky top-0 z-30 grid border-b border-border bg-surface/95 backdrop-blur"
      style={{ gridTemplateColumns: `${labelColumnWidth}px ${timelineWidth}px` }}
    >
      <div className="sticky left-0 z-20 flex min-h-[80px] items-center gap-3 border-r border-border bg-surface px-4 py-3">
        <CalendarDays className="h-4 w-4 text-text-muted" />
        <div>
          <p className="text-sm font-semibold text-text">Timeline</p>
          <p className="text-[length:var(--size-xs)] uppercase tracking-[0.18em] text-text-muted">{scaleUnit}</p>
        </div>
      </div>
      <div className="relative h-[80px] min-h-[80px] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_50%,rgba(0,0,0,0.05))]">
        <TimelineGrid ticks={ticks} markers={markers} />
        {majorTicks.map((tick) => (
          <div
            key={`label-${tick.valueMs}`}
            // 12px like every other label in the app. These are absolutely
            // positioned and centred on their tick, so widening the type eats
            // into the gap between neighbouring ticks — `majorTicks` is already
            // a thinned subset chosen for the current scale, which is what keeps
            // them from colliding. Verified at both tablet orientations.
            className="absolute top-3 -translate-x-1/2 px-2 text-[length:var(--size-xs)] font-medium text-text-muted"
            style={{ left: `${tick.leftPercent}%` }}
          >
            {tick.label}
          </div>
        ))}
        {markers.map((marker) => (
          <div
            key={`marker-${marker.marker.id}`}
            className="absolute bottom-2 -translate-x-1/2 rounded-full border border-gold/70 bg-surface px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-gold"
            style={{ left: `${marker.leftPercent}%` }}
          >
            {marker.marker.label}
          </div>
        ))}
      </div>
    </div>
  );
}
