import { describe, it, expect } from 'vitest';
import { sheetTemplateSchema, componentDefinitionSchema, cardEntrySchema } from './schema';

describe('cardEntrySchema', () => {
  it('accepts a bare string', () => {
    expect(cardEntrySchema.safeParse('AttributesCard').success).toBe(true);
  });

  it('accepts the object form with a valid guard', () => {
    const result = cardEntrySchema.safeParse({
      card: 'CurrencyCard',
      props: { compact: true },
      when: 'hasCurrency',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-enum when value', () => {
    const result = cardEntrySchema.safeParse({ card: 'CurrencyCard', when: 'hasSpaceships' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-string card value', () => {
    const result = cardEntrySchema.safeParse({ card: 123 });
    expect(result.success).toBe(false);
  });
});

describe('sheetTemplateSchema', () => {
  it('parses a valid Traveller-shaped template', () => {
    const template = {
      version: 1,
      play: {
        layout: 'two-column',
        regions: [
          ['IdentityCard', { card: 'DamageTrackCard', when: 'hasDamageTrack' }],
          [{ card: 'CurrencyCard', props: { compact: true }, when: 'hasCurrency' }],
        ],
      },
      sheet: {
        layout: 'grid',
        regions: [['SkillsCard'], ['StoryBankCard', { card: 'RestCard', when: 'hasRest' }]],
      },
    };
    const result = sheetTemplateSchema.safeParse(template);
    expect(result.success).toBe(true);
  });

  it('fails on a malformed template with a bad card type', () => {
    const template = {
      version: 1,
      play: {
        layout: 'two-column',
        regions: [[{ card: 42 }]],
      },
    };
    const result = sheetTemplateSchema.safeParse(template);
    expect(result.success).toBe(false);
  });

  it('fails on an unknown when guard value', () => {
    const template = {
      version: 1,
      play: {
        layout: 'two-column',
        regions: [[{ card: 'CurrencyCard', when: 'notARealGuard' }]],
      },
    };
    const result = sheetTemplateSchema.safeParse(template);
    expect(result.success).toBe(false);
  });

  it('parses the grid-region form ({ columns, cells })', () => {
    const template = {
      version: 1,
      play: {
        regions: [
          { columns: '2fr 1fr', cells: [['SkillsCard'], [{ card: 'MagicCard', when: 'hasMagic' }]] },
        ],
      },
    };
    expect(sheetTemplateSchema.safeParse(template).success).toBe(true);
  });

  it('rejects a region array that exceeds the anti-abuse max', () => {
    const template = {
      version: 1,
      play: { regions: Array.from({ length: 101 }, () => ['SkillsCard']) },
    };
    expect(sheetTemplateSchema.safeParse(template).success).toBe(false);
  });
});

describe('componentDefinitionSchema', () => {
  it('accepts named-slot prop references', () => {
    const component = {
      name: 'ResourceRow',
      props: ['resourceId'],
      body: [{ card: 'ResourceCard', props: { id: { $prop: 'resourceId' } } }],
    };
    expect(componentDefinitionSchema.safeParse(component).success).toBe(true);
  });

  it('accepts a component with no props referenced', () => {
    const component = {
      name: 'StaticHeader',
      body: ['TitleCard', { card: 'SubtitleCard' }],
    };
    expect(componentDefinitionSchema.safeParse(component).success).toBe(true);
  });

  it('rejects a raw expression string as a prop reference', () => {
    const component = {
      name: 'ResourceRow',
      props: ['resourceId'],
      body: [{ card: 'ResourceCard', props: { id: 'resourceId' } }],
    };
    expect(componentDefinitionSchema.safeParse(component).success).toBe(false);
  });
});
