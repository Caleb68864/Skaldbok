import { describe, expect, it } from 'vitest';
import { buildLinkScanDictionary, scanForLinks, type LinkScanDictionaryEntry } from './linkScanner';

const dictionary: LinkScanDictionaryEntry[] = [
  { name: 'Ostrand', entityId: 'char-1', entityType: 'character' },
  { name: 'Goblin Warlord', entityId: 'creature-1', entityType: 'creature' },
];

describe('scanForLinks', () => {
  it('produces an exact suggestion for a whole-word dictionary match', () => {
    const suggestions = scanForLinks({ text: 'we met Ostrand at the tavern', dictionary });
    const exact = suggestions.find((s) => s.matchedText === 'Ostrand');
    expect(exact).toBeDefined();
    expect(exact?.confidence).toBe('exact');
    expect(exact?.target).toEqual({ entityId: 'char-1', entityType: 'character' });
  });

  it('produces a fuzzy suggestion for a name within edit distance 2', () => {
    const suggestions = scanForLinks({ text: 'met 0strand today', dictionary });
    const fuzzy = suggestions.find((s) => s.target?.entityId === 'char-1');
    expect(fuzzy).toBeDefined();
    expect(fuzzy?.confidence).toBe('fuzzy');
  });

  it('does not match a name that is a substring of a longer word', () => {
    const suggestions = scanForLinks({ text: 'Ostrandville was quiet', dictionary });
    expect(suggestions.find((s) => s.target?.entityId === 'char-1')).toBeUndefined();
  });

  it('matches multi-word dictionary entries on whole-word phrase boundaries', () => {
    const suggestions = scanForLinks({ text: 'the Goblin Warlord attacked', dictionary });
    const match = suggestions.find((s) => s.target?.entityId === 'creature-1');
    expect(match).toBeDefined();
    expect(match?.confidence).toBe('exact');
    expect(match?.matchedText).toBe('Goblin Warlord');
  });

  it('excludes suggestions whose key is in the dismissed list', () => {
    const initial = scanForLinks({ text: 'we met Ostrand at the tavern', dictionary });
    const exact = initial.find((s) => s.matchedText === 'Ostrand');
    expect(exact).toBeDefined();

    const filtered = scanForLinks({
      text: 'we met Ostrand at the tavern',
      dictionary,
      dismissed: [exact!.key],
    });
    expect(filtered.find((s) => s.matchedText === 'Ostrand')).toBeUndefined();
  });

  it('flags a capitalised name appearing twice with no dictionary entry as a missing-record candidate', () => {
    const suggestions = scanForLinks({
      text: 'Brannoch entered the hall. Later, Brannoch left again.',
      dictionary,
    });
    const missing = suggestions.find((s) => s.matchedText === 'Brannoch');
    expect(missing).toBeDefined();
    expect(missing?.isMissingRecord).toBe(true);
    expect(missing?.target).toBeNull();
  });

  it('does not flag a capitalised name appearing only once as missing', () => {
    const suggestions = scanForLinks({ text: 'Brannoch entered the hall.', dictionary });
    expect(suggestions.find((s) => s.matchedText === 'Brannoch')).toBeUndefined();
  });

  describe('length-scaled fuzzy thresholds', () => {
    it('never matches a 2-character dictionary name against any token', () => {
      const shortDictionary: LinkScanDictionaryEntry[] = [
        { name: 'Al', entityId: 'char-al', entityType: 'character' },
      ];
      const suggestions = scanForLinks({
        text: 'we saw 7 27 PM 00 al Al al.',
        dictionary: shortDictionary,
      });
      expect(suggestions.filter((s) => s.target?.entityId === 'char-al')).toHaveLength(0);
    });

    it('does not fuzzy-match a 3-4 char name at edit distance 2 (only <=1 allowed)', () => {
      const shortDictionary: LinkScanDictionaryEntry[] = [
        { name: 'Kai', entityId: 'char-kai', entityType: 'character' },
      ];
      // "Kbx" is edit distance 2 from "Kai" (two substitutions) and must not match.
      const distance2 = scanForLinks({ text: 'we met Kbx today', dictionary: shortDictionary });
      expect(distance2.find((s) => s.target?.entityId === 'char-kai')).toBeUndefined();

      // "Kax" is edit distance 1 from "Kai" (one substitution) and should match.
      const distance1 = scanForLinks({ text: 'we met Kax today', dictionary: shortDictionary });
      const match = distance1.find((s) => s.target?.entityId === 'char-kai');
      expect(match).toBeDefined();
      expect(match?.confidence).toBe('fuzzy');
    });

    it('fuzzy-matches a 5+ char name at edit distance 2', () => {
      const longDictionary: LinkScanDictionaryEntry[] = [
        { name: 'Torvald', entityId: 'char-torvald', entityType: 'character' },
      ];
      // "Torvaxx" is edit distance 2 from "Torvald" (two substitutions).
      const suggestions = scanForLinks({ text: 'we met Torvaxx today', dictionary: longDictionary });
      const match = suggestions.find((s) => s.target?.entityId === 'char-torvald');
      expect(match).toBeDefined();
      expect(match?.confidence).toBe('fuzzy');
    });

    it('still fuzzy-matches the handwriting-error case (0strand -> Ostrand, 5+ chars)', () => {
      const suggestions = scanForLinks({ text: 'met 0strand today', dictionary });
      const match = suggestions.find((s) => s.target?.entityId === 'char-1');
      expect(match).toBeDefined();
      expect(match?.confidence).toBe('fuzzy');
    });
  });

  it('returns no suggestions and does not throw for an empty dictionary', () => {
    expect(() => {
      const suggestions = scanForLinks({ text: 'Brannoch met Ostrand near the 0strand ruins.', dictionary: [] });
      expect(suggestions).toEqual([]);
    }).not.toThrow();
  });

  it('never surfaces a purely numeric token as a missing-record candidate', () => {
    const suggestions = scanForLinks({ text: '27 arrived. Later, 27 left again. 00 00.', dictionary: [] });
    expect(suggestions.filter((s) => s.isMissingRecord)).toHaveLength(0);
  });
});

describe('multi-word dictionary names', () => {
  const dictionary: LinkScanDictionaryEntry[] = [
    { name: 'Dorgan the Blacksmith', entityId: 'creature-1', entityType: 'creature' },
  ];

  // Most NPCs are recorded under a full name but referred to at the table by
  // one part of it. Without a guard, every recurrence of "Dorgan" is offered
  // as "create this NPC?" for an NPC that already exists — which fires every
  // session and trains the user to ignore the panel entirely.
  it('does not offer a word of an existing multi-word name as a missing record', () => {
    const suggestions = scanForLinks({
      text: 'Dorgan waved. Later, Dorgan left.',
      dictionary,
    });
    const missing = suggestions.filter(s => s.isMissingRecord);
    expect(missing).toHaveLength(0);
  });

  it('still offers a genuinely unknown repeated name as a missing record', () => {
    const suggestions = scanForLinks({
      text: 'Halvard waved. Later, Halvard left.',
      dictionary,
    });
    expect(suggestions.some(s => s.isMissingRecord && /halvard/i.test(s.matchedText))).toBe(true);
  });
});

describe('buildLinkScanDictionary', () => {
  it('includes party members, NPC creature templates, and note titles', () => {
    const dict = buildLinkScanDictionary({
      partyMembers: [{ characterId: 'char-1', characterName: 'Ostrand' }],
      creatureTemplates: [
        { id: 'creature-1', name: 'Goblin Warlord', category: 'npc' },
        { id: 'creature-2', name: 'Wolf', category: 'beast' },
      ],
      notes: [{ id: 'note-1', title: 'The Sunken Shrine' }],
    });

    expect(dict).toContainEqual({ name: 'Ostrand', entityId: 'char-1', entityType: 'character' });
    expect(dict).toContainEqual({ name: 'Goblin Warlord', entityId: 'creature-1', entityType: 'creature' });
    expect(dict).toContainEqual({ name: 'The Sunken Shrine', entityId: 'note-1', entityType: 'note' });
    expect(dict.find((entry) => entry.entityId === 'creature-2')).toBeUndefined();
  });
});
