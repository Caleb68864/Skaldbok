import { useState, useCallback } from 'react';
import MiniSearch from 'minisearch';
import type { Note } from '../../types/note';
import { extractText } from '../../utils/prosemirror';

interface IndexedDoc {
  id: string;
  title: string;
  bodyText: string;
  tags: string;
  type: string;
}

// Module-level singleton: persists across renders, not across page reloads
const searchIndex = new MiniSearch<IndexedDoc>({
  fields: ['title', 'bodyText', 'tags'],
  storeFields: ['title', 'type'],
  searchOptions: {
    boost: { title: 2, tags: 1.5, bodyText: 1 },
    fuzzy: 0.2,
    prefix: true,
  },
});

function noteToDoc(note: Note): IndexedDoc {
  return {
    id: note.id,
    title: note.title,
    bodyText: extractText(note.body),
    tags: (note.tags ?? []).join(' '),
    type: note.type,
  };
}

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

  const updateInIndex = useCallback((note: Note): void => {
    if (searchIndex.has(note.id)) {
      searchIndex.remove({ id: note.id } as IndexedDoc);
    }
    searchIndex.add(noteToDoc(note));
  }, []);

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
