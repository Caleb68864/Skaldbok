/**
 * State hook for the Command Palette overlay.
 *
 * @returns `{ isOpen, open, close }` — controls for the palette visibility.
 */

import { useState, useCallback } from 'react';

/** Visibility controls returned by {@link useCommandPalette}. */
export interface UseCommandPaletteReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/**
 * Owns the open/closed state of the {@link features/kb/CommandPalette!CommandPalette | CommandPalette} overlay.
 *
 * @returns `{ isOpen, open, close }`.
 */
export function useCommandPalette(): UseCommandPaletteReturn {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return { isOpen, open, close };
}
