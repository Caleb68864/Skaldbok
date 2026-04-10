import { useState, useEffect, useCallback } from 'react';
import * as creatureTemplateRepository from '../../storage/repositories/creatureTemplateRepository';
import type { CreatureTemplate } from '../../types/creatureTemplate';

export interface EncounterParticipantPickerProps {
  /** Called with the selected (or newly-created) creature template. */
  onSelect: (template: CreatureTemplate) => Promise<void> | void;
  /** The campaign id needed to create new bestiary entries inline. */
  campaignId: string;
  /** Called when the picker should close (submitted or cancelled). */
  onClose?: () => void;
}

type Mode = 'search' | 'create';

export function EncounterParticipantPicker({
  onSelect,
  campaignId,
  onClose,
}: EncounterParticipantPickerProps) {
  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CreatureTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Inline create form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<'monster' | 'npc' | 'animal'>('monster');
  const [newHp, setNewHp] = useState<string>('');
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const all = await creatureTemplateRepository.listByCampaign(campaignId);
        if (cancelled) return;
        const trimmed = query.trim().toLowerCase();
        const filtered = trimmed
          ? all.filter((t) => t.name.toLowerCase().includes(trimmed))
          : all;
        setResults(filtered);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [campaignId, query]);

  const handleSelectExisting = useCallback(
    async (template: CreatureTemplate) => {
      setSubmitting(true);
      try {
        await onSelect(template);
        onClose?.();
      } finally {
        setSubmitting(false);
      }
    },
    [onSelect, onClose],
  );

  const handleCreateNew = useCallback(async () => {
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      const hpNum = newHp ? parseInt(newHp, 10) : 0;
      const created = await creatureTemplateRepository.create({
        campaignId,
        name: newName.trim(),
        description: newDescription.trim() ? newDescription.trim() : undefined,
        category: newCategory,
        stats: { hp: Number.isNaN(hpNum) ? 0 : hpNum, armor: 0, movement: 0 },
        attacks: [],
        abilities: [],
        skills: [],
        tags: [],
        status: 'active',
      });
      if (!created) return;
      await onSelect(created);
      onClose?.();
    } finally {
      setSubmitting(false);
    }
  }, [newName, newCategory, newHp, newDescription, campaignId, onSelect, onClose]);

  if (mode === 'create') {
    return (
      <div className="p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Create new bestiary entry</h3>
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="px-2 py-1 border border-neutral-300 rounded"
            placeholder="e.g. Kobold Skirmisher"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as 'monster' | 'npc' | 'animal')}
            className="px-2 py-1 border border-neutral-300 rounded"
          >
            <option value="monster">Monster</option>
            <option value="npc">NPC</option>
            <option value="animal">Animal</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          HP (optional)
          <input
            type="number"
            value={newHp}
            onChange={(e) => setNewHp(e.target.value)}
            className="px-2 py-1 border border-neutral-300 rounded"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Description (optional)
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="px-2 py-1 border border-neutral-300 rounded"
            rows={2}
          />
        </label>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setMode('search')}
            className="px-3 py-1 text-sm text-neutral-600"
            disabled={submitting}
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleCreateNew}
            disabled={!newName.trim() || submitting}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Create and add
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-2 min-w-[320px]">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search bestiary…"
        className="px-2 py-1 border border-neutral-300 rounded"
      />
      {loading ? (
        <div className="text-sm text-neutral-500 py-2">Searching…</div>
      ) : (
        <ul className="flex flex-col gap-1 max-h-64 overflow-auto">
          {results.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => handleSelectExisting(t)}
                disabled={submitting}
                className="w-full text-left px-2 py-1 text-sm hover:bg-neutral-100 rounded"
              >
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-xs text-neutral-500">{t.category}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && !loading && (
            <li className="text-xs text-neutral-500 px-2 py-1">No matches</li>
          )}
        </ul>
      )}
      {query.trim() && (
        <button
          type="button"
          onClick={() => {
            setNewName(query.trim());
            setMode('create');
          }}
          className="text-left px-2 py-1 text-sm border-t border-neutral-200 mt-1 hover:bg-neutral-50"
        >
          + Create new "{query.trim()}"
        </button>
      )}
    </div>
  );
}
