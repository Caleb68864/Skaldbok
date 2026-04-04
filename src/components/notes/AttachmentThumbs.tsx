import { useState } from 'react';
import { cn } from '../../lib/utils';

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
    <div className="flex overflow-x-auto gap-2 py-2 [-webkit-overflow-scrolling:touch]">
      {attachments.map(attachment => (
        <div
          key={attachment.id}
          className="relative shrink-0 flex flex-col gap-2"
        >
          {/* Thumbnail image */}
          <div
            className="relative w-20 h-20 cursor-pointer"
            onClick={() => handleThumbClick(attachment.id)}
          >
            <img
              src={attachment.objectUrl}
              alt={attachment.caption ?? 'Attachment'}
              className={cn(
                "w-20 h-20 object-cover rounded-lg block",
                activeId === attachment.id
                  ? "border-2 border-[var(--color-accent,#7c6cf2)]"
                  : "border-2 border-transparent"
              )}
            />
            {/* Delete button */}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onDelete(attachment.id);
              }}
              aria-label="Delete attachment"
              className="absolute top-0.5 right-0.5 w-5 h-5 min-h-5 rounded-full border-none bg-black/60 text-white text-[11px] leading-none cursor-pointer flex items-center justify-center p-0"
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
              className="w-20 text-[11px] px-1 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] box-border"
            />
          )}
        </div>
      ))}
    </div>
  );
}
