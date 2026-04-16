interface TimelineNowMarkerProps {
  leftPercent: number;
}

export function TimelineNowMarker({ leftPercent }: TimelineNowMarkerProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 z-10"
      style={{ left: `${leftPercent}%` }}
    >
      <div className="absolute inset-y-0 left-0 w-px bg-accent" />
      <div className="absolute left-1 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-bg">
        Now
      </div>
    </div>
  );
}
