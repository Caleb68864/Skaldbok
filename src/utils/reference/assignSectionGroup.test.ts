import { describe, it, expect } from 'vitest';
import {
  assignSectionGroup,
  currentGroupFor,
  isPlaceholderGroup,
  PLACEHOLDER_GROUP_PREFIX,
} from './assignSectionGroup';
import type { ReferenceGroup, ReferenceSection } from '../../types/reference';

const group = (id: string, title: string): ReferenceGroup => ({
  id,
  title,
  order: 0,
  createdAt: 'x',
  updatedAt: 'x',
});

const section = (overrides: Partial<ReferenceSection> = {}): ReferenceSection =>
  ({
    id: 's1',
    title: 'Initiative',
    category: 'Combat',
    order: 0,
    type: 'rules_text',
    createdAt: 'x',
    updatedAt: 'x',
    ...overrides,
  }) as ReferenceSection;

describe('assignSectionGroup', () => {
  it('writes both the id join and the display label', () => {
    // Writing `category` alone was the bug: `groupId` has been authoritative
    // since v14, so the section never actually moved.
    const moved = assignSectionGroup(section({ groupId: 'g-combat' }), group('g-travel', 'Travel'));
    expect(moved.groupId).toBe('g-travel');
    expect(moved.category).toBe('Travel');
  });

  it('moves between two cards that share a title', () => {
    // "New Card" is the default title, so this collision is the common case
    // rather than a contrived one.
    const a = group('g-a', 'New Card');
    const b = group('g-b', 'New Card');
    const moved = assignSectionGroup(section({ groupId: a.id, category: 'New Card' }), b);
    expect(moved.groupId).toBe('g-b');
  });

  it('clears the id when assigned to a card with no row behind it', () => {
    // A placeholder card is synthesised at render time for an orphaned
    // category; storing its id would point the section at a row that does not
    // exist. The legacy category join carries it until a real card is made.
    const placeholder = group(`${PLACEHOLDER_GROUP_PREFIX}Overland`, 'Overland');
    const moved = assignSectionGroup(section({ groupId: 'g-combat' }), placeholder);
    expect(moved.groupId).toBeUndefined();
    expect(moved.category).toBe('Overland');
  });

  it('leaves the section alone when the card is unknown', () => {
    const original = section({ groupId: 'g-combat' });
    expect(assignSectionGroup(original, undefined)).toBe(original);
  });
});

describe('currentGroupFor', () => {
  const groups = [group('g-combat', 'Combat'), group('g-travel', 'Travel')];

  it('prefers the id join', () => {
    expect(currentGroupFor({ groupId: 'g-travel', category: 'Combat' }, groups)?.id).toBe('g-travel');
  });

  it('falls back to the category for a section written before v14', () => {
    expect(currentGroupFor({ groupId: undefined, category: 'Combat' }, groups)?.id).toBe('g-combat');
  });

  it('falls back to the category when the id points at a deleted card', () => {
    expect(currentGroupFor({ groupId: 'g-gone', category: 'Combat' }, groups)?.id).toBe('g-combat');
  });

  it('treats a blank category as General', () => {
    const withGeneral = [...groups, group('g-general', 'General')];
    expect(currentGroupFor({ groupId: undefined, category: '' }, withGeneral)?.id).toBe('g-general');
  });

  it('returns nothing when no card matches', () => {
    expect(currentGroupFor({ groupId: undefined, category: 'Nowhere' }, groups)).toBeUndefined();
  });
});

describe('isPlaceholderGroup', () => {
  it('recognises a synthesised card', () => {
    expect(isPlaceholderGroup(group(`${PLACEHOLDER_GROUP_PREFIX}Overland`, 'Overland'))).toBe(true);
    expect(isPlaceholderGroup(group('g-combat', 'Combat'))).toBe(false);
  });
});
