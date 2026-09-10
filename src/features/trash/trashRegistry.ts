import * as characterRepository from '../../storage/repositories/characterRepository';
import * as creatureTemplateRepository from '../../storage/repositories/creatureTemplateRepository';
import * as sessionRepository from '../../storage/repositories/sessionRepository';
import * as noteRepository from '../../storage/repositories/noteRepository';
import * as shipRepository from '../../storage/repositories/shipRepository';
import * as inventoryContainerRepository from '../../storage/repositories/inventoryContainerRepository';
import * as ledgerRepository from '../../storage/repositories/ledgerRepository';
import * as ledgerAccountRepository from '../../storage/repositories/ledgerAccountRepository';
import * as recurringBillRepository from '../../storage/repositories/recurringBillRepository';
import * as routeRepository from '../../storage/repositories/routeRepository';
import * as referenceSectionRepository from '../../storage/repositories/referenceSectionRepository';
import * as referenceNoteRepository from '../../storage/repositories/referenceNoteRepository';
import * as partyRepository from '../../storage/repositories/partyRepository';
import { docToText } from '../notes/textToDoc';
import type { Note } from '../../types/note';

/** One restorable row, flattened out of whatever table it came from. */
export interface TrashRow {
  id: string;
  title: string;
  /** Short secondary line — a category, a date, a system id. */
  detail: string;
  deletedAt?: string;
  restore: () => Promise<void>;
}

/**
 * One entity type's presence in the Trash.
 *
 * @remarks
 * `scope` is not decoration: a `'campaign'` entry is skipped entirely when no
 * campaign is active, because its `getDeleted` needs an id. `'global'` entries
 * always load. Characters are global because a `CharacterRecord` carries no
 * campaign id at all; the reference library is global because it is the user's
 * own house rules, shared across campaigns.
 */
export interface TrashEntityType {
  /** Stable key — used for React keys and `aria-labelledby`, never displayed. */
  key: string;
  /** Section heading. */
  heading: string;
  scope: 'campaign' | 'global';
  /** Lists the deleted rows, already flattened. `campaignId` is set iff scope is `'campaign'`. */
  load: (campaignId: string | undefined) => Promise<TrashRow[]>;
}

/**
 * Tables the repository layer can soft-delete and restore but deliberately does
 * not list, with the reason.
 *
 * @remarks
 * `trashRegistry.test.ts` enforced one direction only — a `getDeleted` must
 * reach this registry — which is the direction that had already gone wrong.
 * The other direction is the same bug one step earlier: something that gains a
 * soft delete and a restore without a listing puts rows somewhere the Trash
 * cannot see, and the test passed because it was never asked.
 *
 * Now both directions are enforced, and this map is where a deliberate absence
 * is recorded. Written the same way as `TABLES_OUTSIDE_BUNDLE`: the reason is
 * the point, because an exemption someone can re-read and disagree with is a
 * decision, and a row silently missing a listing is the bug.
 *
 * **Keyed by Dexie table, and derived from behaviour rather than from function
 * names.** It used to be keyed by repository module and detected by a
 * `getDeleted[A-Za-z]*` name prefix, with a second, differently-detected copy
 * of the same invariant living in `repositoryConventions.test.ts` under exact
 * names. Each list was blind exactly where the other had an entry —
 * `partyRepository` was invisible to this one because `getDeletedMembers`
 * *named* a listing for a different entity, and `attachmentRepository` was
 * invisible to that one because its methods are `softDeleteAttachmentsByNote` /
 * `restoreAttachmentsForTxId`. The parallel list is gone and the evidence now
 * comes from `test-utils/softDeleteCapabilities.ts`, which reads what the code
 * writes: per table, not per module, and by the write rather than by the name.
 */
export const RESTORE_WITHOUT_LISTING: Record<string, string> = {
  attachments:
    'A cascade child, never deleted on its own. Attachments are soft-deleted with '
    + 'their note and come back through `restoreAttachmentsForTxId`, matching the '
    + "note's `softDeletedBy`. A standalone listing would offer the user an "
    + 'attachment whose note is still in the trash.',
  entityLinks:
    'The same, for edges. Links are soft-deleted as part of whatever cascade owns '
    + 'their endpoints and restored by that cascade\'s txId. An edge listed on its '
    + 'own could be restored into a dangling state.',
  campaigns:
    'No user-facing delete exists. `softDelete` is reachable only from code, and '
    + 'the campaign cascade does not yet carry its sessions, notes and encounters '
    + 'with it — so a Trash entry would restore an empty shell. Add the listing '
    + 'with the delete button, not before.',
  encounters:
    'No user-facing delete exists; encounters end rather than being deleted. The '
    + 'Trash has a Sessions section that is already unreachable in normal use for '
    + 'the same reason, and a second one would not earn its heading.',
  ledgerSplits:
    'One lazily-created row per campaign, with no user-facing delete at all. A '
    + 'listing here would be dead code — the same call this project made when it '
    + 'declined to add `getDeleted` to it during the Trash rework.',
  routePlans:
    'One lazily-created row per campaign, as above. The route *stops* are the '
    + 'user-deletable part and they are listed.',
  parties:
    'The party *row* itself, as distinct from its members. `partyRepository` '
    + 'soft-deletes and restores it, with no user-facing delete: a campaign has '
    + 'one party and deleting it would strand every member seat. The member seats '
    + 'are the user-deletable part and `getDeletedMembers` lists them — which is '
    + 'exactly why this went unrecorded for so long, since a per-module check saw '
    + 'that listing and asked no further.',
};

/** Leading characters of a note body used as a title fallback. */
const TITLE_FALLBACK_LENGTH = 40;

function noteTitle(note: Note): string {
  if (note.title?.trim()) return note.title;
  const text = docToText(note.body).trim();
  return text ? text.slice(0, TITLE_FALLBACK_LENGTH) + (text.length > TITLE_FALLBACK_LENGTH ? '…' : '') : 'Untitled note';
}

/**
 * Every entity type that can be restored, and how.
 *
 * @remarks
 * This list is the point of the file. The Trash screen used to hard-code four
 * types inline, so the other nine — every one of which had a working `restore`
 * sitting in its repository with no caller — were unrecoverable in practice.
 * Deleting a ship, a party's shared container, a ledger entry or a reference
 * card destroyed it as far as the user was concerned, silently, with no
 * confirmation on some of those paths.
 *
 * `trashRegistry.test.ts` fails if a repository grows a `getDeleted` and is not
 * added here, which is the shape of the bug this replaced: the capability
 * existed and nothing surfaced it. CLAUDE.md names that failure mode —
 * declaring a capability is half the work.
 *
 * Order is roughly "most likely to be missed first"; sections with no rows are
 * dropped by the screen, so this is just the order they appear in when present.
 */
export const TRASH_ENTITY_TYPES: TrashEntityType[] = [
  {
    key: 'characters',
    heading: 'Characters',
    scope: 'global',
    load: async () =>
      (await characterRepository.getDeleted()).map((c) => ({
        id: c.id,
        title: c.name,
        detail: c.systemId,
        deletedAt: c.deletedAt,
        restore: () => characterRepository.restore(c.id),
      })),
  },
  {
    key: 'sessions',
    heading: 'Sessions',
    scope: 'campaign',
    load: async (campaignId) =>
      (await sessionRepository.getDeleted(campaignId!)).map((s) => ({
        id: s.id,
        title: s.title,
        detail: s.date,
        deletedAt: s.deletedAt,
        restore: () => sessionRepository.restore(s.id),
      })),
  },
  {
    key: 'notes',
    heading: 'Notes',
    scope: 'campaign',
    load: async (campaignId) =>
      (await noteRepository.getDeleted(campaignId!)).map((n) => ({
        id: n.id,
        title: noteTitle(n),
        detail: n.type,
        deletedAt: n.deletedAt,
        restore: () => noteRepository.restore(n.id),
      })),
  },
  {
    key: 'creatures',
    heading: 'Creatures',
    scope: 'campaign',
    load: async (campaignId) =>
      (await creatureTemplateRepository.getDeleted(campaignId!)).map((c) => ({
        id: c.id,
        title: c.name,
        detail: c.category,
        deletedAt: c.deletedAt,
        restore: () => creatureTemplateRepository.restore(c.id),
      })),
  },
  {
    key: 'ships',
    heading: 'Ships & Vehicles',
    scope: 'campaign',
    load: async (campaignId) =>
      (await shipRepository.getDeleted(campaignId!)).map((s) => ({
        id: s.id,
        title: s.name,
        // The Ship type carries no class or designation — which counters and
        // specs a vehicle has is the ruleset's business, not the type's — so
        // there is nothing more specific than this to show.
        detail: s.ownerCharacterId ? 'Owned vehicle' : 'Campaign vehicle',
        deletedAt: s.deletedAt,
        restore: () => shipRepository.restore(s.id),
      })),
  },
  {
    key: 'containers',
    heading: 'Party Containers',
    scope: 'campaign',
    load: async (campaignId) =>
      (await inventoryContainerRepository.getDeleted(campaignId!)).map((c) => ({
        id: c.id,
        title: c.name,
        detail: c.kind,
        deletedAt: c.deletedAt,
        restore: () => inventoryContainerRepository.restore(c.id),
      })),
  },
  {
    key: 'partyMembers',
    heading: 'Party Members',
    scope: 'campaign',
    load: async (campaignId) =>
      (await partyRepository.getDeletedMembers(campaignId!)).map((m) => ({
        id: m.id,
        title: m.name ?? 'Unnamed member',
        detail: m.linkedCharacterId ? 'Linked character' : 'Party seat',
        deletedAt: m.deletedAt,
        restore: () => partyRepository.restorePartyMember(m.id),
      })),
  },
  {
    key: 'ledgerEntries',
    heading: 'Ledger Entries',
    scope: 'campaign',
    load: async (campaignId) =>
      (await ledgerRepository.getDeleted(campaignId!)).map((e) => ({
        id: e.id,
        title: e.memo || 'Untitled entry',
        detail: e.date,
        deletedAt: e.deletedAt,
        restore: () => ledgerRepository.restore(e.id),
      })),
  },
  {
    key: 'ledgerAccounts',
    heading: 'Ledger Accounts',
    scope: 'campaign',
    load: async (campaignId) =>
      (await ledgerAccountRepository.getDeleted(campaignId!)).map((a) => ({
        id: a.id,
        title: a.name,
        detail: a.isPrimary ? 'Primary account' : 'Account',
        deletedAt: a.deletedAt,
        restore: () => ledgerAccountRepository.restore(a.id),
      })),
  },
  {
    key: 'recurringBills',
    heading: 'Recurring Bills',
    scope: 'campaign',
    load: async (campaignId) =>
      (await recurringBillRepository.getDeleted(campaignId!)).map((b) => ({
        id: b.id,
        title: b.name,
        detail: `Every ${b.everyDays} days`,
        deletedAt: b.deletedAt,
        restore: () => recurringBillRepository.restore(b.id),
      })),
  },
  {
    key: 'routeStops',
    heading: 'Route Stops',
    scope: 'campaign',
    load: async (campaignId) =>
      (await routeRepository.getDeleted(campaignId!)).map((s) => ({
        id: s.id,
        title: s.name,
        // Restoring appends to the end of the running order, since the stops
        // around it re-densified when this one went.
        detail: 'Restores at the end of the route',
        deletedAt: s.deletedAt,
        restore: () => routeRepository.restore(s.id),
      })),
  },
  {
    key: 'referenceSections',
    heading: 'Reference Sections',
    scope: 'global',
    load: async () =>
      (await referenceSectionRepository.getDeleted()).map((s) => ({
        id: s.id,
        title: s.title,
        detail: s.category,
        deletedAt: s.deletedAt,
        restore: () => referenceSectionRepository.restore(s.id),
      })),
  },
  {
    key: 'referenceGroups',
    heading: 'Reference Cards',
    scope: 'global',
    load: async () =>
      (await referenceSectionRepository.getDeletedGroups()).map((g) => ({
        id: g.id,
        title: g.title,
        detail: 'Restores its sections too',
        deletedAt: g.deletedAt,
        restore: () => referenceSectionRepository.restoreGroup(g.id),
      })),
  },
  {
    key: 'referenceNotes',
    heading: 'Reference Notes',
    scope: 'global',
    load: async () =>
      (await referenceNoteRepository.getDeleted()).map((n) => ({
        id: n.id,
        title: n.title || 'Untitled note',
        // The legacy table carries no category or scope of its own.
        detail: 'Reference library note',
        deletedAt: n.deletedAt,
        restore: () => referenceNoteRepository.restore(n.id),
      })),
  },
];
