import { SectionPanel } from '../../components/primitives/SectionPanel';
import type { PlayModuleProps } from './types';

/**
 * Player-facing roleplay prompts, surfaced on the Play page so a story beat is a
 * glance away mid-scene.
 *
 * @remarks
 * Read-only and hidden when the character has no beats, so it never clutters a
 * sheet that does not use them. Editing happens on the character sheet.
 */
export function StoryBankModule({ character }: PlayModuleProps) {
  const beats = character.storyBank ?? [];
  if (beats.length === 0) return null;

  return (
    <SectionPanel title="Story Bank" collapsible defaultOpen={false}>
      <div className="flex flex-col gap-[var(--space-xs)]">
        {beats.map(beat => (
          <div
            key={beat.id}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-[var(--color-border)] pb-[var(--space-xs)] last:border-b-0 last:pb-0"
          >
            {beat.cue && (
              <span className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] px-1.5 py-0.5 text-[length:var(--font-size-sm)] font-semibold text-[var(--color-accent)]">
                {beat.cue}
              </span>
            )}
            <span className="text-[length:var(--font-size-md)] text-[var(--color-text)]">{beat.text}</span>
          </div>
        ))}
      </div>
    </SectionPanel>
  );
}
