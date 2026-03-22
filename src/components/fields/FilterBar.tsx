import { Chip } from '../primitives/Chip';

interface FilterOption {
  id: string;
  label: string;
}

interface FilterBarProps {
  filters: FilterOption[];
  activeFilter: string;
  onFilterChange: (id: string) => void;
}

export function FilterBar({ filters, activeFilter, onFilterChange }: FilterBarProps) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
      {filters.map(f => (
        <Chip key={f.id} label={f.label} active={activeFilter === f.id} onClick={() => onFilterChange(f.id)} />
      ))}
    </div>
  );
}
