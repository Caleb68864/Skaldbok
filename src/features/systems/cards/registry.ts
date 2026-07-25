import type { ComponentType } from 'react';
import { ResourceModule } from '../../playDashboard/ResourceModule';
import { DerivedStatsModule } from '../../playDashboard/DerivedStatsModule';
import { ConditionModule } from '../../playDashboard/ConditionModule';
import { DamageHealModule } from '../../playDashboard/DamageHealModule';
import { CurrencyModule } from '../../playDashboard/CurrencyModule';
import { SkillModule } from '../../playDashboard/SkillModule';
import { CombatModule } from '../../playDashboard/CombatModule';
import { AbilityModule } from '../../playDashboard/AbilityModule';
import { MagicModule } from '../../playDashboard/MagicModule';
import { RestModule } from '../../playDashboard/RestModule';
import { StoryBankModule } from '../../playDashboard/StoryBankModule';
import { QuickReferenceModule } from '../../playDashboard/QuickReferenceModule';
import { TileCard } from './primitives/TileCard';
import { TableCard } from './primitives/TableCard';
import { ToggleGridCard } from './primitives/ToggleGridCard';

/** Every card key a template's `CardEntry.card` may reference. */
export type CardKey =
  | 'vitals'
  | 'derived'
  | 'conditions'
  | 'damageHeal'
  | 'currency'
  | 'skills'
  | 'readyGear'
  | 'abilities'
  | 'magic'
  | 'rest'
  | 'storyBank'
  | 'quickReference'
  | 'tile'
  | 'table'
  | 'toggleGrid';

/**
 * Maps a card key to its component. Smart-card keys resolve to the existing
 * `src/features/playDashboard/*` modules (imported, not rewritten); the three
 * primitive keys resolve to the generic components in `./primitives`.
 *
 * @remarks
 * Every entry accepts at least {@link PlayModuleProps} — smart cards ignore
 * any extra `props` a template supplies, while primitives read their
 * declarative shape out of `props`.
 */
export const CARD_REGISTRY: Record<CardKey, ComponentType<any>> = {
  vitals: ResourceModule,
  derived: DerivedStatsModule,
  conditions: ConditionModule,
  damageHeal: DamageHealModule,
  currency: CurrencyModule,
  skills: SkillModule,
  readyGear: CombatModule,
  abilities: AbilityModule,
  magic: MagicModule,
  rest: RestModule,
  storyBank: StoryBankModule,
  quickReference: QuickReferenceModule,
  tile: TileCard,
  table: TableCard,
  toggleGrid: ToggleGridCard,
};

/** True when `key` is a recognized entry in {@link CARD_REGISTRY}. */
export function isCardKey(key: string): key is CardKey {
  return Object.prototype.hasOwnProperty.call(CARD_REGISTRY, key);
}
