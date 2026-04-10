import React, { useState } from 'react';
import { useCampaignContext } from './CampaignContext';
import { createCampaign } from '../../storage/repositories/campaignRepository';
import { createParty } from '../../storage/repositories/partyRepository';
import { updateCampaign } from '../../storage/repositories/campaignRepository';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';

interface CampaignCreateModalProps {
  onClose: () => void;
}

export function CampaignCreateModal({ onClose }: CampaignCreateModalProps) {
  const { setActiveCampaign } = useCampaignContext();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const campaign = await createCampaign({
        name: name.trim(),
        description: description.trim() || undefined,
        system: 'dragonbane',
        status: 'active',
      });

      // Auto-create party for the campaign
      const party = await createParty({
        campaignId: campaign.id,
        name: `${campaign.name} Party`,
      });

      // Store partyId on campaign
      await updateCampaign(campaign.id, { activePartyId: party.id });

      // Set this as active campaign
      await setActiveCampaign(campaign.id);
      onClose();
    } catch (e) {
      showToast('Failed to create campaign');
      console.error('CampaignCreateModal: failed', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Create campaign"
      onClick={onClose}
      className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[var(--color-surface)] rounded-t-2xl w-full max-w-[480px] px-4 pt-6 pb-8"
      >
        <h2 className="text-[var(--color-text)] mb-4">Create Campaign</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-[var(--color-text-muted)] mb-1 text-sm">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Campaign name"
              autoFocus
              minLength={1}
              required
              className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base box-border"
            />
          </div>
          <div className="mb-4">
            <label className="block text-[var(--color-text-muted)] mb-1 text-sm">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description..."
              className="w-full px-3 py-2.5 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base min-h-20 resize-y box-border"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className={cn(
                'flex-1 min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold',
                saving ? 'cursor-wait' : 'cursor-pointer',
                (saving || !name.trim()) ? 'opacity-60' : 'opacity-100'
              )}
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 min-w-20 bg-[var(--color-surface-raised)] text-[var(--color-text)] border border-[var(--color-border)] rounded-lg text-base cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
