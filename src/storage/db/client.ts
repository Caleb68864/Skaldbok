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
  }
}

export const db = new SkaldbokDatabase();
