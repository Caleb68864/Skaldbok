import { useCallback, useRef, useEffect } from 'react';
import { extractDescriptors } from '../../utils/notes/extractDescriptors';
import type { Note } from '../../types/note';

/**
 * Hook: builds a frequency map of descriptor labels from campaign notes.
 * - Loads on mount when campaignNotes are provided.
 * - Returns a getSuggestions(query) function that filters and sorts by frequency.
 * - Frequency map is in-memory; append new descriptors on save via appendDescriptors().
 */
export function useDescriptorSuggestions(campaignNotes: Note[]) {
  // In-memory frequency map: label -> count
  const freqMap = useRef<Map<string, number>>(new Map());
  const initialized = useRef(false);

  // Build frequency map once when campaignNotes become available (or change)
  useEffect(() => {
    if (campaignNotes.length === 0 && initialized.current) return;
    const map = new Map<string, number>();
    for (const note of campaignNotes) {
      const labels = extractDescriptors(note.body);
      for (const label of labels) {
        const lower = label.toLowerCase();
        map.set(lower, (map.get(lower) ?? 0) + 1);
      }
    }
    freqMap.current = map;
    initialized.current = true;
  }, [campaignNotes]);

  /**
   * Append new descriptor labels to the in-memory map without reloading all notes.
   * Call this after saving a note with new descriptors.
   */
  const appendDescriptors = useCallback((labels: string[]) => {
    for (const label of labels) {
      const lower = label.toLowerCase();
      freqMap.current.set(lower, (freqMap.current.get(lower) ?? 0) + 1);
    }
  }, []);

  /**
   * Return suggestions matching the current # query, ranked by frequency descending.
   * Always returns an array of strings (descriptor word labels).
   */
  const getSuggestions = useCallback((query: string): string[] => {
    const q = query.toLowerCase();
    const entries = Array.from(freqMap.current.entries());

    // Filter by prefix match (or return all if query is empty)
    const filtered = q
      ? entries.filter(([label]) => label.startsWith(q) || label.includes(q))
      : entries;

    // Sort by frequency descending, then alphabetically
    filtered.sort((a, b) => {
      const freqDiff = b[1] - a[1];
      if (freqDiff !== 0) return freqDiff;
      return a[0].localeCompare(b[0]);
    });

    return filtered.slice(0, 10).map(([label]) => label);
  }, []);

  return { getSuggestions, appendDescriptors };
}
