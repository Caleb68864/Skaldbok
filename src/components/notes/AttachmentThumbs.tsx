import { useState } from 'react';

interface AttachmentThumb {
  id: string;
  objectUrl: string;
  caption?: string;
}

interface AttachmentThumbsProps {
  attachments: AttachmentThumb[];
  onDelete: (id: string) => void;
  onCaptionChange: (id: string, caption: string) => void;
}

export function AttachmentThumbs({ attachments, onDelete, onCaptionChange }: AttachmentThumbsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  function handleThumbClick(id: string) {
    setActiveId(prev => (prev === id ? null : id));
  }

  function handleCaptionChange(id: string, value: string) {
    onCaptionChange(id, value);
  }

  return (
    <div
      style={{
        display: 'flex',
        overflowX: 'auto',
        gap: '8px',
        padding: '8px 0',
        // Prevent vertical scroll bleed on mobile
        WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
      }}
    >
      {attachments.map(attachment => (
        <div
          key={attachment.id}
          style={{
            position: 'relative',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {/* Thumbnail image */}
          <div
            style={{ position: 'relative', width: '80px', height: '80px', cursor: 'pointer' }}
            onClick={() => handleThumbClick(attachment.id)}
          >
            <img
              src={attachment.objectUrl}
              alt={attachment.caption ?? 'Attachment'}
              style={{
                width: '80px',
                height: '80px',
                objectFit: 'cover',
                borderRadius: '8px',
                border: activeId === attachment.id ? '2px solid var(--color-accent, #7c6cf2)' : '2px solid transparent',
                display: 'block',
              }}
            />
            {/* Delete button */}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onDelete(attachment.id);
              }}
              aria-label="Delete attachment"
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                width: '20px',
                height: '20px',
                minHeight: '20px',
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                fontSize: '11px',
                lineHeight: 1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              ×
            </button>
          </div>

          {/* Inline caption input — shown when thumb is active */}
          {activeId === attachment.id && (
            <input
              type="text"
              value={attachment.caption ?? ''}
              placeholder="Add caption..."
              onChange={e => handleCaptionChange(attachment.id, e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{
                width: '80px',
                fontSize: '11px',
                padding: '2px 4px',
                borderRadius: '4px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text-muted)',
                boxSizing: 'border-box',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
