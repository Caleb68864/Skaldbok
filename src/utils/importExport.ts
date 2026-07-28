import { migrateCharacter } from './migrations';
import * as characterRepository from '../storage/repositories/characterRepository';
import { generateId } from './ids';
import { nowISO } from './dates';
import { BUNDLED_SYSTEMS } from '../systems/registry';
import type { CharacterRecord } from '../types/character';

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'character';
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '');
}

/**
 * System ids we know how to render, derived from the bundled system registry so
 * adding a third system doesn't silently warn on import.
 */
const KNOWN_SYSTEM_IDS: string[] = BUNDLED_SYSTEMS.map(s => s.id);
const SYSTEM_ID_ALIASES: Record<string, string> = {
  'classic-fantasy': 'classic-fantasy',
  'dragon-bane': 'classic-fantasy',
  dragonbane: 'classic-fantasy',
};

function normalizeSystemId(systemId: string): string {
  const normalized = stripHtml(systemId).trim().toLowerCase();
  return SYSTEM_ID_ALIASES[normalized] ?? normalized;
}

/**
 * Recursively strips HTML from every string reachable inside `value`.
 *
 * @remarks
 * Used for free-form data bags (`metadata`, `systemData`) so new string fields
 * are sanitized automatically instead of having to be enumerated by name — the
 * omission that previously let system-specific strings through unsanitized.
 * Both bags are open maps whose keys are owned by the active ruleset, so a
 * field-name list here would go stale the moment a system adds a field.
 */
function sanitizeDeep<T>(value: T): T {
  if (typeof value === 'string') return stripHtml(value) as unknown as T;
  if (Array.isArray(value)) return value.map(item => sanitizeDeep(item)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitizeDeep(val);
    }
    return out as unknown as T;
  }
  return value;
}

function sanitizeCharacterStrings(char: CharacterRecord): CharacterRecord {
  const sanitized: CharacterRecord = {
    ...char,
    systemId: normalizeSystemId(char.systemId),
    name: stripHtml(char.name),
    metadata: sanitizeDeep(char.metadata),
    memento: stripHtml(char.memento),
  };
  if (char.systemData) {
    sanitized.systemData = sanitizeDeep(char.systemData);
  }
  return sanitized;
}

/**
 * Downloads a single character as a `.skaldbok.json` file.
 *
 * @remarks
 * The lightweight per-character export, distinct from the campaign bundle
 * exporter under `utils/export/`. Serialises the record verbatim and triggers a
 * browser download via a temporary object URL — no server round-trip, in keeping
 * with the local-first design.
 */
export function exportCharacter(character: CharacterRecord): void {
  const json = JSON.stringify(character, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(character.name)}.skaldbok.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Outcome of importing a character file: success flag plus the record, or an error/warning message. */
export interface ImportResult {
  success: boolean;
  character?: CharacterRecord;
  error?: string;
  /** Non-fatal note, e.g. the character's system id is not one we can render. */
  warning?: string;
}

/**
 * Reads, migrates, sanitises, and saves a character import file.
 *
 * @remarks
 * The full untrusted-input path: parse JSON, run the migration ladder with
 * validation ({@link migrateCharacter}), strip HTML from every string field
 * (including the open `metadata`/`systemData` bags via `sanitizeDeep`),
 * re-key on id collision so an import never overwrites an existing character, and
 * stamp fresh timestamps. Every failure mode returns a populated
 * {@link ImportResult} rather than throwing, so the caller can surface a specific
 * message. An unknown system id imports with a `warning` rather than being
 * rejected.
 */
export async function importCharacter(file: File): Promise<ImportResult> {
  let raw: string;
  try {
    raw = await file.text();
  } catch {
    return { success: false, error: 'Could not read the file.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { success: false, error: 'Invalid JSON file. The file does not appear to be a valid Skaldbok export.' };
  }

  // A campaign/session bundle envelope (has `contents`) isn't a bare character
  // record — importCharacter expects the latter. Detect it and give a clear
  // message instead of an opaque Zod error from migrateCharacter.
  if (parsed && typeof parsed === 'object' && 'contents' in parsed && 'version' in parsed) {
    return {
      success: false,
      error: 'This looks like a campaign/session bundle, not a single character. Import it from the campaign menu instead.',
    };
  }

  let character: CharacterRecord;
  try {
    character = migrateCharacter(parsed);
  } catch (e) {
    return { success: false, error: String(e) };
  }

  // Sanitize string fields
  character = sanitizeCharacterStrings(character);

  // Assign new id if duplicate
  const existing = await characterRepository.getById(character.id);
  if (existing) {
    character = { ...character, id: generateId() };
  }

  // Fresh timestamps
  character = { ...character, createdAt: nowISO(), updatedAt: nowISO() };

  let warning: string | undefined;
  if (!KNOWN_SYSTEM_IDS.includes(character.systemId)) {
    warning = `Unknown system "${character.systemId}". The character was imported but may not display correctly.`;
  }

  try {
    await characterRepository.save(character);
  } catch (e) {
    return { success: false, error: `Failed to save imported character: ${String(e)}` };
  }

  return { success: true, character, warning };
}
