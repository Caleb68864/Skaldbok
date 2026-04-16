import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBestiary, type CategoryFilter } from './useBestiary';
import { CreatureTemplateCard } from './CreatureTemplateCard';
import { CreatureTemplateForm } from './CreatureTemplateForm';
import type { CreatureTemplate } from '../../types/creatureTemplate';
import type { EncounterParticipant } from '../../types/encounter';
import { db } from '../../storage/db/client';
import { createLink } from '../../storage/repositories/entityLinkRepository';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';

interface BestiaryScreenProps {
  campaignId: string;
  activeEncounterId?: string;
  onClose?: () => void;
}

const categories: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'monster', label: 'Monster' },
  { value: 'npc', label: 'NPC' },
  { value: 'animal', label: 'Animal' },
];

const pillClass = 'min-h-9 px-3 rounded-full border-none cursor-pointer text-xs font-semibold';
const actionBtnClass = 'min-h-11 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-sm font-semibold cursor-pointer';

/**
 * Campaign-scoped bestiary screen. Displays creature templates with search,
 * category filtering, and CRUD operations.
 */
export function BestiaryScreen({ campaignId, activeEncounterId, onClose }: BestiaryScreenProps) {
  const { showToast } = useToast();
  const {
    templates,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    create,
    update,
    softDelete,
  } = useBestiary(campaignId);
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CreatureTemplate | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<CreatureTemplate | null>(null);

  const handleCreate = async (data: Omit<CreatureTemplate, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>) => {
    await create(data);
    setShowForm(false);
  };

  const handleEdit = async (data: Omit<CreatureTemplate, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>) => {
    if (!editingTemplate) return;
    await update(editingTemplate.id, data);
    setEditingTemplate(null);
    setViewingTemplate(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this creature? It can be restored from Trash.')) return;
    await softDelete(id);
    setViewingTemplate(null);
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[var(--color-text)] m-0">Bestiary</h2>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/bestiary/trash')}
            className="min-h-11 px-3 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-xs cursor-pointer"
            title="View deleted creatures"
          >
            View Trash
          </button>
          {onClose && (
            <button onClick={onClose} className="min-h-11 px-3 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-xs cursor-pointer">
              Back
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name or tag..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm mb-3 box-border"
      />

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap mb-3">
        {categories.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategoryFilter(c.value)}
            className={cn(
              pillClass,
              categoryFilter === c.value
                ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
                : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]'
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* New creature button */}
      <button onClick={() => setShowForm(true)} className={cn(actionBtnClass, 'w-full mb-4')}>
        New Creature
      </button>

      {/* Template list */}
      <div className="flex flex-col gap-2">
        {templates.length === 0 ? (
          <p className="text-[var(--color-text-muted)] text-sm text-center py-8">
            {search || categoryFilter !== 'all'
              ? 'No creatures match your filters.'
              : 'No creatures yet. Create your first!'}
          </p>
        ) : (
          templates.map((t) => (
            <CreatureTemplateCard
              key={t.id}
              template={t}
              onClick={() => setViewingTemplate(t)}
            />
          ))
        )}
      </div>

      {/* Stat block view (detail modal) */}
      {viewingTemplate && (
        <div
          role="dialog"
          aria-label="Creature stat block"
          onClick={() => setViewingTemplate(null)}
          className="fixed inset-0 bg-black/50 z-[300] flex items-end sm:items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--color-surface)] rounded-t-2xl sm:rounded-2xl w-full max-w-[480px] max-h-[85vh] overflow-y-auto px-4 pt-5 pb-6"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-[var(--color-text)] m-0">{viewingTemplate.name}</h3>
                <span className="text-xs text-[var(--color-text-muted)] capitalize">{viewingTemplate.category}</span>
                {viewingTemplate.role && <span className="text-xs text-[var(--color-text-muted)]"> &middot; {viewingTemplate.role}</span>}
                {viewingTemplate.affiliation && <span className="text-xs text-[var(--color-text-muted)]"> &middot; {viewingTemplate.affiliation}</span>}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-[var(--color-surface-raised)] rounded-lg p-3 text-center">
                <div className="text-[var(--color-text)] text-lg font-bold">{viewingTemplate.stats.hp}</div>
                <div className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider">HP</div>
              </div>
              <div className="bg-[var(--color-surface-raised)] rounded-lg p-3 text-center">
                <div className="text-[var(--color-text)] text-lg font-bold">{viewingTemplate.stats.armor}</div>
                <div className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider">Armor</div>
              </div>
              <div className="bg-[var(--color-surface-raised)] rounded-lg p-3 text-center">
                <div className="text-[var(--color-text)] text-lg font-bold">{viewingTemplate.stats.movement}</div>
                <div className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider">Movement</div>
              </div>
            </div>

            {/* Attacks */}
            {viewingTemplate.attacks.length > 0 && (
              <div className="mb-3">
                <h4 className="text-[var(--color-text)] text-xs font-semibold uppercase tracking-wide mb-1">Attacks</h4>
                {viewingTemplate.attacks.map((a, i) => (
                  <div key={i} className="text-sm text-[var(--color-text)] mb-1">
                    <span className="font-semibold">{a.name}</span> &mdash; {a.damage} ({a.range}, {a.skill})
                    {a.special && <span className="text-[var(--color-text-muted)]"> [{a.special}]</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Abilities */}
            {viewingTemplate.abilities.length > 0 && (
              <div className="mb-3">
                <h4 className="text-[var(--color-text)] text-xs font-semibold uppercase tracking-wide mb-1">Abilities</h4>
                {viewingTemplate.abilities.map((a, i) => (
                  <div key={i} className="text-sm text-[var(--color-text)] mb-1">
                    <span className="font-semibold">{a.name}:</span> {a.description}
                  </div>
                ))}
              </div>
            )}

            {/* Skills */}
            {viewingTemplate.skills.length > 0 && (
              <div className="mb-3">
                <h4 className="text-[var(--color-text)] text-xs font-semibold uppercase tracking-wide mb-1">Skills</h4>
                <div className="flex gap-2 flex-wrap">
                  {viewingTemplate.skills.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-[var(--color-surface-raised)] rounded text-xs text-[var(--color-text)]">
                      {s.name} {s.value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {viewingTemplate.tags.length > 0 && (
              <div className="mb-4">
                <div className="flex gap-1 flex-wrap">
                  {viewingTemplate.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-[var(--color-surface-raised)] rounded text-[10px] text-[var(--color-text-muted)]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {activeEncounterId && (
                <button
                  onClick={async () => {
                    // Create the participant and its `represents` edge in a
                    // single transaction so the two rows land atomically.
                    const now = nowISO();
                    const participantId = generateId();
                    const templateId = viewingTemplate.id;
                    const templateName = viewingTemplate.name;
                    const templateCategory = viewingTemplate.category;
                    const templateHp = viewingTemplate.stats.hp;
                    await db.transaction('rw', [db.encounters, db.entityLinks], async () => {
                      const enc = await db.encounters.get(activeEncounterId);
                      if (!enc) throw new Error(`encounter ${activeEncounterId} not found`);
                      const newParticipant: EncounterParticipant = {
                        id: participantId,
                        name: templateName,
                        type: templateCategory === 'monster' ? 'monster' : 'npc',
                        instanceState: { currentHp: templateHp },
                        sortOrder: (enc.participants?.length ?? 0) + 1,
                      };
                      await db.encounters.update(activeEncounterId, {
                        participants: [...(enc.participants ?? []), newParticipant],
                        updatedAt: now,
                      });
                      await createLink({
                        fromEntityId: participantId,
                        fromEntityType: 'encounterParticipant',
                        toEntityId: templateId,
                        toEntityType: 'creature',
                        relationshipType: 'represents',
                      });
                    });
                    showToast(`Added ${templateName} to encounter`, 'success');
                    setViewingTemplate(null);
                  }}
                  className="min-h-11 px-4 py-2 bg-emerald-600 text-white border-none rounded-lg text-sm font-semibold cursor-pointer"
                >
                  Add to Encounter
                </button>
              )}
              <button
                onClick={() => {
                  setEditingTemplate(viewingTemplate);
                }}
                className="min-h-11 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-sm font-semibold cursor-pointer"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(viewingTemplate.id)}
                className="min-h-11 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm cursor-pointer"
              >
                Delete
              </button>
              <button
                onClick={() => setViewingTemplate(null)}
                className="min-h-11 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <CreatureTemplateForm
          campaignId={campaignId}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Edit form */}
      {editingTemplate && (
        <CreatureTemplateForm
          initial={editingTemplate}
          campaignId={campaignId}
          onSave={handleEdit}
          onCancel={() => setEditingTemplate(null)}
        />
      )}
    </div>
  );
}
