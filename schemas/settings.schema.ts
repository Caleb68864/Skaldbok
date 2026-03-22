import { z } from 'zod';

export const appSettingsSchema = z.object({
  id: z.string().describe('Settings record id (always "default")'),
  schemaVersion: z.number().int().positive().describe('Schema version'),
  activeCharacterId: z.string().nullable().describe('Currently active character id'),
  theme: z.enum(['dark', 'parchment', 'light']).describe('Active theme name'),
  mode: z.enum(['play', 'edit']).describe('Active mode'),
  wakeLockEnabled: z.boolean().describe('Whether wake lock is enabled'),
});

export type AppSettingsSchema = z.infer<typeof appSettingsSchema>;
