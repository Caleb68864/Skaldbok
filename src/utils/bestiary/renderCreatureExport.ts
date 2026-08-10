import type { CreatureTemplate } from '../../types/creatureTemplate';

/**
 * Renders creatures as JSON in the shape the importer reads.
 *
 * @remarks
 * The counterpart to `parseCreatureImport`, and deliberately its exact format:
 * a stat block you researched, imported and then corrected should be handable
 * to someone else, or kept as a file of your own, without a second format to
 * learn. Round-tripping is asserted by test.
 *
 * **Every stored stat is exported, including ones the current ruleset does not
 * declare.** The file is a faithful record of the creature, not a view of it
 * through one system — stripping the undeclared ones here would silently lose
 * data at export time, which is the worst place to lose it. Re-importing into a
 * ruleset that does not declare them drops them *with a warning*, which is the
 * right place for that decision.
 *
 * Empty optional fields are omitted rather than emitted blank, so a hand-edited
 * file stays readable and a generated one has less to imitate.
 */
export function renderCreaturesToJson(templates: CreatureTemplate[]): string {
  const creatures = templates.map(t => {
    const entry: Record<string, unknown> = {
      name: t.name,
      category: t.category,
    };
    if (t.role) entry.role = t.role;
    if (t.affiliation) entry.affiliation = t.affiliation;
    entry.stats = { ...t.stats };
    if (t.attacks.length > 0) {
      entry.attacks = t.attacks.map(a => {
        const attack: Record<string, unknown> = { name: a.name };
        if (a.damage) attack.damage = a.damage;
        if (a.range) attack.range = a.range;
        if (a.skill) attack.skill = a.skill;
        if (a.special) attack.special = a.special;
        return attack;
      });
    }
    if (t.abilities.length > 0) {
      entry.abilities = t.abilities.map(a =>
        a.description ? { name: a.name, description: a.description } : { name: a.name },
      );
    }
    if (t.skills.length > 0) {
      entry.skills = t.skills.map(s => ({ name: s.name, value: s.value }));
    }
    if (t.tags.length > 0) entry.tags = [...t.tags];
    // `description` is Tiptap JSON or a plain string depending on how it was
    // authored. Only a string is exported: a document node means nothing to
    // whatever reads this file, and the importer would store it as "[object
    // Object]" on the way back in.
    if (typeof t.description === 'string' && t.description.trim() !== '') {
      entry.description = t.description;
    }
    return entry;
  });

  return JSON.stringify({ creatures }, null, 2);
}

/** Filename for an exported bestiary, slugged from the campaign name. */
export function creatureExportFilename(campaignName: string): string {
  const slug = campaignName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'campaign'}-bestiary.json`;
}
