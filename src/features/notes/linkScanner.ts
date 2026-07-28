/**
 * Suggestion engine for auto-linking free-form note text to campaign entities.
 *
 * Builds a dictionary from party members, NPC creature templates, and note
 * titles, then scans note text for whole-word exact matches and fuzzy
 * matches. The fuzzy edit-distance tolerance scales with the dictionary
 * name's length (see `fuzzyThresholdFor`) so short names like "Al" or "Kai"
 * don't attract spurious matches. Also flags capitalised names that appear
 * 2+ times in the text with no dictionary entry as "missing record"
 * candidates, subject to the same minimum-length guard.
 */

export type LinkScanEntityType = 'character' | 'creature' | 'note';

export interface LinkScanDictionaryEntry {
  /** Display name to match against note text. */
  name: string;
  /** The entity this name resolves to. */
  entityId: string;
  entityType: LinkScanEntityType;
}

export interface PartyMemberDictionaryInput {
  characterId: string;
  characterName: string;
}

export interface CreatureTemplateDictionaryInput {
  id: string;
  name: string;
  category: string;
}

export interface NoteDictionaryInput {
  id: string;
  title: string;
}

export interface LinkScanSuggestion {
  /** The exact substring matched in the source text. */
  matchedText: string;
  /** The entity the match resolves to, or null for a missing-record candidate. */
  target: { entityId: string; entityType: LinkScanEntityType } | null;
  /** 'exact' for whole-word literal matches, 'fuzzy' for edit-distance matches. */
  confidence: 'exact' | 'fuzzy';
  /** True when this suggestion represents a name with no existing dictionary entry. */
  isMissingRecord: boolean;
  /** Stable key used for dismissal lookups. */
  key: string;
}

const WORD_PATTERN = /[A-Za-z0-9']+/g;

function levenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const prev = new Array<number>(bl + 1);
  const curr = new Array<number>(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;

  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    for (let j = 0; j <= bl; j++) prev[j] = curr[j];
  }
  return prev[bl];
}

/** Builds the scan dictionary from party members, NPC creature templates, and note titles. */
export function buildLinkScanDictionary(input: {
  partyMembers: PartyMemberDictionaryInput[];
  creatureTemplates: CreatureTemplateDictionaryInput[];
  notes: NoteDictionaryInput[];
}): LinkScanDictionaryEntry[] {
  const entries: LinkScanDictionaryEntry[] = [];

  for (const member of input.partyMembers) {
    if (!member.characterName) continue;
    entries.push({
      name: member.characterName,
      entityId: member.characterId,
      entityType: 'character',
    });
  }

  for (const creature of input.creatureTemplates) {
    if (creature.category !== 'npc') continue;
    entries.push({
      name: creature.name,
      entityId: creature.id,
      entityType: 'creature',
    });
  }

  for (const note of input.notes) {
    if (!note.title) continue;
    entries.push({
      name: note.title,
      entityId: note.id,
      entityType: 'note',
    });
  }

  return entries;
}

interface WordToken {
  word: string;
  start: number;
  end: number;
}

function tokenize(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  let match: RegExpExecArray | null;
  WORD_PATTERN.lastIndex = 0;
  while ((match = WORD_PATTERN.exec(text)) !== null) {
    tokens.push({ word: match[0], start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

function isCapitalised(word: string): boolean {
  return /^[A-Z]/.test(word);
}

const PURELY_NUMERIC_PATTERN = /^\d+$/;

function isPurelyNumeric(word: string): boolean {
  return PURELY_NUMERIC_PATTERN.test(word);
}

/**
 * Length-scaled fuzzy edit-distance ceiling for a dictionary name, per the
 * link-scanner spec (sub-spec-05-link-scanner.md):
 *
 * - Names shorter than 3 characters never match at all (neither exact-fuzzy
 *   nor missing-record) — returns `null`.
 * - Names 3-4 characters: fuzzy edit distance <= 1.
 * - Names 5+ characters: fuzzy edit distance <= 2.
 *
 * A caller-supplied `fuzzyMaxDistance` (if provided) further caps whichever
 * of these ceilings would otherwise apply.
 */
function fuzzyThresholdFor(name: string, cap: number): number | null {
  if (name.length < 3) return null;
  const base = name.length <= 4 ? 1 : 2;
  return Math.min(base, cap);
}

export interface ScanForLinksOptions {
  text: string;
  dictionary: LinkScanDictionaryEntry[];
  /** Keys (see LinkScanSuggestion.key) that the user has already dismissed. */
  dismissed?: string[];
  /** Max edit distance for fuzzy matching. Defaults to 2. */
  fuzzyMaxDistance?: number;
}

/**
 * Scans note text for entity-link suggestions.
 *
 * Matching is whole-word: a dictionary name only matches a token boundary,
 * never as a substring of a longer word. Multi-word dictionary names are
 * matched against the same substring of raw text on word boundaries.
 */
export function scanForLinks(options: ScanForLinksOptions): LinkScanSuggestion[] {
  const { text, dictionary } = options;
  const dismissed = new Set(options.dismissed ?? []);
  const fuzzyMaxDistance = options.fuzzyMaxDistance ?? 2;

  const tokens = tokenize(text);
  const suggestions: LinkScanSuggestion[] = [];
  const seenKeys = new Set<string>();

  // Single-word dictionary entries (exact + fuzzy) matched per-token.
  const singleWordDictionary = dictionary.filter((entry) => !entry.name.includes(' '));
  const multiWordDictionary = dictionary.filter((entry) => entry.name.includes(' '));

  for (const token of tokens) {
    let exactEntry: LinkScanDictionaryEntry | undefined;
    let fuzzyEntry: LinkScanDictionaryEntry | undefined;
    let fuzzyDistance = Infinity;

    for (const entry of singleWordDictionary) {
      // Names shorter than 3 characters never match at all — neither exact
      // nor fuzzy — to avoid short fragments like "Al" or "PM" matching
      // arbitrary tokens.
      const threshold = fuzzyThresholdFor(entry.name, fuzzyMaxDistance);
      if (threshold === null) continue;

      if (entry.name.toLowerCase() === token.word.toLowerCase()) {
        exactEntry = entry;
        break;
      }
      const distance = levenshtein(entry.name, token.word);
      if (distance <= threshold && distance < fuzzyDistance) {
        fuzzyEntry = entry;
        fuzzyDistance = distance;
      }
    }

    if (exactEntry) {
      const key = `${exactEntry.entityType}:${exactEntry.entityId}:${token.word.toLowerCase()}`;
      if (!dismissed.has(key) && !seenKeys.has(key)) {
        seenKeys.add(key);
        suggestions.push({
          matchedText: token.word,
          target: { entityId: exactEntry.entityId, entityType: exactEntry.entityType },
          confidence: 'exact',
          isMissingRecord: false,
          key,
        });
      }
    } else if (fuzzyEntry) {
      const key = `${fuzzyEntry.entityType}:${fuzzyEntry.entityId}:${token.word.toLowerCase()}`;
      if (!dismissed.has(key) && !seenKeys.has(key)) {
        seenKeys.add(key);
        suggestions.push({
          matchedText: token.word,
          target: { entityId: fuzzyEntry.entityId, entityType: fuzzyEntry.entityType },
          confidence: 'fuzzy',
          isMissingRecord: false,
          key,
        });
      }
    }
  }

  // Multi-word dictionary entries: exact phrase match on word boundaries.
  for (const entry of multiWordDictionary) {
    const escaped = entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const phraseRegex = new RegExp(`\\b${escaped}\\b`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = phraseRegex.exec(text)) !== null) {
      const key = `${entry.entityType}:${entry.entityId}:${match[0].toLowerCase()}`;
      if (dismissed.has(key) || seenKeys.has(key)) continue;
      seenKeys.add(key);
      suggestions.push({
        matchedText: match[0],
        target: { entityId: entry.entityId, entityType: entry.entityType },
        confidence: 'exact',
        isMissingRecord: false,
        key,
      });
    }
  }

  // Missing-record candidates: capitalised words appearing 2+ times with no
  // dictionary entry (exact or fuzzy) at all, and at least 3 characters
  // long, and not purely numeric (timestamp/id fragments like "PM" or "27"
  // must never surface as "create this NPC?" candidates).
  const dictionaryNamesLower = new Set(dictionary.map((entry) => entry.name.toLowerCase()));

  // Individual words of multi-word dictionary names. Most NPCs are recorded
  // under a full name ("Dorgan the Blacksmith", "Sir Aldric Vane") but referred
  // to at the table by one part of it. Without this, every recurrence of
  // "Dorgan" is offered as "create this NPC?" for an NPC that already exists —
  // which fires constantly and trains the user to ignore the panel.
  const dictionaryWordsLower = new Set<string>();
  for (const entry of dictionary) {
    if (!entry.name.includes(' ')) continue;
    for (const part of entry.name.toLowerCase().split(/\s+/)) {
      if (part.length >= 3) dictionaryWordsLower.add(part);
    }
  }

  const capitalisedCounts = new Map<string, { count: number; sample: string }>();

  for (const token of tokens) {
    if (!isCapitalised(token.word)) continue;
    if (token.word.length < 3) continue;
    if (isPurelyNumeric(token.word)) continue;
    const lower = token.word.toLowerCase();
    if (dictionaryNamesLower.has(lower)) continue;
    if (dictionaryWordsLower.has(lower)) continue;

    const hasFuzzyDictionaryMatch = dictionary.some((entry) => {
      if (entry.name.includes(' ')) return false;
      const threshold = fuzzyThresholdFor(entry.name, fuzzyMaxDistance);
      if (threshold === null) return false;
      return levenshtein(entry.name, token.word) <= threshold;
    });
    if (hasFuzzyDictionaryMatch) continue;

    const existing = capitalisedCounts.get(lower);
    if (existing) {
      existing.count += 1;
    } else {
      capitalisedCounts.set(lower, { count: 1, sample: token.word });
    }
  }

  for (const [lower, { count, sample }] of capitalisedCounts) {
    if (count < 2) continue;
    const key = `missing:${lower}`;
    if (dismissed.has(key) || seenKeys.has(key)) continue;
    seenKeys.add(key);
    suggestions.push({
      matchedText: sample,
      target: null,
      confidence: 'exact',
      isMissingRecord: true,
      key,
    });
  }

  return suggestions;
}
