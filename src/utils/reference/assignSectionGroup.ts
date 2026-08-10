import type { ReferenceGroup, ReferenceSection } from '../../types/reference';

/**
 * Moves a section into a grouping card.
 *
 * @remarks
 * `groupId` is the authoritative join (schema v14); `category` is a denormalised
 * label kept beside it for display and for sections written before v14. Setting
 * one without the other is how the two disagree — and the editor's category
 * picker did exactly that, writing `category` alone, so changing a section's
 * card in the drawer moved nothing at all.
 *
 * A card the screen synthesised for an orphaned category has no row behind it
 * (its id is a `orphan-` placeholder built from the title). Assigning to one
 * clears `groupId` and leaves the legacy category join to carry the section
 * until `ensureGroupsForSections` materialises a real card for it — storing the
 * placeholder id would point the section at a row that does not exist.
 */
export function assignSectionGroup(
  section: ReferenceSection,
  group: ReferenceGroup | undefined,
): ReferenceSection {
  if (!group) return section;
  return {
    ...section,
    groupId: isPlaceholderGroup(group) ? undefined : group.id,
    category: group.title,
  };
}

/** Prefix used for cards synthesised at render time for an orphaned category. */
export const PLACEHOLDER_GROUP_PREFIX = 'orphan-';

/** Whether a group is a render-time placeholder rather than a stored row. */
export function isPlaceholderGroup(group: ReferenceGroup): boolean {
  return group.id.startsWith(PLACEHOLDER_GROUP_PREFIX);
}

/**
 * The card a section currently belongs to.
 *
 * @remarks
 * Prefers the id join and falls back to the category label, matching how the
 * screen decides what to render under each card. Used to seed the editor's
 * picker, which otherwise cannot show the current card for a pre-v14 section.
 */
export function currentGroupFor(
  section: Pick<ReferenceSection, 'groupId' | 'category'>,
  groups: ReferenceGroup[],
): ReferenceGroup | undefined {
  if (section.groupId) {
    const byId = groups.find(group => group.id === section.groupId);
    if (byId) return byId;
  }
  return groups.find(group => group.title === (section.category || 'General'));
}
