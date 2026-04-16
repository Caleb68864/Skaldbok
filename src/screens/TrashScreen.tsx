import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as creatureTemplateRepository from '../storage/repositories/creatureTemplateRepository';
import type { CreatureTemplate } from '../types/creatureTemplate';

/**
 * Lists soft-deleted creature templates with per-row Restore. MVP scope:
 * creatures only. Structured so other entity types (sessions, notes) can be
 * added later without reshaping the screen.
 */
export default function TrashScreen() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [deleted, setDeleted] = useState<CreatureTemplate[]>([]);

  async function refresh() {
    setLoading(true);
    try {
      const rows = await creatureTemplateRepository.getDeleted();
      setDeleted(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleRestore(id: string) {
    await creatureTemplateRepository.restore(id);
    await refresh();
  }

  const backButton = (
    <button
      onClick={() => navigate('/bestiary')}
      className="min-h-11 px-3 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-xs cursor-pointer"
    >
      ← Bestiary
    </button>
  );

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          {backButton}
          <h1 className="text-[var(--color-text)] text-lg m-0">Trash</h1>
        </div>
        <p className="text-[var(--color-text-muted)] text-sm text-center py-8">
          Loading deleted creatures…
        </p>
      </div>
    );
  }

  if (deleted.length === 0) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          {backButton}
          <h1 className="text-[var(--color-text)] text-lg m-0">Trash</h1>
        </div>
        <div className="mt-6 p-6 border border-[var(--color-border)] rounded-lg text-center text-[var(--color-text-muted)] text-sm">
          Nothing deleted. Deleted creatures show up here with a Restore button.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        {backButton}
        <h1 className="text-[var(--color-text)] text-lg m-0">Trash</h1>
      </div>
      <ul className="flex flex-col gap-2 list-none p-0 m-0">
        {deleted.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg"
          >
            <div className="flex flex-col gap-1">
              <div className="text-[var(--color-text)] font-medium">{c.name}</div>
              <div className="text-[var(--color-text-muted)] text-xs">
                <span className="capitalize">{c.category}</span>
                {c.deletedAt && (
                  <> · Deleted {new Date(c.deletedAt).toLocaleString()}</>
                )}
              </div>
            </div>
            <button
              onClick={() => handleRestore(c.id)}
              className="min-h-11 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-sm font-semibold cursor-pointer"
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
