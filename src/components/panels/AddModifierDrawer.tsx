import { useState } from 'react';
import type { TempModifier, TempModifierEffect } from '../../types/character';
import { Drawer } from '../primitives/Drawer';

interface AddModifierDrawerProps {
  open: boolean;
  onClose: () => void;
  onSave: (modifier: Omit<TempModifier, 'id' | 'createdAt'>) => void;
}

type Duration = TempModifier['duration'];

interface EffectRow {
  stat: string;
  delta: number;
}

const DURATION_OPTIONS: { value: Duration; label: string }[] = [
  { value: 'round', label: 'Round' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'shift', label: 'Shift' },
  { value: 'scene', label: 'Scene' },
  { value: 'permanent', label: 'Permanent' },
];

const EMPTY_EFFECT: EffectRow = { stat: '', delta: 0 };

export function AddModifierDrawer({ open, onClose, onSave }: AddModifierDrawerProps) {
  const [label, setLabel] = useState('');
  const [duration, setDuration] = useState<Duration>('stretch');
  const [effects, setEffects] = useState<EffectRow[]>([{ ...EMPTY_EFFECT }]);

  const validEffects = effects.filter(
    (e): e is TempModifierEffect => e.stat !== '' && e.delta !== 0,
  );

  const canSave = label.trim() !== '' && validEffects.length > 0;

  function resetForm() {
    setLabel('');
    setDuration('stretch');
    setEffects([{ ...EMPTY_EFFECT }]);
  }

  function handleSave() {
    if (!canSave) return;
    onSave({ label: label.trim(), effects: validEffects, duration });
    resetForm();
  }

  function updateEffect(index: number, patch: Partial<EffectRow>) {
    setEffects((prev) =>
      prev.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    );
  }

  function removeEffect(index: number) {
    setEffects((prev) => prev.filter((_, i) => i !== index));
  }

  function addEffect() {
    setEffects((prev) => [...prev, { ...EMPTY_EFFECT }]);
  }

  const inputStyle: React.CSSProperties = {
    minHeight: 'var(--touch-target-min)',
    padding: '0 var(--space-sm)',
    fontSize: 'var(--font-size-md)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text)',
    width: '100%',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    flex: 1,
    width: 'auto',
  };

  const numberStyle: React.CSSProperties = {
    ...inputStyle,
    width: '72px',
    flex: '0 0 72px',
    textAlign: 'center',
  };

  return (
    <Drawer open={open} onClose={onClose} title="Add Modifier">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {/* Label */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Power Fist, Stone Skin"
            style={inputStyle}
          />
        </div>

        {/* Duration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Duration
          </label>
          <div style={{ display: 'flex', gap: 0 }}>
            {DURATION_OPTIONS.map(({ value, label: optLabel }, i) => {
              const isActive = duration === value;
              const isFirst = i === 0;
              const isLast = i === DURATION_OPTIONS.length - 1;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDuration(value)}
                  style={{
                    flex: 1,
                    minHeight: 'var(--touch-target-min)',
                    border: '1px solid var(--color-border)',
                    borderLeft: isFirst ? '1px solid var(--color-border)' : 'none',
                    borderRadius: isFirst
                      ? 'var(--radius-sm) 0 0 var(--radius-sm)'
                      : isLast
                        ? '0 var(--radius-sm) var(--radius-sm) 0'
                        : '0',
                    backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: isActive ? 'var(--color-primary-text)' : 'var(--color-text)',
                    fontSize: 'var(--font-size-sm)',
                    cursor: 'pointer',
                    padding: '0 var(--space-xs)',
                  }}
                >
                  {optLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Effects */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Effects
          </label>
          {effects.map((effect, index) => (
            <div
              key={index}
              style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}
            >
              <select
                value={effect.stat}
                onChange={(e) => updateEffect(index, { stat: e.target.value })}
                style={selectStyle}
              >
                <option value="">Select stat...</option>
                <optgroup label="Attributes">
                  <option value="str">STR</option>
                  <option value="con">CON</option>
                  <option value="agl">AGL</option>
                  <option value="int">INT</option>
                  <option value="wil">WIL</option>
                  <option value="cha">CHA</option>
                </optgroup>
                <optgroup label="Armor">
                  <option value="armor">Armor Rating</option>
                  <option value="helmet">Helmet Rating</option>
                </optgroup>
                <optgroup label="Derived">
                  <option value="movement">Movement</option>
                  <option value="hpMax">Max HP</option>
                  <option value="wpMax">Max WP</option>
                </optgroup>
              </select>

              <input
                type="number"
                value={effect.delta}
                onChange={(e) => updateEffect(index, { delta: Number(e.target.value) })}
                style={numberStyle}
              />

              {effects.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEffect(index)}
                  aria-label="Remove effect"
                  style={{
                    minWidth: 'var(--touch-target-min)',
                    minHeight: 'var(--touch-target-min)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-muted)',
                    fontSize: 'var(--font-size-md)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: '0 0 auto',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addEffect}
            style={{
              minHeight: 'var(--touch-target-min)',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'transparent',
              color: 'var(--color-primary)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
            }}
          >
            + Add another effect
          </button>
        </div>

        {/* Save */}
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          style={{
            minHeight: 'var(--touch-target-min)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-primary-text)',
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
            cursor: canSave ? 'pointer' : 'default',
            opacity: canSave ? 1 : 0.5,
          }}
        >
          Save
        </button>
      </div>
    </Drawer>
  );
}
