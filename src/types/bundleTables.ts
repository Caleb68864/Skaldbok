import type { BundleContents } from './bundle';

/**
 * The single registry mapping every `BundleContents` key to the Dexie table it
 * comes from and back again.
 *
 * @remarks
 * Export, import, the merge engine and the import preview each used to carry
 * their own copy of this list. Four hand-maintained copies is how the campaign
 * export came to omit ships, the whole ledger, routes, the knowledge base and
 * the reference library while the UI called it "the only copy that survives
 * this device" — a table added to `client.ts` simply never reached any of them.
 *
 * Everything that enumerates bundle entity types now reads this file, and
 * `bundleParity.test.ts` walks `db.tables` against {@link BUNDLE_TABLE_BY_KEY}
 * and {@link TABLES_OUTSIDE_BUNDLE}, so a new table cannot be added without
 * either joining the backup or being explicitly and visibly excluded.
 */

/**
 * Bundle contents key → Dexie table name, in foreign-key-safe processing order.
 *
 * @remarks
 * Order is load-bearing on import: a row is written only after whatever it
 * points at. `campaign` comes first because re-parenting hangs off it,
 * `entityLinks` and `attachments` last because they reference everything else.
 * Declared as an array of pairs rather than an object literal so the order is
 * explicit rather than an accident of key insertion.
 */
export const BUNDLE_TABLE_ENTRIES: ReadonlyArray<readonly [keyof BundleContents, string]> = [
  ['campaign', 'campaigns'],
  ['systems', 'systems'],
  ['sessions', 'sessions'],
  ['parties', 'parties'],
  ['partyMembers', 'partyMembers'],
  ['characters', 'characters'],
  ['creatureTemplates', 'creatureTemplates'],
  ['encounters', 'encounters'],
  ['inventoryContainers', 'inventoryContainers'],
  ['ships', 'ships'],
  ['ledgerAccounts', 'ledgerAccounts'],
  ['ledgerEntries', 'ledgerEntries'],
  ['ledgerSplits', 'ledgerSplits'],
  ['recurringBills', 'recurringBills'],
  ['routeStops', 'routeStops'],
  ['routePlans', 'routePlans'],
  ['referenceGroups', 'referenceGroups'],
  ['referenceSections', 'referenceSections'],
  ['notes', 'notes'],
  ['kbNodes', 'kb_nodes'],
  ['kbEdges', 'kb_edges'],
  ['entityLinks', 'entityLinks'],
  ['attachments', 'attachments'],
] as const;

/** Bundle contents key → Dexie table name. */
export const BUNDLE_TABLE_BY_KEY: Record<string, string> = Object.fromEntries(BUNDLE_TABLE_ENTRIES);

/** Foreign-key-safe order in which bundle entity groups must be merged. */
export const BUNDLE_PROCESSING_ORDER: (keyof BundleContents)[] = BUNDLE_TABLE_ENTRIES.map(([key]) => key);

/**
 * Dexie tables that deliberately do not travel in a bundle, with the reason.
 *
 * @remarks
 * The reason is the point of this map. An excluded table is a decision someone
 * has to be able to re-read and disagree with; a table simply missing from the
 * export is the bug this registry exists to prevent.
 */
export const TABLES_OUTSIDE_BUNDLE: Record<string, string> = {
  appSettings:
    'Per-device preferences (theme, text size, the active campaign). Restoring '
    + "one device's settings onto another would clobber choices made there.",
  metadata:
    'Internal bookkeeping — migration markers and schema housekeeping. Meaningless '
    + 'off the device that wrote it, and the importing database maintains its own.',
  referenceNotes:
    'Legacy table, superseded at v7 when its content was folded into `notes` with '
    + '`scope: \'shared\'`. Retained only so the old table still types during upgrades; '
    + 'its live content is already exported as notes.',
};

/**
 * Dexie tables whose rows do **not** carry `deletedAt` / `softDeletedBy`, with
 * the reason.
 *
 * @remarks
 * Written the same way as {@link TABLES_OUTSIDE_BUNDLE}, and for the same
 * reason: the exclusion is the decision worth recording. Everything not listed
 * here is soft-deletable, so this is six entries rather than twenty and a new
 * table forces a choice instead of quietly defaulting either way.
 *
 * `CLAUDE.md` and `AGENTS.md` used to carry the *inclusion* list instead —
 * nine entities named in prose against twenty tables that actually declare the
 * fields, in two files that nothing kept in step. They now state the count and
 * point here. `softDeleteCoverage.test.ts` walks `db.tables` against this map,
 * so neither the map nor the count in the docs can drift from the schema.
 */
export const TABLES_WITHOUT_SOFT_DELETE: Record<string, string> = {
  systems:
    'Ruleset definitions, keyed by id and versioned by their own integer `version`. '
    + 'Replaced wholesale on a newer version rather than deleted; a tombstoned ruleset '
    + 'would orphan every character that names it.',
  appSettings:
    'Per-device preferences — a single row the settings screen overwrites in place. '
    + 'There is no delete to undo.',
  metadata:
    'Internal bookkeeping (migration markers, the active-campaign id). Keys are '
    + 'written and overwritten by the app, never deleted by a user.',
  referenceNotes:
    'Legacy table superseded at schema v7. Its content lives in `notes` now, where it '
    + 'is soft-deleted like every other note; the old table is retained only so '
    + 'upgrades still type.',
  kb_nodes:
    'A derived projection of `notes` and the entities they link, rebuilt from source by '
    + '`linkSyncEngine`. Deleting the note is the delete; a tombstone here would be a '
    + 'second, divergent record of the same fact.',
  kb_edges:
    'Derived alongside `kb_nodes` and rebuilt with them. Same reason.',
};

/**
 * Human-readable group names for the import preview's per-type checkboxes.
 *
 * @remarks
 * Keyed by bundle contents key. `bundleParity.test.ts` asserts every exported
 * key has one, so a new entity group cannot reach the import dialog as a raw
 * camelCase identifier.
 */
export const BUNDLE_ENTITY_LABELS: Record<string, string> = {
  campaign: 'Campaign',
  systems: 'Game Systems',
  sessions: 'Sessions',
  parties: 'Parties',
  partyMembers: 'Party Members',
  characters: 'Characters',
  creatureTemplates: 'Creature Templates',
  encounters: 'Encounters',
  inventoryContainers: 'Containers',
  ships: 'Ships',
  ledgerAccounts: 'Ledger Accounts',
  ledgerEntries: 'Ledger Entries',
  ledgerSplits: 'Payout Splits',
  recurringBills: 'Recurring Bills',
  routeStops: 'Route Stops',
  routePlans: 'Route Plans',
  referenceGroups: 'Reference Groups',
  referenceSections: 'Reference Sections',
  notes: 'Notes',
  kbNodes: 'Knowledge Base Nodes',
  kbEdges: 'Knowledge Base Links',
  entityLinks: 'Entity Links',
  attachments: 'Attachments',
};
