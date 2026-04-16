import Dexie, { type Table } from 'dexie';
import type { CharacterRecord } from '../../types/character';
import type { SystemDefinition } from '../../types/system';
import type { AppSettings } from '../../types/settings';
import type { MetadataRecord } from '../../types/metadata';
import type { Campaign } from '../../types/campaign';
import type { Session } from '../../types/session';
import type { Note } from '../../types/note';
import type { EntityLink } from '../../types/entityLink';
import type { Party, PartyMember } from '../../types/party';
import type { Attachment } from '../../types/attachment';
import type { CreatureTemplate } from '../../types/creatureTemplate';
import type { Encounter } from '../../types/encounter';
import { generateId } from '../../utils/ids';
import { writePreEncounterReworkBackup } from './migrations/pre-encounter-rework-backup';

export interface ReferenceNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface KBNode {
  id: string;
  type: 'note' | 'character' | 'location' | 'item' | 'tag' | 'unresolved';
  label: string;
  scope: 'campaign' | 'shared';
  campaignId: string;
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KBEdge {
  id: string;
  fromId: string;
  toId: string;
  type: 'wikilink' | 'mention' | 'descriptor';
  campaignId: string;
  createdAt: string;
}

class SkaldbokDatabase extends Dexie {
  characters!: Table<CharacterRecord, string>;
  systems!: Table<SystemDefinition, string>;
  appSettings!: Table<AppSettings, string>;
  referenceNotes!: Table<ReferenceNote, string>;
  metadata!: Dexie.Table<MetadataRecord, string>;
  campaigns!: Table<Campaign, string>;
  sessions!: Table<Session, string>;
  notes!: Table<Note, string>;
  entityLinks!: Table<EntityLink, string>;
  parties!: Table<Party, string>;
  partyMembers!: Table<PartyMember, string>;
  attachments!: Table<Attachment, string>;
  creatureTemplates!: Table<CreatureTemplate, string>;
  encounters!: Table<Encounter, string>;
  kb_nodes!: Table<KBNode, string>;
  kb_edges!: Table<KBEdge, string>;

  constructor() {
    super('skaldbok-db');
    this.version(1).stores({
      characters: 'id, systemId, updatedAt',
      systems: 'id',
      appSettings: 'id',
      referenceNotes: 'id, updatedAt',
    });
    this.version(2).stores({
      metadata: 'id, &key',
    });
    this.version(3).stores({
      campaigns:    'id, status, updatedAt',
      sessions:     'id, campaignId, status, date',
      notes:        'id, campaignId, sessionId, type, status, pinned',
      entityLinks:  'id, [fromEntityId+relationshipType], [toEntityId+relationshipType], fromEntityType, toEntityType',
      parties:      'id, campaignId',
      partyMembers: 'id, partyId, linkedCharacterId',
    });
    this.version(4).stores({
      attachments: 'id, noteId, campaignId, createdAt',
    });
    this.version(5).stores({
      sessions: 'id, campaignId, status, date, [campaignId+status]',
    });

    // --- Version 6: Bestiary, Encounters, Import/Export ---
    // Adds creatureTemplates and encounters tables; extends notes index with visibility.
    this.version(6)
      .stores({
        creatureTemplates: 'id, campaignId, category, status, name',
        encounters: 'id, sessionId, campaignId, type, status',
        notes: 'id, campaignId, sessionId, type, status, pinned, visibility',
      })
      .upgrade(async (tx) => {
        // Migration A — Combat notes -> Encounter entities
        // Uses metadata table (schema 'id, &key') to guard idempotency.
        const combatDone = await tx
          .table('metadata')
          .where('key')
          .equals('migration_v6_combat')
          .first();

        if (!combatDone) {
          const combatNotes = await tx
            .table('notes')
            .where('type')
            .equals('combat')
            .toArray();

          for (const note of combatNotes) {
            const encounter = {
              id: generateId(),
              sessionId: note.sessionId ?? '',
              campaignId: note.campaignId ?? '',
              title: note.title ?? 'Combat',
              type: 'combat' as const,
              status: 'ended' as const,
              startedAt: note.createdAt,
              endedAt: note.updatedAt,
              participants: note.typeData?.participants ?? [],
              combatData: {
                currentRound: note.typeData?.currentRound ?? 0,
                events: note.typeData?.events ?? [],
              },
              createdAt: note.createdAt,
              updatedAt: note.updatedAt,
              schemaVersion: 1,
            };
            await tx.table('encounters').add(encounter);
            // Create entity link from encounter to archived source note
            await tx.table('entityLinks').add({
              id: generateId(),
              fromEntityId: encounter.id,
              fromEntityType: 'encounter',
              toEntityId: note.id,
              toEntityType: 'note',
              relationshipType: 'migrated_from',
              createdAt: note.createdAt,
              updatedAt: note.createdAt,
              schemaVersion: 1,
            });
            // Archive the source note — never delete
            await tx.table('notes').update(note.id, { status: 'archived' });
          }

          await tx.table('metadata').put({
            id: 'migration_v6_combat',
            key: 'migration_v6_combat',
            value: 'true',
          });
        }

        // Migration B — NPC notes -> Creature Template entities
        // NPC notes only have role/affiliation in typeData — no stats fields exist.
        // Stats default to 0; user fills them in via the bestiary UI later.
        const npcDone = await tx
          .table('metadata')
          .where('key')
          .equals('migration_v6_npc')
          .first();

        if (!npcDone) {
          const npcNotes = await tx
            .table('notes')
            .where('type')
            .equals('npc')
            .toArray();

          for (const note of npcNotes) {
            const template = {
              id: generateId(),
              campaignId: note.campaignId ?? '',
              name: note.title ?? 'Unnamed NPC',
              description: note.body, // preserve Tiptap JSON body as description
              category: 'npc' as const,
              role: note.typeData?.role,
              affiliation: note.typeData?.affiliation,
              stats: { hp: 0, armor: 0, movement: 0 },
              attacks: [],
              abilities: [],
              skills: [],
              tags: note.tags ?? [],
              imageUrl: undefined,
              status: 'active' as const,
              createdAt: note.createdAt,
              updatedAt: note.updatedAt,
              schemaVersion: 1,
            };
            await tx.table('creatureTemplates').add(template);
            // Archive the source note — never delete
            await tx.table('notes').update(note.id, { status: 'archived' });
          }

          await tx.table('metadata').put({
            id: 'migration_v6_npc',
            key: 'migration_v6_npc',
            value: 'true',
          });
        }
      });

    // --- Version 7: Knowledge Base Graph ---
    // Adds kb_nodes and kb_edges tables; extends notes index with scope.
    this.version(7)
      .stores({
        notes: 'id, campaignId, sessionId, type, status, pinned, visibility, scope',
        kb_nodes: 'id, campaignId, type, scope, label, sourceId, updatedAt, [campaignId+type]',
        kb_edges: 'id, campaignId, fromId, toId, type',
      })
      .upgrade(async (tx) => {
        const metaKey = 'migration_v7_ref_notes';
        const alreadyRan = await tx
          .table('metadata')
          .where('key')
          .equals(metaKey)
          .first()
          .catch(() => null);
        if (alreadyRan) return;

        const refNotes = await tx
          .table('referenceNotes')
          .toArray()
          .catch(() => []);
        for (const ref of refNotes) {
          await tx.table('notes').put({
            ...ref,
            scope: 'shared',
            type: ref.type ?? 'reference',
          });
        }

        await tx.table('metadata').put({
          id: metaKey,
          key: metaKey,
          value: 'true',
        });
      });

    // --- Version 8: Encounter / notes / folder unification + soft deletes ---
    // Adds deletedAt indexes across every domain table, restructures Encounter
    // to use a segments[] array, and converts participant FKs to entityLinks.
    this.version(8)
      .stores({
        // Domain tables — append deletedAt (and softDeletedBy on entityLinks)
        campaigns: 'id, status, updatedAt, deletedAt',
        sessions: 'id, campaignId, status, date, [campaignId+status], deletedAt',
        notes: 'id, campaignId, sessionId, type, status, pinned, visibility, scope, deletedAt',
        entityLinks:
          'id, [fromEntityId+relationshipType], [toEntityId+relationshipType], fromEntityType, toEntityType, deletedAt, softDeletedBy',
        parties: 'id, campaignId, deletedAt',
        partyMembers: 'id, partyId, linkedCharacterId, deletedAt',
        creatureTemplates: 'id, campaignId, category, status, name, deletedAt',
        encounters: 'id, sessionId, campaignId, type, status, deletedAt',
        characters: 'id, systemId, updatedAt, deletedAt',
      })
      .upgrade(async (tx) => {
        // 1. Backup first. Throws on failure, which aborts the transaction.
        await writePreEncounterReworkBackup(tx);

        // 2. Migrate Encounter rows: scalar startedAt/endedAt -> segments[] array.
        const encountersTable = tx.table('encounters');
        const entityLinksTable = tx.table('entityLinks');
        const allEncounters = await encountersTable.toArray();
        const nowIso = new Date().toISOString();

        for (const enc of allEncounters) {
          const segments: Array<{ startedAt: string; endedAt?: string }> = [];
          if (enc.startedAt) {
            const segment: { startedAt: string; endedAt?: string } = {
              startedAt: enc.startedAt,
            };
            if (enc.endedAt) segment.endedAt = enc.endedAt;
            segments.push(segment);
          }

          // 3. Convert participant linkedCreatureId / linkedCharacterId into
          //    'represents' entity links, then strip the FK fields.
          const participants = Array.isArray(enc.participants) ? enc.participants : [];
          for (const participant of participants) {
            if (participant && participant.linkedCreatureId) {
              await entityLinksTable.add({
                id: generateId(),
                fromEntityId: participant.id,
                fromEntityType: 'encounterParticipant',
                toEntityId: participant.linkedCreatureId,
                toEntityType: 'creature',
                relationshipType: 'represents',
                schemaVersion: 1,
                createdAt: nowIso,
                updatedAt: nowIso,
              });
              delete participant.linkedCreatureId;
            }
            if (participant && participant.linkedCharacterId) {
              await entityLinksTable.add({
                id: generateId(),
                fromEntityId: participant.id,
                fromEntityType: 'encounterParticipant',
                toEntityId: participant.linkedCharacterId,
                toEntityType: 'character',
                relationshipType: 'represents',
                schemaVersion: 1,
                createdAt: nowIso,
                updatedAt: nowIso,
              });
              delete participant.linkedCharacterId;
            }
          }

          await encountersTable.update(enc.id, {
            segments,
            description: undefined,
            body: undefined,
            summary: undefined,
            tags: enc.tags ?? [],
            participants,
            startedAt: undefined,
            endedAt: undefined,
          });
        }

        // 4. Delete old type:'combat' notes (user-confirmed decision — no real
        //    data to preserve; the pre-migration backup above still captured them).
        await tx.table('notes').where('type').equals('combat').delete();
      });

    // --- Version 9: Bestiary soft-delete alignment ---
    // Converts status='archived' creatureTemplates into soft-deleted rows
    // (deletedAt + softDeletedBy) and cascade-soft-deletes their `represents`
    // edges under the same migration txId. Writes a pre-migration JSON
    // snapshot to `metadata` under key bestiary-pre-v9-snapshot so a bad
    // migration is recoverable via DevTools.
    //
    // IMPORTANT: all writes inside this upgrade use tx.table(...) directly.
    // Calling repository helpers (metadataRepository, entityLinkRepository,
    // creatureTemplateRepository) from inside an active upgrade transaction
    // opens a nested transaction and fails or silently misbehaves.
    this.version(9)
      .stores({
        // Schema shape unchanged from v8 — only data is transformed. Dexie
        // still requires every table to be re-declared at the new version.
        campaigns: 'id, status, updatedAt, deletedAt',
        sessions: 'id, campaignId, status, date, [campaignId+status], deletedAt',
        notes: 'id, campaignId, sessionId, type, status, pinned, visibility, scope, deletedAt',
        entityLinks:
          'id, [fromEntityId+relationshipType], [toEntityId+relationshipType], fromEntityType, toEntityType, deletedAt, softDeletedBy',
        parties: 'id, campaignId, deletedAt',
        partyMembers: 'id, partyId, linkedCharacterId, deletedAt',
        creatureTemplates: 'id, campaignId, category, status, name, deletedAt',
        encounters: 'id, sessionId, campaignId, type, status, deletedAt',
        characters: 'id, systemId, updatedAt, deletedAt',
      })
      .upgrade(async (tx) => {
        const migrationTxId = `bestiary-v9-migration-${new Date().toISOString()}`;
        const migrationTs = new Date().toISOString();

        const creaturesTable = tx.table('creatureTemplates');
        const entityLinksTable = tx.table('entityLinks');
        const metadataTable = tx.table('metadata');

        // 1. Pre-migration snapshot. Wrapped in try/catch so a stringify
        //    failure (or any other snapshot error) does not block the
        //    migration — losing the recovery path is worse than ideal but
        //    strictly better than blocking the user at v8 forever.
        try {
          const allCreatures = await creaturesTable.toArray();
          const creatureIds = new Set(allCreatures.map((c: { id: string }) => c.id));
          const allLinks = await entityLinksTable.toArray();
          const relatedLinks = allLinks.filter(
            (l: { fromEntityId?: string; toEntityId?: string }) =>
              (l.fromEntityId && creatureIds.has(l.fromEntityId)) ||
              (l.toEntityId && creatureIds.has(l.toEntityId)),
          );
          const snapshot = { creatureTemplates: allCreatures, entityLinks: relatedLinks };
          await metadataTable.put({
            id: generateId(),
            key: 'bestiary-pre-v9-snapshot',
            value: JSON.stringify(snapshot),
          });
        } catch (e) {
          console.error('[bestiary-v9-migration] snapshot failed', e);
          // continue the migration without a snapshot
        }

        // 2. Transform archived rows. CreatureTemplate.status is a Zod enum
        //    of ['active', 'archived']; setting any other value would fail
        //    future reads. The soft-delete state is carried by deletedAt,
        //    not status, so migrated rows move to status='active'.
        const creatures = await creaturesTable.toArray();
        for (const row of creatures) {
          if (row.status === 'archived') {
            await creaturesTable.update(row.id, {
              deletedAt: migrationTs,
              softDeletedBy: migrationTxId,
              status: 'active',
              updatedAt: migrationTs,
            });
            // Cascade represents edges touching this creature (dedupe since
            // a link could match both fromEntityId and toEntityId queries).
            const from = await entityLinksTable.where('fromEntityId').equals(row.id).toArray();
            const to = await entityLinksTable.where('toEntityId').equals(row.id).toArray();
            const seen = new Set<string>();
            for (const link of [...from, ...to]) {
              if (seen.has(link.id)) continue;
              seen.add(link.id);
              if (!link.deletedAt) {
                await entityLinksTable.update(link.id, {
                  deletedAt: migrationTs,
                  softDeletedBy: migrationTxId,
                  updatedAt: migrationTs,
                });
              }
            }
            console.info('[bestiary-v9-migration] migrated', row.id);
          } else if (row.status && row.status !== 'active' && row.status !== 'archived') {
            console.warn('[bestiary-v9-migration] unexpected row, skipping', row.id);
          }
        }
      });
  }
}

export const db = new SkaldbokDatabase();
