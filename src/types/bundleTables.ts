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
