import { useState, useRef } from 'react';

interface CharacterPortraitProps {
  portraitUri?: string;
  characterName: string;
  isEditMode: boolean;
  onPortraitChange: (dataUrl: string) => void;
}

export function CharacterPortrait({ portraitUri, characterName, isEditMode, onPortraitChange }: CharacterPortraitProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleClick() {
    if (isEditMode) {
      fileInputRef.current?.click();
    } else if (portraitUri) {
      setModalOpen(true);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onPortraitChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }

  const initials = characterName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={isEditMode ? 'Upload character portrait' : 'View character portrait'}
        style={{
          width: '60px',
          height: '90px',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          cursor: 'pointer',
          flexShrink: 0,
          position: 'relative',
          backgroundColor: 'var(--color-surface-alt)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {portraitUri ? (
          <img
            src={portraitUri}
            alt={`${characterName} portrait`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: 'var(--radius-md)',
            }}
          />
        ) : (
          <span
            aria-hidden="true"
            style={{
              fontSize: 'var(--size-xl)',
              fontWeight: 'var(--weight-bold)' as unknown as number,
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-display)',
              userSelect: 'none',
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
        {isEditMode && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              color: '#fff',
              fontSize: 'var(--size-xs)',
              textAlign: 'center',
              padding: '2px 0',
              lineHeight: 1,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        aria-label="Choose character portrait image"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {modalOpen && portraitUri && (
        <>
          <div
            onClick={() => setModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.8)',
              zIndex: 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <img
              src={portraitUri}
              alt={`${characterName} portrait`}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '92vw',
                maxHeight: '92vh',
                objectFit: 'contain',
                borderRadius: 'var(--radius-md)',
              }}
            />
          </div>
        </>
      )}
    </>
  );
}
