import { useState, useEffect, useCallback } from 'react';
import type { CreatureTemplate } from '../../types/creatureTemplate';
import * as creatureTemplateRepository from '../../storage/repositories/creatureTemplateRepository';

export type CategoryFilter = 'all' | 'monster' | 'npc' | 'animal';

/**
 * Hook for managing the bestiary UI state: loading, searching, filtering,
 * and CRUD operations on creature templates for a given campaign.
 *
 * @param campaignId - The active campaign's ID. Templates are scoped to this campaign.
 */
export function useBestiary(campaignId: string) {
  const [templates, setTemplates] = useState<CreatureTemplate[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showArchived, setShowArchived] = useState(false);

  const loadTemplates = useCallback(async () => {
    const all = await creatureTemplateRepository.listByCampaign(campaignId);
    setTemplates(all);
  }, [campaignId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const filtered = templates.filter((t) => {
    if (!showArchived && t.status === 'archived') return false;
    if (showArchived && t.status !== 'archived') return false;
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

  const archive = useCallback(
    async (id: string) => {
      await creatureTemplateRepository.archive(id);
      await loadTemplates();
    },
    [loadTemplates]
  );

  return {
    templates: filtered,
    allTemplates: templates,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    showArchived,
    setShowArchived,
    create,
    update,
    archive,
    refresh: loadTemplates,
  };
}
