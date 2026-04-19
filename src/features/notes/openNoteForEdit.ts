import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNoteById } from '../../storage/repositories/noteRepository';
import type { Note } from '../../types/note';

/**
 * Hook that returns (a) a `dispatch(noteId)` function to call when the user
 * taps a note anywhere in the UI, and (b) the currently active skill-check
 * editor state for the caller to render.
 *
 * The dispatcher inspects `note.type` and either:
 *   - for `'skill-check'`, opens the in-place structural editor, or
 *   - for every other type, navigates to `/note/:id/edit` (the Tiptap editor).
 *
 * Keeping the state local to the caller avoids threading another global
 * context through CampaignProvider. The Notes grid and the Session timeline
 * each instantiate their own hook + drawer.
 */
export function useNoteOpenDispatcher() {
  const navigate = useNavigate();
  const [skillCheckNote, setSkillCheckNote] = useState<Note | null>(null);

  const openNote = useCallback(
    async (noteId: string) => {
      try {
        const note = await getNoteById(noteId);
        if (!note) {
          navigate(`/note/${noteId}/edit`);
          return;
        }
        if (note.type === 'skill-check' || note.type === 'spell-cast' || note.type === 'ability-use') {
          setSkillCheckNote(note);
          return;
        }
        navigate(`/note/${noteId}/edit`);
      } catch {
        navigate(`/note/${noteId}/edit`);
      }
    },
    [navigate],
  );

  const closeSkillCheckEditor = useCallback(() => setSkillCheckNote(null), []);

  return { openNote, skillCheckNote, closeSkillCheckEditor };
}
