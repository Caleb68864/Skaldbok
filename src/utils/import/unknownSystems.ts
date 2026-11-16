import type { BundleEnvelope } from '../../types/bundle';
import type { ValidationWarning } from './bundleParser';

/**
 * Warnings for rulesets a bundle names but this device cannot resolve.
 *
 * @remarks
 * A ruleset is resolvable when this build bundles it, the device already
 * stores it (a user-authored system imported earlier), or the bundle carries it
 * in `contents.systems`. Anything else imports fine — the rows are valid — but
 * every character on it then runs on classic-fantasy's fallback rules, so the
 * user is told before confirming rather than after.
 *
 * The ids checked are the envelope's `system`, the carried campaign's `system`
 * and each character's `systemId`. One warning per unknown id, naming how many
 * characters use it.
 *
 * @param knownSystemIds - Bundled and stored system ids. The bundle's own
 *   `contents.systems` are added here, so callers need not.
 */
export function unknownSystemWarnings(
  bundle: BundleEnvelope,
  knownSystemIds: Iterable<string>,
): ValidationWarning[] {
  const known = new Set(knownSystemIds);
  for (const system of bundle.contents.systems ?? []) {
    if (typeof system?.id === 'string') known.add(system.id);
  }

  // Insertion order: envelope, campaign, then characters in bundle order.
  const charactersBySystem = new Map<string, number>();
  const note = (id: unknown) => {
    if (typeof id !== 'string' || id === '' || known.has(id)) return;
    if (!charactersBySystem.has(id)) charactersBySystem.set(id, 0);
  };
  note(bundle.system);
  note((bundle.contents.campaign as { system?: unknown } | undefined)?.system);
  for (const character of bundle.contents.characters ?? []) {
    const id = (character as { systemId?: unknown }).systemId;
    note(id);
    if (typeof id === 'string' && charactersBySystem.has(id)) {
      charactersBySystem.set(id, (charactersBySystem.get(id) ?? 0) + 1);
    }
  }

  return [...charactersBySystem].map(([id, characters]) => ({
    entityType: 'envelope',
    entityIndex: 0,
    path: 'system',
    message:
      `This bundle uses the ruleset "${id}", which is not installed and is not in the bundle` +
      (characters > 0 ? ` (${characters} character${characters === 1 ? '' : 's'})` : '') +
      '. It will import, but its characters will use the default rules until that ruleset is imported.',
  }));
}
