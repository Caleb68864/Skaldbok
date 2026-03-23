import { useState, useRef } from 'react';
import { useToast } from '../../context/ToastContext';

interface CharacterPortraitProps {
  portraitUri?: string;
  characterName: string;
  isEditMode: boolean;
  onPortraitChange: (dataUrl: string) => void;
}

const VALID_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE_BYTES = 500 * 1024; // 500 KB

/** Compress an image File to a JPEG data URI targeting <= MAX_SIZE_BYTES. */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2d context unavailable')); return; }

      let width = img.width;
      let height = img.height;
      let quality = 0.9;
      let dataUrl = '';

      // Iteratively reduce quality then dimensions until size target is met
      for (let attempt = 0; attempt < 20; attempt++) {
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Base64 encodes ~4/3 bytes; rough byte estimate
        const estimatedBytes = (dataUrl.length * 3) / 4;
        if (estimatedBytes <= MAX_SIZE_BYTES) break;
        if (quality > 0.4) {
          quality = Math.max(quality - 0.1, 0.4);
        } else {
          width = Math.floor(width * 0.8);
          height = Math.floor(height * 0.8);
          quality = 0.7;
          if (width < 50 || height < 50) break;
        }
      }

      resolve(dataUrl);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
    img.src = objectUrl;
  });
}

export function CharacterPortrait({ portraitUri, characterName, isEditMode, onPortraitChange }: CharacterPortraitProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  function handleThumbnailClick() {
    if (portraitUri) {
      setModalOpen(true);
    }
  }

  function handleUploadClick(e: React.MouseEvent) {
    e.stopPropagation();
    fileInputRef.current?.click();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleThumbnailClick();
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so same file can be re-selected
    if (!file) return;

    if (!VALID_MIME_TYPES.includes(file.type)) {
      showToast('Please select an image file', 'error');
      return;
    }

    try {
      const dataUrl = await compressImage(file);
      onPortraitChange(dataUrl);
    } catch {
      showToast('Failed to process image', 'error');
    }
  }

  const initials = characterName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  return (
    <>
      {/* Thumbnail wrapper */}
      <div className="portrait-thumbnail" style={{ position: 'relative', flexShrink: 0 }}>
        <div
          role="button"
          tabIndex={0}
          onClick={handleThumbnailClick}
          onKeyDown={handleKeyDown}
          aria-label={portraitUri ? `View ${characterName} portrait` : `${characterName} portrait placeholder`}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            cursor: portraitUri ? 'pointer' : 'default',
            backgroundColor: 'var(--color-surface-alt)',
            border: '2px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {portraitUri ? (
            <img
              src={portraitUri}
              alt={`${characterName} portrait`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span
              aria-hidden="true"
              style={{
                fontSize: 'var(--size-xl)',
                fontWeight: 'bold',
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-display)',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {initials || (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </span>
          )}
        </div>

        {/* Upload button — edit mode only */}
        {isEditMode && (
          <button
            onClick={handleUploadClick}
            aria-label="Upload character portrait"
            title="Upload portrait"
            style={{
              position: 'absolute',
              bottom: '-6px',
              right: '-6px',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--color-accent)',
              border: '2px solid var(--color-surface)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              minHeight: 'unset',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        aria-label="Choose character portrait image"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Lightbox modal */}
      {modalOpen && portraitUri && (
        <div
          className="portrait-lightbox"
          onClick={() => setModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${characterName} portrait fullscreen`}
        >
          <button
            onClick={() => setModalOpen(false)}
            aria-label="Close portrait"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
          <img
            src={portraitUri}
            alt={`${characterName} portrait`}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '92vw',
              maxHeight: '92vh',
              objectFit: 'contain',
              borderRadius: 'var(--radius-md)',
              display: 'block',
            }}
          />
        </div>
      )}
    </>
  );
}
