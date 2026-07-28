import { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import type { TempModifier, TempModifierEffect } from '../../types/character';
import { useSystemEngine } from '../../features/systems/engine';
import type { ModifiableStat } from '../../features/systems/engine/types';
import { useSystemDefinition } from '../../features/systems/useSystemDefinition';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { DEFAULT_SYSTEM_ID } from '../../systems/registry';
import { Drawer } from '../primitives/Drawer';

/** Props for {@link AddModifierDrawer}. `onSave` receives the assembled modifier minus its id/timestamp, which the caller mints. */
export interface AddModifierDrawerProps {
  open: boolean;
  onClose: () => void;
  onSave: (modifier: Omit<TempModifier, 'id' | 'createdAt'>) => void;
}

type Duration = TempModifier['duration'];

/** One stat-adjustment row in the form: a namespaced stat key and its signed delta. */
interface EffectRow {
  stat: string;
  delta: number;
}

const EMPTY_EFFECT: EffectRow = { stat: '', delta: 0 };

const inputClasses = "min-h-[var(--touch-target-min)] px-[var(--space-sm)] text-[length:var(--font-size-md)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface)] text-[var(--color-text)] w-full box-border";

/**
 * Drawer form for creating a temporary modifier (buff/debuff) on the active character.
 *
 * @remarks
 * Both the duration choices ({@link features/systems/engine/types!SystemEngine.timeUnits | SystemEngine.timeUnits}) and the pickable stat
 * targets ({@link features/systems/engine/types!SystemEngine.modifiableStats | SystemEngine.modifiableStats}) come from the engine, so the form
 * offers exactly the stats and time units the active ruleset supports. Target ids are
 * namespaced (`attr:str` vs `res:str`) so a system may name a resource after an
 * attribute without the two colliding, and stored modifiers stay valid across a
 * system change.
 */
export function AddModifierDrawer({ open, onClose, onSave }: AddModifierDrawerProps) {
  const engine = useSystemEngine();
  const { character } = useActiveCharacter();
  // Duration choices are the active system's time units; the stored ids are
  // shared across systems so a saved modifier stays valid if the system changes.
  const durationOptions = engine.timeUnits;
  const { system } = useSystemDefinition(character?.systemId ?? DEFAULT_SYSTEM_ID);
  /**
   * Targets come from the engine, grouped for the picker. Ids are namespaced
   * (`attr:str` vs `res:str`), which is what lets a system name a resource
   * after an attribute without the two colliding.
   */
  const statGroups = useMemo(() => {
    const grouped = new Map<string, ModifiableStat[]>();
    for (const stat of engine.modifiableStats(system ?? undefined)) {
      const list = grouped.get(stat.group) ?? [];
      list.push(stat);
      grouped.set(stat.group, list);
    }
    return [...grouped.entries()];
  }, [engine, system]);
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
            {durationOptions.map((unit, i) => {
              const value = unit.id as Duration;
              const isActive = duration === value;
              const isFirst = i === 0;
              const isLast = i === durationOptions.length - 1;
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
                  {unit.label}
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
                {statGroups.map(([group, stats]) => (
                  <optgroup key={group} label={group}>
                    {stats.map(stat => (
                      <option key={stat.id} value={stat.id}>{stat.label}</option>
                    ))}
                  </optgroup>
                ))}
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
