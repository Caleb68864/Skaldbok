import { describe, it, expect } from 'vitest';
import { NOTE_TYPES } from '../../types/note';
import { DEFAULT_NOTE_TYPE_CONFIG } from './noteTypes';

/**
 * Every note type the app writes must be presentable.
 *
 * @remarks
 * `NOTE_TYPES` is the stored discriminator; `DEFAULT_NOTE_TYPE_CONFIG` is how
 * each one appears wherever the user picks or filters by type. `NotesGrid`
 * builds its filter chips from the config, so a type present in one list and
 * absent from the other is a note the user can create and then cannot find.
 *
 * Three had drifted out: `npc`, `spell-cast` and `ability-use`, all of them
 * actively written — `useSessionLog`, `PromoteEntriesSheet`,
 * `noteCreationService` and `SkillCheckEditDrawer` between them produce all
 * three. No test referenced `DEFAULT_NOTE_TYPE_CONFIG` at all, so the two lists
 * had nothing holding them together.
 *
 * The `id: NoteType` annotation already stops the config naming a type that
 * does not exist; what it cannot catch is the omission, which is the direction
 * that actually happened.
 */
describe('note type configuration', () => {
  it('presents every stored note type', () => {
    const configured = DEFAULT_NOTE_TYPE_CONFIG.map(c => c.id);
    const missing = NOTE_TYPES.filter(type => !configured.includes(type));
    expect(
      missing,
      `${missing.join(', ')} can be written to a note but has no entry in ` +
      'DEFAULT_NOTE_TYPE_CONFIG. NotesGrid builds its filter chips from that ' +
      'array, so these notes exist and cannot be filtered to.',
    ).toEqual([]);
  });

  it('declares no type that cannot be stored', () => {
    const unknown = DEFAULT_NOTE_TYPE_CONFIG
      .map(c => c.id as string)
      .filter(id => !(NOTE_TYPES as readonly string[]).includes(id));
    expect(unknown).toEqual([]);
  });

  it('has one entry per type, with a label', () => {
    const ids = DEFAULT_NOTE_TYPE_CONFIG.map(c => c.id);
    expect(new Set(ids).size, 'duplicate note type entries').toBe(ids.length);
    for (const config of DEFAULT_NOTE_TYPE_CONFIG) {
      expect(config.label.trim(), `${config.id} has no label`).not.toBe('');
    }
  });

  it('does not offer system-assigned types for promotion', () => {
    // The creating flow picks these; offering them in the promote sheet would
    // let a log entry become a half-populated combat or skill-check record.
    const systemAssigned = ['npc', 'combat', 'skill-check', 'spell-cast', 'ability-use', 'log'];
    for (const id of systemAssigned) {
      const config = DEFAULT_NOTE_TYPE_CONFIG.find(c => c.id === id);
      expect(config?.promotable, `${id} should not be promotable`).toBeFalsy();
    }
  });
});
