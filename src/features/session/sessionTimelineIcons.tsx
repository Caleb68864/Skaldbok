import { createElement, type ReactNode } from 'react';
import {
  BookOpen,
  Dices,
  Ear,
  Gem,
  MapPin,
  NotebookText,
  Quote,
  StickyNote,
  Swords,
  User,
} from 'lucide-react';

/**
 * Per-note-type icon mapping for the session timeline. Used for both the
 * item chip glyph and the track-row gutter glyph so the visual identity is
 * consistent between the single row and the per-type sub-rows.
 *
 * Kept in its own file so future consumers (the timeline details panel, the
 * Session Notes list, the KB graph) can import the same mapping and stay
 * visually aligned without each hardcoding its own switch statement.
 */
export function sessionTimelineIcon(kind: string, className = 'h-3.5 w-3.5 text-text-muted'): ReactNode {
  switch (kind) {
    case 'npc':
      return createElement(User, { className });
    case 'combat':
      return createElement(Swords, { className });
    case 'location':
      return createElement(MapPin, { className });
    case 'loot':
      return createElement(Gem, { className });
    case 'rumor':
      return createElement(Ear, { className });
    case 'quote':
      return createElement(Quote, { className });
    case 'skill-check':
      return createElement(Dices, { className });
    case 'recap':
      return createElement(BookOpen, { className });
    case 'notes':
      return createElement(NotebookText, { className });
    case 'generic':
    default:
      return createElement(StickyNote, { className });
  }
}
