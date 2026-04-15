import type { TimelineMarkerLayout, TimelineTick } from './types';

interface TimelineGridProps {
  ticks: TimelineTick[];
  markers: TimelineMarkerLayout[];
}

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
