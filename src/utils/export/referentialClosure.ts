import type { BundleContents } from '../../types/bundle';

/**
 * Entity-link endpoint type → the `BundleContents` key that would carry it.
 *
 * @remarks
 * Deliberately mirrors `LINK_ENDPOINT_TABLES` in the import merge engine. The
 * importer validates an edge against the *table*; this validates it against the
 * *bundle*. If the two lists drift, export and import stop agreeing about which
 * edges are valid, which is the whole failure this module exists to prevent.
 *
 * A type absent from this map is unverifiable (`encounterParticipant`) and is
 * never used as grounds for dropping an edge — again matching the importer.
 */
const ENDPOINT_CONTENTS_KEYS: Record<string, keyof BundleContents> = {
  session: 'sessions',
  party: 'parties',
  partyMember: 'partyMembers',
  character: 'characters',
  creature: 'creatureTemplates',
  encounter: 'encounters',
  note: 'notes',
  inventoryContainer: 'inventoryContainers',
};

/** Result of a closure pass: the pruned contents plus what was removed and why. */
export interface ReferentialClosureResult {
  contents: BundleContents;
  /** Edges removed because an endpoint was not present in the bundle. */
  droppedLinks: number;
  /** `"<type> \"<id>\""` for each missing endpoint, deduped — for logging. */
  missingEndpoints: string[];
}

/**
 * Drops entity links whose endpoints are not carried by the bundle, making it
 * referentially closed.
 *
 * @remarks
 * Collectors gather links by "every edge touching a collected entity", but they
 * gather *entities* by narrower rules — characters only via party membership,
 * notes only within the campaign, and nothing at all for a soft-deleted or
 * cross-campaign target. Any edge reaching outside that set shipped in the
 * bundle with no matching row.
 *
 * On import, `danglingLinkEndpoint` then rejected exactly those edges and
 * pushed them onto `report.errors`, so the relationship was **destroyed** on
 * round-trip and the user saw only a bare error count. Pruning here makes the
 * bundle honest about what it contains: the edges that survive all import
 * cleanly, and what could not be represented is reported once at export, where
 * it is actionable, rather than as an import failure later.
 *
 * @param contents - Assembled bundle contents.
 * @returns The pruned contents plus a count and description of what was removed.
 */
export function closeBundleReferences(contents: BundleContents): ReferentialClosureResult {
  const links = contents.entityLinks ?? [];
  if (links.length === 0) {
    return { contents, droppedLinks: 0, missingEndpoints: [] };
  }

  /** Ids present in the bundle, per endpoint type. */
  const presentIds = new Map<string, Set<string>>();
  for (const [type, key] of Object.entries(ENDPOINT_CONTENTS_KEYS)) {
    const rows = contents[key];
    const ids = new Set<string>();
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const id = (row as Record<string, unknown>)?.id;
        if (typeof id === 'string') ids.add(id);
      }
    }
    presentIds.set(type, ids);
  }
  // `campaign` is a single object rather than an array.
  const campaignId = (contents.campaign as Record<string, unknown> | undefined)?.id;
  presentIds.set('campaign', new Set(typeof campaignId === 'string' ? [campaignId] : []));

  const missing = new Set<string>();

  const endpointResolves = (type: unknown, id: unknown): boolean => {
    if (typeof type !== 'string' || typeof id !== 'string') return true;
    // Unverifiable endpoint type — not grounds for dropping.
    if (!(type in ENDPOINT_CONTENTS_KEYS) && type !== 'campaign') return true;
    if (presentIds.get(type)?.has(id)) return true;
    missing.add(`${type} "${id}"`);
    return false;
  };

  const kept = links.filter((link) => {
    const row = link as unknown as Record<string, unknown>;
    return (
      endpointResolves(row.fromEntityType, row.fromEntityId) &&
      endpointResolves(row.toEntityType, row.toEntityId)
    );
  });

  return {
    contents: { ...contents, entityLinks: kept },
    droppedLinks: links.length - kept.length,
    missingEndpoints: [...missing],
  };
}
