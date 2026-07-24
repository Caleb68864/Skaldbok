import { useState, useCallback } from 'react';
import MiniSearch from 'minisearch';
import type { Note } from '../../types/note';
import { extractText } from '../../utils/prosemirror';
import { extractDescriptors } from '../../utils/notes/extractDescriptors';

/** The flattened, searchable projection of a note fed to MiniSearch (rich body reduced to plain text). */
interface IndexedDoc {
  id: string;
  title: string;
  bodyText: string;
  tags: string;
  type: string;
  descriptors: string;
}

// Module-level singleton: persists across renders, not across page reloads
const searchIndex = new MiniSearch<IndexedDoc>({
  fields: ['title', 'bodyText', 'tags', 'descriptors'],
  storeFields: ['title', 'type'],
  searchOptions: {
    boost: { title: 2, tags: 1.5, descriptors: 1.5, bodyText: 1 },
    fuzzy: 0.2,
    prefix: true,
  },
});

/** Flattens a {@link Note} into an {@link IndexedDoc}: extracts plain text and descriptors from the ProseMirror body and joins tags. */
function noteToDoc(note: Note): IndexedDoc {
  return {
    id: note.id,
    title: note.title,
    bodyText: extractText(note.body),
    tags: (note.tags ?? []).join(' '),
    type: note.type,
    descriptors: extractDescriptors(note.body).join(' '),
  };
}

/**
 * Full-text note search backed by a MiniSearch index, with incremental maintenance.
 *
 * @remarks
 * The index is a module-level singleton, so it survives component remounts but not a
 * page reload — {@link rebuildIndex} must be called after load to repopulate it.
 * Title/tags/descriptors are boosted over body text and matching is fuzzy + prefix so
 * partial and slightly misspelled queries still hit. `add`/`update` guard against
 * duplicate ids by removing first, keeping the index consistent as notes change.
 */
export function useNoteSearch() {
  const [isIndexed, setIsIndexed] = useState(false);

  const rebuildIndex = useCallback((notes: Note[]): void => {
    searchIndex.removeAll();
    const docs = notes.map(noteToDoc);
    searchIndex.addAll(docs);
    setIsIndexed(true);
  }, []);

  const addToIndex = useCallback((note: Note): void => {
    // Remove if already present to avoid duplicate-id errors
    if (searchIndex.has(note.id)) {
      searchIndex.remove({ id: note.id } as IndexedDoc);
    }
    searchIndex.add(noteToDoc(note));
  }, []);

  const updateInIndex = addToIndex;

  const removeFromIndex = useCallback((id: string): void => {
    if (searchIndex.has(id)) {
      searchIndex.remove({ id } as IndexedDoc);
    }
  }, []);

  const search = useCallback(
    (query: string, options?: { filter?: (result: ReturnType<typeof searchIndex.search>[number]) => boolean }) => {
      if (!query.trim() || !isIndexed) return [];
      return searchIndex.search(query, { filter: options?.filter });
    },
    [isIndexed],
  );

  return {
    search,
    rebuildIndex,
    addToIndex,
    updateInIndex,
    removeFromIndex,
    isIndexed,
  };
}
