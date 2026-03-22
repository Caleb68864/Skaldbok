import { z } from 'zod';

const attributeDefinitionSchema = z.object({
  id: z.string().min(1).describe('Unique attribute identifier'),
  name: z.string().min(1).describe('Attribute display name'),
  abbreviation: z.string().min(1).describe('Short abbreviation, e.g. STR'),
  min: z.number().describe('Minimum attribute value'),
  max: z.number().describe('Maximum attribute value'),
});

const conditionDefinitionSchema = z.object({
  id: z.string().min(1).describe('Unique condition identifier'),
  name: z.string().min(1).describe('Condition display name'),
  linkedAttributeId: z.string().min(1).describe('Attribute this condition is linked to'),
  description: z.string().describe('Short description of the condition effect'),
});

const resourceDefinitionSchema = z.object({
  id: z.string().min(1).describe('Unique resource identifier'),
  name: z.string().min(1).describe('Resource display name'),
  derivedFrom: z.string().optional().describe('Attribute id this resource derives from'),
  min: z.number().describe('Minimum resource value'),
  defaultMax: z.number().describe('Default maximum value'),
});

const skillDefinitionSchema = z.object({
  id: z.string().min(1).describe('Unique skill identifier'),
  name: z.string().min(1).describe('Skill display name'),
  baseChance: z.number().describe('Base chance percentage'),
  linkedAttributeId: z.string().optional().describe('Linked attribute id'),
});

const skillCategorySchema = z.object({
  id: z.string().min(1).describe('Unique category identifier'),
  name: z.string().min(1).describe('Category display name'),
  skills: z.array(skillDefinitionSchema).describe('Skills in this category'),
});

const sectionLayoutSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  sections: z.array(z.string()),
});

export const systemDefinitionSchema = z.object({
  id: z.string().min(1).describe('Unique system identifier'),
  version: z.number().int().positive().describe('System definition version'),
  name: z.string().min(1).describe('System machine name'),
  displayName: z.string().min(1).describe('Human-readable system name'),
  attributes: z.array(attributeDefinitionSchema).describe('Attribute definitions'),
  conditions: z.array(conditionDefinitionSchema).describe('Condition definitions'),
  resources: z.array(resourceDefinitionSchema).describe('Resource definitions'),
  skillCategories: z.array(skillCategorySchema).describe('Grouped skill definitions'),
  sectionLayouts: z.array(sectionLayoutSchema).optional().describe('Optional section layout overrides'),
});

export type SystemDefinitionSchema = z.infer<typeof systemDefinitionSchema>;
