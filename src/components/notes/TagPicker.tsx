const MOOD_TAGS = ['tense', 'funny', 'dramatic', 'sad', 'victorious'] as const;
const SCENE_TAGS = ['combat', 'exploration', 'social', 'mystery', 'travel', 'downtime'] as const;
const META_TAGS = ['important', 'follow-up', 'plot-hook', 'lore', 'treasure'] as const;
const TYPE_TAGS = ['npc', 'location', 'rumor', 'quest', 'loot', 'skill-check', 'spell', 'ability', 'death', 'rest'] as const;

const ALL_TAGS = [...MOOD_TAGS, ...SCENE_TAGS, ...META_TAGS, ...TYPE_TAGS];

interface TagPickerProps {
  selected: string[];
  onToggle: (tag: string) => void;
}

export function TagPicker({ selected, onToggle }: TagPickerProps) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
        Tags
      </p>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {ALL_TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            style={{
              minHeight: '44px',
              minWidth: '44px',
              padding: '0 8px',
              borderRadius: '15px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              background: selected.includes(tag) ? 'var(--color-accent)' : 'var(--color-surface-raised)',
              color: selected.includes(tag) ? 'var(--color-on-accent, #fff)' : 'var(--color-text-muted)',
            }}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
