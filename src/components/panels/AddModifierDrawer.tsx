import { useState } from 'react';
import { cn } from '../../lib/utils';
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

const inputClasses = "min-h-[var(--touch-target-min)] px-[var(--space-sm)] text-[length:var(--font-size-md)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface)] text-[var(--color-text)] w-full box-border";

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

  return (
    <Drawer open={open} onClose={onClose} title="Add Modifier">
      <div className="flex flex-col gap-[var(--space-md)]">
        {/* Label */}
        <div className="flex flex-col gap-2">
          <label className="text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Power Fist, Stone Skin"
            className={inputClasses}
          />
        </div>

        {/* Duration */}
        <div className="flex flex-col gap-2">
          <label className="text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
            Duration
          </label>
          <div className="flex gap-0">
            {DURATION_OPTIONS.map(({ value, label: optLabel }, i) => {
              const isActive = duration === value;
              const isFirst = i === 0;
              const isLast = i === DURATION_OPTIONS.length - 1;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDuration(value)}
                  className={cn(
                    "flex-1 min-h-[var(--touch-target-min)] border border-[var(--color-border)] text-[length:var(--font-size-sm)] cursor-pointer px-[var(--space-xs)]",
                    !isFirst && "border-l-0",
                    isFirst && "rounded-l-[var(--radius-sm)]",
                    isLast && "rounded-r-[var(--radius-sm)]",
                    !isFirst && !isLast && "rounded-none",
                    isActive
                      ? "bg-[var(--color-primary)] text-[var(--color-primary-text)]"
                      : "bg-[var(--color-surface)] text-[var(--color-text)]"
                  )}
                >
                  {optLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Effects */}
        <div className="flex flex-col gap-2">
          <label className="text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
            Effects
          </label>
          {effects.map((effect, index) => (
            <div
              key={index}
              className="flex gap-2 items-center"
            >
              <select
                value={effect.stat}
                onChange={(e) => updateEffect(index, { stat: e.target.value })}
                className={cn(inputClasses, "flex-1 w-auto")}
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
                className={cn(inputClasses, "w-[72px] flex-[0_0_72px] text-center")}
              />

              {effects.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEffect(index)}
                  aria-label="Remove effect"
                  className="min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface)] text-[var(--color-text-muted)] text-[length:var(--font-size-md)] cursor-pointer flex items-center justify-center flex-[0_0_auto]"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addEffect}
            className="min-h-[var(--touch-target-min)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-sm)] bg-transparent text-[var(--color-primary)] text-[length:var(--font-size-sm)] cursor-pointer"
          >
            + Add another effect
          </button>
        </div>

        {/* Save */}
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className={cn(
            "min-h-[var(--touch-target-min)] border-none rounded-[var(--radius-sm)] bg-[var(--color-primary)] text-[var(--color-primary-text)] text-[length:var(--font-size-md)] font-semibold",
            canSave ? "cursor-pointer opacity-100" : "cursor-default opacity-50"
          )}
        >
          Save
        </button>
      </div>
    </Drawer>
  );
}
