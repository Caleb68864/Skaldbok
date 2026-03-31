import { useState } from 'react';

const MOOD_TAGS = ['tense', 'funny', 'dramatic', 'sad', 'victorious'] as const;
const SCENE_TAGS = ['combat', 'exploration', 'social', 'mystery', 'travel', 'downtime'] as const;
const META_TAGS = ['important', 'follow-up', 'plot-hook', 'lore', 'treasure'] as const;
const TYPE_TAGS = ['npc', 'location', 'rumor', 'quest', 'loot', 'skill-check', 'spell', 'ability', 'death', 'rest'] as const;

const PREDEFINED_TAGS = [...MOOD_TAGS, ...SCENE_TAGS, ...META_TAGS, ...TYPE_TAGS];

interface TagPickerProps {
  selected: string[];
  onToggle: (tag: string) => void;
  /** Previously created custom tags to show alongside predefined ones */
  customTags?: string[];
  /** Callback when a new custom tag is created (for persisting to campaign storage) */
  onCreateTag?: (tag: string) => void;
}

export function TagPicker({ selected, onToggle, customTags = [], onCreateTag }: TagPickerProps) {
  const [inputValue, setInputValue] = useState('');

  const allTags = [...PREDEFINED_TAGS, ...customTags.filter(t => !PREDEFINED_TAGS.includes(t as never))];

  const handleAddCustomTag = () => {
    const normalized = inputValue.trim().toLowerCase().replace(/\s+/g, '-');
    if (!normalized) return;

    // If it matches a predefined tag, just toggle it
    if (PREDEFINED_TAGS.includes(normalized as never)) {
      onToggle(normalized);
      setInputValue('');
      return;
    }

    // Otherwise create and toggle the new tag
    onToggle(normalized);
    onCreateTag?.(normalized);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustomTag();
    }
  };

  return (
    <div style={{ marginBottom: '10px' }}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
        Tags
      </p>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
        {allTags.map(tag => (
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
      {/* Custom tag input */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          type="text"
          placeholder="Add custom tag..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            padding: '6px 10px',
            minHeight: '44px',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            color: 'var(--color-text)',
            fontSize: '12px',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handleAddCustomTag}
          disabled={!inputValue.trim()}
          style={{
            minHeight: '44px',
            padding: '0 12px',
            background: 'var(--color-accent)',
            color: 'var(--color-on-accent, #fff)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: !inputValue.trim() ? 0.5 : 1,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
