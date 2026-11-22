import { useState, useEffect, useCallback } from 'react';
import type { CreatureTemplate } from '../../types/creatureTemplate';
import * as creatureTemplateRepository from '../../storage/repositories/creatureTemplateRepository';

export type CategoryFilter = 'all' | 'monster' | 'npc' | 'animal';

/**
 * Hook for managing the bestiary UI state: loading, searching, filtering,
 * and CRUD operations on creature templates for a given campaign.
 *
 * Soft-deleted templates never appear here — they live exclusively on the
 * Trash screen at /bestiary/trash.
 *
 * @param campaignId - The active campaign's ID. Templates are scoped to this campaign.
 */
export function useBestiary(campaignId: string) {
  const [templates, setTemplates] = useState<CreatureTemplate[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  /** A failed read of the bestiary, or `null`. */
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    // listByCampaign already filters deletedAt via excludeDeleted. It used to
    // answer a failed read with `[]`, which this showed as "No creatures yet".
    try {
      const all = await creatureTemplateRepository.listByCampaign(campaignId);
      setTemplates(all);
      setLoadError(null);
    } catch (e) {
      console.error('useBestiary: load failed', e);
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [campaignId]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const filtered = templates.filter((t) => {
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const create = useCallback(
    async (data: Omit<CreatureTemplate, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>) => {
      await creatureTemplateRepository.create(data);
      await loadTemplates();
    },
    [loadTemplates]
  );

  const update = useCallback(
    async (id: string, patch: Partial<CreatureTemplate>) => {
      await creatureTemplateRepository.update(id, patch);
      await loadTemplates();
    },
    [loadTemplates]
  );

  const softDelete = useCallback(
    async (id: string) => {
      await creatureTemplateRepository.softDelete(id);
      await loadTemplates();
    },
    [loadTemplates]
  );

  return {
    templates: filtered,
    allTemplates: templates,
    loadError,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    create,
    update,
    softDelete,
    refresh: loadTemplates,
  };
}
