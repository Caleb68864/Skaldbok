import { useState, useEffect, useRef } from 'react';
import { TiptapNoteEditor } from '../../components/notes/TiptapNoteEditor';
import { TagPicker } from '../../components/notes/TagPicker';
import { AttachButton } from '../../components/notes/AttachButton';
import { AttachmentThumbs } from '../../components/notes/AttachmentThumbs';
import { useNoteActions } from './useNoteActions';
import { useCampaignContext } from '../campaign/CampaignContext';
import * as attachmentRepository from '../../storage/repositories/attachmentRepository';

interface QuickLocationDrawerProps {
  onClose: () => void;
  onSaved: () => void;
}

export function QuickLocationDrawer({ onClose, onSaved }: QuickLocationDrawerProps) {
  const [name, setName] = useState('');
  const [locationType, setLocationType] = useState('');
  const [region, setRegion] = useState('');
  const [body, setBody] = useState<unknown>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const pendingUrlsRef = useRef<string[]>([]);
  const { createNote } = useNoteActions();
  const { activeCampaign } = useCampaignContext();

  // Build preview entries for pending files
  const pendingThumbs = pendingFiles.map((_, index) => ({
    id: `pending-${index}`,
    objectUrl: pendingUrlsRef.current[index] ?? '',
    caption: undefined,
  }));

  // Revoke pending preview URLs on unmount
  useEffect(() => {
    return () => {
      pendingUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const handleFileSelected = (file: File) => {
    const url = URL.createObjectURL(file);
    pendingUrlsRef.current = [...pendingUrlsRef.current, url];
    setPendingFiles(prev => [...prev, file]);
  };

  const handlePendingDelete = (id: string) => {
    const index = parseInt(id.replace('pending-', ''), 10);
    const url = pendingUrlsRef.current[index];
    if (url) URL.revokeObjectURL(url);
    pendingUrlsRef.current = pendingUrlsRef.current.filter((_, i) => i !== index);
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const note = await createNote({
      title: name.trim(),
      type: 'location',
      body,
      pinned: false,
      status: 'active',
      tags: tags.length > 0 ? tags : undefined,
      typeData: {
        locationType: locationType.trim() || undefined,
        region: region.trim() || undefined,
      },
    });
    if (note && activeCampaign) {
      for (const file of pendingFiles) {
        try {
          await attachmentRepository.createAttachment(note.id, activeCampaign.id, file);
        } catch (e) {
          console.error('QuickLocationDrawer: failed to save attachment', e);
        }
      }
    }
    onSaved();
    onClose();
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    minHeight: '44px',
    background: 'var(--color-surface-raised)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    color: 'var(--color-text)',
    fontSize: '16px',
    marginBottom: '10px',
    boxSizing: 'border-box' as const,
  };

  return (
    <div
      role="dialog"
      aria-label="Quick Location"
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
          maxHeight: '80dvh',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ color: 'var(--color-text)', marginBottom: '12px' }}>Quick Location</h3>
        <input
          type="text"
          placeholder="Location name (required)"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="Type — tavern, dungeon, town... (optional)"
          value={locationType}
          onChange={e => setLocationType(e.target.value)}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="Region (optional)"
          value={region}
          onChange={e => setRegion(e.target.value)}
          style={inputStyle}
        />
        <TagPicker selected={tags} onToggle={tag => setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} />
        <div style={{ marginBottom: '8px' }}>
          <AttachButton onFileSelected={handleFileSelected} disabled={pendingFiles.length >= 10} />
          <AttachmentThumbs
            attachments={pendingThumbs}
            onDelete={handlePendingDelete}
            onCaptionChange={() => { /* captions saved post-creation */ }}
          />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <TiptapNoteEditor
            initialContent={null}
            onChange={setBody}
            campaignId={activeCampaign?.id ?? null}
            placeholder="Notes about this location (optional)..."
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            style={{
              flex: 1,
              minHeight: '44px',
              minWidth: '44px',
              background: 'var(--color-accent)',
              color: 'var(--color-on-accent, #fff)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: !name.trim() ? 0.6 : 1,
            }}
          >
            Save Location
          </button>
          <button
            onClick={onClose}
            style={{
              minHeight: '44px',
              minWidth: '44px',
              padding: '0 16px',
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
      </div>
    </div>
  );
}
