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
}
