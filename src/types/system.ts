export interface AttributeDefinition {
  id: string;
  name: string;
  abbreviation: string;
  min: number;
  max: number;
}

export interface ConditionDefinition {
  id: string;
  name: string;
  linkedAttributeId: string;
  description: string;
}

export interface ResourceDefinition {
  id: string;
  name: string;
  derivedFrom?: string;
  min: number;
  defaultMax: number;
}

export interface SkillDefinition {
  id: string;
  name: string;
  baseChance: number;
  linkedAttributeId?: string;
}

export interface SkillCategory {
  id: string;
  name: string;
  skills: SkillDefinition[];
}

export interface SectionLayout {
  id: string;
  label: string;
  sections: string[];
}

export interface SystemDefinition {
  id: string;
  version: number;
  name: string;
  displayName: string;
  attributes: AttributeDefinition[];
  conditions: ConditionDefinition[];
  resources: ResourceDefinition[];
  skillCategories: SkillCategory[];
  sectionLayouts?: SectionLayout[];
  themesSupported?: string[];
  resolution?: 'd20-roll-under' | '2d6-plus';
  currency?: { label: string; abbr: string; mode: 'coins' | 'single' };
  /**
   * Optional overrides for system vocabulary (see `SystemTerms` in the engine).
   * Any omitted key falls back to the engine adapter's default.
   */
  terms?: Partial<{
    abilities: string;
    spells: string;
    magicResource: string;
    healthResource: string;
    roleFallback: string;
  }>;
  /**
   * Optional overrides for panel/screen titles (see `SystemLabels`).
   * `abilitiesScreen: null` hides the abilities/magic tab for this system.
   */
  labels?: Partial<{
    abilitiesScreen: string | null;
    resourcesPanel: string;
    attributesPanel: string;
    encumbrance: string;
  }>;
}
