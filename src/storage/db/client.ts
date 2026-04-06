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

export interface ReferenceNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
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
  }
}

export const db = new SkaldbokDatabase();
