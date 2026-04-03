import { useState } from 'react';

/** Mood-related tags describing the emotional tone of a session moment. */
const MOOD_TAGS = ['tense', 'funny', 'dramatic', 'sad', 'victorious'] as const;

/** Scene-type tags categorising the kind of encounter or activity. */
const SCENE_TAGS = ['combat', 'exploration', 'social', 'mystery', 'travel', 'downtime'] as const;

/** Meta-organisational tags for follow-up, plotting, and campaign bookkeeping. */
const META_TAGS = ['important', 'follow-up', 'plot-hook', 'lore', 'treasure'] as const;

/** Content-type tags identifying the primary subject of a note. */
const TYPE_TAGS = ['npc', 'location', 'rumor', 'quest', 'loot', 'skill-check', 'spell', 'ability', 'death', 'rest'] as const;

/**
 * Flat array of all built-in predefined tags, combining mood, scene, meta, and
 * type categories. Used to deduplicate against custom tags and to drive the
 * chip list rendered by {@link TagPicker}.
 */
const PREDEFINED_TAGS = [...MOOD_TAGS, ...SCENE_TAGS, ...META_TAGS, ...TYPE_TAGS];

/**
 * Props for the {@link TagPicker} component.
 */
interface TagPickerProps {
  /** Array of tag strings that are currently selected/active. */
  selected: string[];
  /**
   * Callback invoked when a tag chip is pressed.
   * The caller is responsible for adding or removing the tag from `selected`.
   *
   * @param tag - The tag string that was toggled.
   */
  onToggle: (tag: string) => void;
  /** Previously created custom tags to show alongside predefined ones. */
  customTags?: string[];
  /**
   * Callback when a new custom tag is created (for persisting to campaign storage).
   * Not called when the typed value matches an existing predefined tag.
   *
   * @param tag - The normalised (lowercase, hyphenated) new tag string.
   */
  onCreateTag?: (tag: string) => void;
}

/**
 * Interactive tag selector used on note forms throughout the app.
 *
 * @remarks
 * Renders a scrollable row of pill chips for all predefined tags plus any
 * campaign-specific custom tags. Tapping a chip calls `onToggle` with the tag
 * string; the caller owns the selection state.
 *
 * Below the chip row is a text input that lets users create new custom tags.
 * Input is normalised to lowercase with spaces replaced by hyphens before
 * being passed to `onToggle` (and optionally `onCreateTag`). If the typed
 * value matches an existing predefined tag, the predefined chip is simply
 * toggled instead of creating a new custom entry.
 *
 * Submission is possible via the **+** button or by pressing **Enter** while
 * the input is focused.
 *
 * @param selected - Tags that are currently active (highlighted).
 * @param onToggle - Called with a tag string whenever a chip or the add button
 *   is activated.
 * @param customTags - Extra tags from campaign storage shown after the
 *   predefined chips. Defaults to `[]`.
 * @param onCreateTag - Optional persistence callback for genuinely new tags.
 *
 * @example
 * const [tags, setTags] = useState<string[]>([]);
 *
 * <TagPicker
 *   selected={tags}
 *   onToggle={tag =>
 *     setTags(prev =>
 *       prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
 *     )
 *   }
 *   customTags={campaign.customTags}
 *   onCreateTag={tag => addCustomTagToCampaign(tag)}
 * />
 */
export function TagPicker({ selected, onToggle, customTags = [], onCreateTag }: TagPickerProps) {
  const [inputValue, setInputValue] = useState('');

  /** Merge predefined tags with campaign custom tags, deduplicating against the predefined list. */
  const allTags = [...PREDEFINED_TAGS, ...customTags.filter(t => !PREDEFINED_TAGS.includes(t as never))];

  /**
   * Normalises the current input value and either toggles a matching predefined
   * tag or creates and toggles a new custom tag.
   *
   * Normalisation: trim whitespace, lowercase, replace runs of spaces with `-`.
   * No-op if the normalised string is empty.
   */
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

  /**
   * Submits the custom tag input when the user presses **Enter**.
   *
   * @param e - The keyboard event from the tag input element.
   */
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
