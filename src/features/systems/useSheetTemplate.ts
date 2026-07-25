import { useState, useEffect } from 'react';
import type { z } from 'zod';
import * as metadataRepository from '../../storage/repositories/metadataRepository';
import { sheetTemplateSchema } from './cards/schema';

export type SheetTemplate = z.infer<typeof sheetTemplateSchema>;

/** All bundled `sheet.json` templates, keyed by system id. */
const BUNDLED_SHEET_TEMPLATES: Record<string, unknown> = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../systems/*/sheet.json', { eager: true }) as Record<string, { default: unknown }>
  )
    .map(([path, mod]) => {
      // Key by the system-id folder. The `?? path` fallback should never fire
      // for a well-formed glob path; if it did, the entry keys on its full path
      // and is simply unreachable (no systemId lookup will match it) — dropped,
      // not crashed.
      const match = path.match(/systems\/([^/]+)\/sheet\.json$/);
      return [match?.[1] ?? path, mod.default] as const;
    })
);

function metadataKey(systemId: string): string {
  return `sheet_template_${systemId}`;
}

export interface ResolveSheetTemplateResult {
  /** The validated template to serve, or `null` if none is available/valid. */
  template: SheetTemplate | null;
  /** Set when a bundled or cached template failed schema validation. */
  error: string | null;
  /** The template to persist to the cache, if the bundled copy should replace it. */
  cacheWrite: SheetTemplate | null;
}

/**
 * Pure decision function behind {@link useSheetTemplate}.
 *
 * @remarks
 * Mirrors the version-gated refresh in `useSystemDefinition`: a bundled
 * template with a higher `version` than the cached copy wins and is written
 * back to the cache. An invalid bundled or cached template surfaces `error`
 * and yields a `null` template rather than throwing.
 */
export function resolveSheetTemplate(bundled: unknown, cached: unknown): ResolveSheetTemplateResult {
  const bundledResult = bundled !== undefined ? sheetTemplateSchema.safeParse(bundled) : undefined;
  if (bundledResult && !bundledResult.success) {
    return { template: null, error: `Invalid bundled sheet template: ${bundledResult.error.message}`, cacheWrite: null };
  }
  const bundledTemplate = bundledResult?.success ? bundledResult.data : undefined;

  const cachedResult = cached !== undefined ? sheetTemplateSchema.safeParse(cached) : undefined;
  if (cachedResult && !cachedResult.success) {
    if (bundledTemplate) {
      return { template: bundledTemplate, error: null, cacheWrite: bundledTemplate };
    }
    return { template: null, error: `Invalid cached sheet template: ${cachedResult.error.message}`, cacheWrite: null };
  }
  const cachedTemplate = cachedResult?.success ? cachedResult.data : undefined;

  if (bundledTemplate && (!cachedTemplate || cachedTemplate.version < bundledTemplate.version)) {
    return { template: bundledTemplate, error: null, cacheWrite: bundledTemplate };
  }
  if (cachedTemplate) {
    return { template: cachedTemplate, error: null, cacheWrite: null };
  }
  if (bundledTemplate) {
    return { template: bundledTemplate, error: null, cacheWrite: bundledTemplate };
  }
  return { template: null, error: null, cacheWrite: null };
}

/**
 * Loads a {@link SheetTemplate} for a system, preferring the cached copy but
 * refreshing it when this build ships a bundled `sheet.json` with a newer
 * `version`. Systems this build does not bundle a template for are served
 * from the cache untouched.
 */
export function useSheetTemplate(systemId: string) {
  const [template, setTemplate] = useState<SheetTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setError(null);

    metadataRepository.get(metadataKey(systemId)).then(async cachedRaw => {
      if (!mounted) return;

      let cached: unknown;
      if (cachedRaw !== undefined) {
        try {
          cached = JSON.parse(cachedRaw);
        } catch {
          cached = undefined;
        }
      }

      const bundled = BUNDLED_SHEET_TEMPLATES[systemId];
      const result = resolveSheetTemplate(bundled, cached);

      if (result.cacheWrite) {
        await metadataRepository.set(metadataKey(systemId), JSON.stringify(result.cacheWrite));
      }
      if (!mounted) return;

      setTemplate(result.template);
      setError(result.error);
      setIsLoading(false);
    }).catch(err => {
      if (mounted) {
        setError(String(err));
        setIsLoading(false);
      }
    });

    return () => { mounted = false; };
  }, [systemId]);

  return { template, isLoading, error };
}
