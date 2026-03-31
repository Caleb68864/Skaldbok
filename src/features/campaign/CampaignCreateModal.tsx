import React, { useState } from 'react';
import { useCampaignContext } from './CampaignContext';
import { createCampaign } from '../../storage/repositories/campaignRepository';
import { createParty } from '../../storage/repositories/partyRepository';
import { updateCampaign } from '../../storage/repositories/campaignRepository';
import { useToast } from '../../context/ToastContext';

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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: '16px 16px 0 0',
          width: '100%',
          maxWidth: 480,
          padding: '24px 16px 32px',
        }}
      >
        <h2 style={{ color: 'var(--color-text)', marginBottom: '16px' }}>Create Campaign</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', marginBottom: '4px', fontSize: '14px' }}>
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
              style={{
                width: '100%',
                padding: '10px 12px',
                minHeight: '44px',
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                color: 'var(--color-text)',
                fontSize: '16px',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', marginBottom: '4px', fontSize: '14px' }}>
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description..."
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                color: 'var(--color-text)',
                fontSize: '16px',
                minHeight: '80px',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              style={{
                flex: 1,
                minHeight: '44px',
                background: 'var(--color-accent)',
                color: 'var(--color-on-accent, #fff)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving || !name.trim() ? 0.6 : 1,
              }}
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                minHeight: '44px',
                minWidth: '80px',
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
