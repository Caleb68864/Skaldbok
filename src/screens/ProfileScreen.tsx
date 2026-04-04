import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useIsEditMode } from '../utils/modeGuards';
import { useAutosave } from '../hooks/useAutosave';
import { useToast } from '../context/ToastContext';
import * as characterRepository from '../storage/repositories/characterRepository';
import { nowISO } from '../utils/dates';

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

      for (let attempt = 0; attempt < 20; attempt++) {
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        dataUrl = canvas.toDataURL('image/jpeg', quality);
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

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const isEditMode = useIsEditMode();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  useAutosave(character, characterRepository.save, 1000);

  if (isLoading) {
    return <div className="p-[var(--space-md)] text-[var(--color-text)]">Loading...</div>;
  }
  if (!character) {
    navigate('/library');
    return null;
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!VALID_MIME_TYPES.includes(file.type)) {
      showToast('Please select an image file (JPEG, PNG, GIF, or WebP)', 'error');
      return;
    }

    try {
      const dataUrl = await compressImage(file);
      updateCharacter({ portraitUri: dataUrl, updatedAt: nowISO() });
    } catch {
      showToast('Failed to process image', 'error');
    }
  }

  function handleAppearanceChange(value: string) {
    if (!character) return;
    updateCharacter({ metadata: { ...character.metadata, appearance: value }, updatedAt: nowISO() });
  }

  function handleNotesChange(value: string) {
    if (!character) return;
    updateCharacter({ metadata: { ...character.metadata, notes: value }, updatedAt: nowISO() });
  }

  const silhouette = (
    <svg
      className="profile-hero__silhouette"
      viewBox="0 0 80 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="40" cy="28" r="20" fill="currentColor" opacity="0.35" />
      <path
        d="M8 112 C8 80 20 68 40 68 C60 68 72 80 72 112"
        fill="currentColor"
        opacity="0.35"
      />
    </svg>
  );

  return (
    <div className="profile-screen">
      {/* Hero portrait area — ~40vh */}
      <div className="profile-hero">
        {character.portraitUri ? (
          <>
            <img
              src={character.portraitUri}
              alt={`${character.name} portrait`}
              className="profile-hero__img"
            />
            {isEditMode && (
              <button
                className="profile-hero__upload-btn"
                onClick={handleUploadClick}
                aria-label="Change portrait image"
                title="Change portrait"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Change Portrait
              </button>
            )}
          </>
        ) : (
          <div className="profile-hero__placeholder">
            {silhouette}
            <span className="profile-hero__no-portrait-text">No portrait set</span>
            {isEditMode && (
              <button
                className="profile-hero__add-btn"
                onClick={handleUploadClick}
                aria-label="Add portrait image"
                title="Add portrait"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Add Portrait
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        aria-label="Choose portrait image file"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Appearance text area */}
      <div className="profile-section">
        <label className="profile-label" htmlFor="profile-appearance">
          Appearance
        </label>
        <textarea
          id="profile-appearance"
          className="profile-textarea"
          value={character.metadata.appearance ?? ''}
          onChange={e => handleAppearanceChange(e.target.value)}
          readOnly={!isEditMode}
          placeholder={isEditMode ? 'Describe your character\'s appearance...' : ''}
          rows={5}
          aria-label="Character appearance"
        />
      </div>

      {/* Notes text area */}
      <div className="profile-section">
        <label className="profile-label" htmlFor="profile-notes">
          Notes
        </label>
        <textarea
          id="profile-notes"
          className="profile-textarea"
          value={character.metadata.notes ?? ''}
          onChange={e => handleNotesChange(e.target.value)}
          readOnly={!isEditMode}
          placeholder={isEditMode ? 'Add character notes, background, or anything else...' : ''}
          rows={8}
          aria-label="Character notes"
        />
      </div>
    </div>
  );
}
