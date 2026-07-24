import type { TimelineMarkerLayout, TimelineTick } from './types';

/** Props for {@link TimelineGrid}: the tick lines and marker lines to draw. */
interface TimelineGridProps {
  ticks: TimelineTick[];
  markers: TimelineMarkerLayout[];
}

/** Decorative absolute-positioned background grid: major/minor tick lines plus dashed marker lines. Non-interactive (`aria-hidden`). */
export function TimelineGrid({ ticks, markers }: TimelineGridProps) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {ticks.map((tick) => (
        <div
          key={`${tick.valueMs}-${tick.isMajor ? 'major' : 'minor'}`}
          className={tick.isMajor ? 'absolute inset-y-0 w-px bg-border/90' : 'absolute inset-y-0 w-px bg-border/40'}
          style={{ left: `${tick.leftPercent}%` }}
        />
      ))}
      {markers.map((marker) => (
        <div
          key={marker.marker.id}
          className="absolute inset-y-0 w-px border-l border-dashed border-gold/80"
          style={{ left: `${marker.leftPercent}%` }}
        />
      ))}
    </div>
  );
}
