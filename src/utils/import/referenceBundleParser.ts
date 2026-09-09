import {
  referenceImportSectionSchema,
  referenceImportGroupSchema,
  referenceImportPageSchema,
  type ReferenceImportBundle,
} from '../../types/reference';
import type { ValidationWarning } from './bundleParser';

/**
 * Result of validating a reference import file.
 *
 * @remarks
 * Mirrors {@link ParsedBundleResult}: a structural failure rejects the file,
 * while a single malformed row is dropped with a warning so the rest of a
 * mostly-good bundle still imports.
 */
export type ParsedReferenceBundleResult =
  | { success: true; bundle: ReferenceImportBundle; warnings: ValidationWarning[] }
  | { success: false; error: string };

/**
 * Validates a parsed reference import file row by row.
 *
 * @remarks
 * The reference import was the last JSON path in the app with no validation at
 * all: `JSON.parse(...) as ReferenceImportBundle` and straight into a
 * `bulkPut`. A section whose `rows` was a string, or whose `items` held numbers
 * where the renderer reads `label`, was written to IndexedDB and crashed the
 * Reference screen on every later visit — and because the write is keyed by
 * `id`, it could land on top of a section that had been fine.
 *
 * Every other bundle type in the app is validated with a per-entity Zod schema
 * and `safeParse` (never `.parse()`), keeping valid rows and warning about the
 * rest. This is that, for reference files.
 *
 * @param raw - The result of `JSON.parse` on the imported file.
 * @returns The validated bundle plus one warning per dropped row.
 */
export function parseReferenceBundle(raw: unknown): ParsedReferenceBundleResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { success: false, error: 'Invalid format: expected a JSON object.' };
  }

  const obj = raw as Record<string, unknown>;
  const warnings: ValidationWarning[] = [];

  const sections = validateArray(obj['referenceSections'], 'referenceSection', referenceImportSectionSchema, warnings);
  const groups = validateArray(obj['referenceGroups'], 'referenceGroup', referenceImportGroupSchema, warnings);
  const pages = validateArray(obj['referencePages'], 'referencePage', referenceImportPageSchema, warnings);

  if (sections === undefined && groups === undefined && pages === undefined) {
    return {
      success: false,
      error: 'Not a reference file: no referenceSections, referenceGroups or referencePages.',
    };
  }

  return {
    success: true,
    bundle: {
      referenceSections: sections,
      referenceGroups: groups,
      referencePages: pages,
    },
    warnings,
  };
}

/** A `safeParse`-shaped validator, kept structural so any Zod version fits. */
interface RowSchema<T> {
  safeParse: (input: unknown) => {
    success: boolean;
    data?: T;
    error?: { issues: Array<{ path: Array<string | number>; message: string }> };
  };
}

/**
 * Filters one array of rows, dropping and reporting the ones that fail.
 *
 * @remarks
 * A key present but not an array is itself a warning rather than a silent
 * `undefined`: `referenceSections: {}` should not read as "no sections".
 */
function validateArray<T>(
  value: unknown,
  entityType: string,
  schema: RowSchema<T>,
  warnings: ValidationWarning[],
): T[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    warnings.push({
      entityType,
      entityIndex: 0,
      path: '',
      message: `Expected an array, got ${typeof value}. Ignored.`,
    });
    return undefined;
  }

  const kept: T[] = [];
  value.forEach((row, index) => {
    const result = schema.safeParse(row);
    if (result.success && result.data !== undefined) {
      kept.push(result.data);
      return;
    }
    const issue = result.error?.issues[0];
    warnings.push({
      entityType,
      entityIndex: index,
      path: issue?.path.join('.') ?? '',
      message: issue?.message ?? 'Invalid row.',
    });
  });
  return kept;
}
