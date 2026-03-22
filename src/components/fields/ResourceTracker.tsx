import { CounterControl } from '../primitives/CounterControl';

interface ResourceTrackerProps {
  resourceId: string;
  label: string;
  current: number;
  max: number;
  onCurrentChange: (value: number) => void;
  onMaxChange?: (value: number) => void;
  disabled?: boolean;
  maxDisabled?: boolean;
}

export function ResourceTracker({ label, current, max, onCurrentChange, onMaxChange, disabled = false, maxDisabled = false }: ResourceTrackerProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      <CounterControl
        label={`${label} (current)`}
        value={current}
        min={0}
        max={max}
        onChange={onCurrentChange}
        disabled={disabled}
      />
      {onMaxChange && (
        <CounterControl
          label={`${label} (max)`}
          value={max}
          min={0}
          onChange={onMaxChange}
          disabled={maxDisabled || disabled}
        />
      )}
    </div>
  );
}
