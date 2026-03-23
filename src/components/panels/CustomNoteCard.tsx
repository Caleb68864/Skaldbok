import { useState } from 'react';
import type { CustomCard } from '../../types/character';

// ── CustomNoteCard ────────────────────────────────────────────────────────────

interface CustomNoteCardProps {
  card: CustomCard;
  isEditMode: boolean;
  onUpdate: (card: CustomCard) => void;
  onDelete: (id: string) => void;
}

export function CustomNoteCard({ card, isEditMode, onUpdate, onDelete }: CustomNoteCardProps) {
  const [localTitle, setLocalTitle] = useState(card.title);
  const [localBody, setLocalBody] = useState(card.body);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleTitleBlur() {
    if (localTitle !== card.title) {
      onUpdate({ ...card, title: localTitle });
    }
  }

  function handleBodyBlur() {
    if (localBody !== card.body) {
      onUpdate({ ...card, body: localBody });
    }
  }

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete(card.id);
    } else {
      setConfirmDelete(true);
    }
  }

  function handleCancelDelete() {
    setConfirmDelete(false);
  }

  if (!isEditMode) {
    // Play mode: read-only
    return (
      <div className="custom-note-card">
        <h3 className="custom-note-card__title">{card.title}</h3>
        {card.body && (
          <p className="custom-note-card__body">{card.body}</p>
        )}
      </div>
    );
  }

  // Edit mode: inline editing + delete
  return (
    <div className="custom-note-card custom-note-card--edit">
      <div className="custom-note-card__header">
        <input
          className="custom-note-card__title-input"
          type="text"
          value={localTitle}
          onChange={e => setLocalTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="Note title…"
          aria-label="Note card title"
        />
        {confirmDelete ? (
          <div className="custom-note-card__confirm-row">
            <span className="custom-note-card__confirm-label">Delete?</span>
            <button
              className="custom-note-delete custom-note-delete--confirm"
              onClick={handleDeleteClick}
              aria-label="Confirm delete note card"
              type="button"
            >
              Yes
            </button>
            <button
              className="custom-note-delete custom-note-delete--cancel"
              onClick={handleCancelDelete}
              aria-label="Cancel delete"
              type="button"
            >
              No
            </button>
          </div>
        ) : (
          <button
            className="custom-note-delete"
            onClick={handleDeleteClick}
            aria-label="Delete note card"
            type="button"
            title="Delete this note card"
          >
            🗑
          </button>
        )}
      </div>
      <textarea
        className="custom-note-card__body-input"
        value={localBody}
        onChange={e => setLocalBody(e.target.value)}
        onBlur={handleBodyBlur}
        placeholder="Note body…"
        rows={4}
        aria-label="Note card body"
      />
    </div>
  );
}

// ── AddNoteCardButton ─────────────────────────────────────────────────────────

interface AddNoteCardButtonProps {
  onAdd: (card: CustomCard) => void;
}

export function AddNoteCardButton({ onAdd }: AddNoteCardButtonProps) {
  function handleClick() {
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);

    const newCard: CustomCard = {
      id,
      title: 'New Note',
      body: '',
    };
    onAdd(newCard);
  }

  return (
    <button
      className="add-note-button"
      onClick={handleClick}
      type="button"
      aria-label="Add note card"
    >
      + Add Note Card
    </button>
  );
}
