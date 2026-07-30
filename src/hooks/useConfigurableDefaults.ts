import { useMemo } from 'react';
import { useAppState } from '../context/AppStateContext';
import { DEFAULT_INVENTORY_CONTAINER_KINDS } from '../config/defaults/inventoryContainerKinds';
import { DEFAULT_TAG_PRESETS } from '../config/defaults/tagPresets';
import type { InventoryContainerKindConfig } from '../config/defaults/inventoryContainerKinds';
import type { TagPresetGroup } from '../config/defaults/tagPresets';

/**
 * Selector layer for user-facing groupings that live in configuration.
 *
 * @remarks
 * CLAUDE.md's "Configuration Over Hardcoding" rule has three steps: a default in
 * `src/config/defaults/*`, the current value in the settings store, and a
 * **hook or selector** the component reads — "never import the default constant
 * directly from the component". Only the first step existed, so components
 * imported the defaults and step three had nowhere to live. This is that layer.
 *
 * Each hook returns the stored override when the user has one and the bundled
 * default otherwise, so a future preferences screen only has to write settings —
 * no component changes.
 */

/**
 * Container kinds offered when creating a party inventory container.
 *
 * @returns The user's configured kinds, or the bundled defaults.
 */
export function useInventoryContainerKinds(): InventoryContainerKindConfig[] {
  const { settings } = useAppState();
  const stored = settings.inventoryContainerKinds;
  return useMemo(
    () => (stored && stored.length > 0 ? stored : DEFAULT_INVENTORY_CONTAINER_KINDS),
    [stored],
  );
}

/**
 * Tag presets offered by the tag picker, grouped for display.
 *
 * @remarks
 * Campaign-scoped custom tags are a separate, already-existing setting
 * (`customTags`); this is the preset palette itself, which was four hardcoded
 * arrays inside the picker.
 *
 * @returns The user's configured preset groups, or the bundled defaults.
 */
export function useTagPresets(): TagPresetGroup[] {
  const { settings } = useAppState();
  const stored = settings.tagPresets;
  return useMemo(
    () => (stored && stored.length > 0 ? stored : DEFAULT_TAG_PRESETS),
    [stored],
  );
}
