import { useState } from 'react';
import { cn } from '../../lib/utils';

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
    <div className="mb-2.5">
      <p className="text-[var(--color-text-muted)] text-[11px] uppercase tracking-[0.05em] mb-1">
        Tags
      </p>
      <div className="flex gap-2 flex-wrap mb-2">
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            className={cn(
              "min-h-11 min-w-11 px-2 rounded-[15px] border-none cursor-pointer text-[11px] font-semibold",
              selected.includes(tag)
                ? "bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]"
                : "bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]"
            )}
          >
            {tag}
          </button>
        ))}
      </div>
      {/* Custom tag input */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Add custom tag..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-2.5 py-1.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-xs box-border"
        />
        <button
          onClick={handleAddCustomTag}
          disabled={!inputValue.trim()}
          className={cn(
            "min-h-11 px-3 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-[13px] font-semibold cursor-pointer",
            !inputValue.trim() ? "opacity-50" : "opacity-100"
          )}
        >
          +
        </button>
      </div>
    </div>
  );
}
