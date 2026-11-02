import { z } from 'zod';
import { referenceSectionSchema, type ReferenceSection } from '../../types/reference';

const tableBodySchema = z.object({
  columns: referenceSectionSchema.shape.columns,
  rows: referenceSectionSchema.shape.rows,
});
const itemsBodySchema = z.array(z.object({ label: z.string(), description: z.string() }));

function validated<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new Error(result.error.issues.map(i => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '));
}

/**
 * Turns the in-app editor's text back into a reference section.
 *
 * @remarks
 * The table and key/value bodies are hand-edited JSON, and were cast rather than
 * checked: valid JSON of the wrong shape was stored, and crashed the Reference
 * screen on every later visit. Throws, with the offending path, so the editor can
 * refuse the save. This is the same rule the import path enforces.
 */
export function parseEditorBody(section: ReferenceSection, body: string): ReferenceSection {
  if (section.type === 'table') {
    const parsed = validated(tableBodySchema, JSON.parse(body || '{"columns":[],"rows":[]}'));
    return { ...section, columns: parsed.columns ?? [], rows: parsed.rows ?? [], items: undefined, paragraphs: undefined };
  }
  if (section.type === 'key_value_list') {
    const parsed = validated(itemsBodySchema, JSON.parse(body || '[]'));
    return { ...section, items: parsed, columns: undefined, rows: undefined, paragraphs: undefined };
  }
  return {
    ...section,
    paragraphs: body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean),
    columns: undefined,
    rows: undefined,
    items: undefined,
  };
}
