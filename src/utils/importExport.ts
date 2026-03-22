import { migrateCharacter } from './migrations';
import * as characterRepository from '../storage/repositories/characterRepository';
import { generateId } from './ids';
import { nowISO } from './dates';
import type { CharacterRecord } from '../types/character';

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'character';
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '');
}

function sanitizeCharacterStrings(char: CharacterRecord): CharacterRecord {
  return {
    ...char,
    name: stripHtml(char.name),
    metadata: {
      kin: stripHtml(char.metadata.kin),
      profession: stripHtml(char.metadata.profession),
      age: stripHtml(char.metadata.age),
      weakness: stripHtml(char.metadata.weakness),
      appearance: stripHtml(char.metadata.appearance),
      notes: stripHtml(char.metadata.notes),
    },
    memento: stripHtml(char.memento),
  };
}

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

export interface ImportResult {
  success: boolean;
  character?: CharacterRecord;
  error?: string;
  warning?: string;
}

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
  const knownSystems = ['dragonbane'];
  if (!knownSystems.includes(character.systemId)) {
    warning = `Unknown system "${character.systemId}". The character was imported but may not display correctly.`;
  }

  try {
    await characterRepository.save(character);
  } catch (e) {
    return { success: false, error: `Failed to save imported character: ${String(e)}` };
  }

  return { success: true, character, warning };
}
