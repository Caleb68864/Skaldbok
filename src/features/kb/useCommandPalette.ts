/**
 * State hook for the Command Palette overlay.
 *
 * @returns `{ isOpen, open, close }` — controls for the palette visibility.
 */

import { useState, useCallback } from 'react';

export interface UseCommandPaletteReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export function useCommandPalette(): UseCommandPaletteReturn {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return { isOpen, open, close };
}
