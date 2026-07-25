import { SectionPanel } from '../../components/primitives/SectionPanel';
import { nowISO } from '../../utils/dates';
import { clamp, type PlayModuleProps } from './types';
import { getEngine } from '../systems/engine';

/**
 * A spendable token pool — Savage Worlds Bennies. Distinct from a health track:
 * you spend it down during play and it refreshes each session.
 *
 * @remarks
 * Renders only when the system declares a session-refreshing resource, so it is a
 * no-op for Dragonbane/Traveller. Big −/+ touch targets for spending and earning
 * tokens mid-scene, plus a Refresh that restores the pool to full (the start-of-
 * session reset, done by hand until an automatic session hook exists).
 */
export function BenniesModule({ character, system, updateCharacter }: PlayModuleProps) {
  const engine = getEngine(system);
  const bennyId = engine.resourceIds.find(
    id => system?.resources.find(r => r.id === id)?.refresh === 'session',
  );
  if (!bennyId) return null;
  // Alias the narrowed id into a const so its non-undefined type survives into the
  // adjust closure, where TS would otherwise re-widen it (dropping the `!` asserts).
  const id = bennyId;
  const res = character.resources[id];
  if (!res) return null;
  const def = system?.resources.find(r => r.id === id);

  function adjust(delta: number, toMax = false) {
    updateCharacter(prev => {
      const cur = prev.resources[id]?.current ?? 0;
      const max = prev.resources[id]?.max ?? 0;
      const next = toMax ? max : clamp(cur + delta, 0, max);
      return {
        resources: { ...prev.resources, [id]: { ...prev.resources[id], current: next } },
        updatedAt: nowISO(),
      };
    });
  }

  const btn =
    'min-h-[44px] min-w-[44px] px-3 border border-[var(--color-border)] rounded-[var(--radius-sm)] ' +
    'bg-[var(--color-surface-alt)] text-[var(--color-text)] text-lg font-bold cursor-pointer ' +
    'hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none';

  return (
    <SectionPanel title={def?.name ?? 'Bennies'} collapsible defaultOpen>
      <div className="flex items-center justify-between gap-[var(--space-sm)]">
        <button type="button" aria-label={`Spend a ${def?.name ?? 'Benny'}`} className={btn} disabled={res.current <= 0} onClick={() => adjust(-1)}>
          −
        </button>
        <div className="text-center">
          <span className="text-[length:var(--size-2xl)] font-bold text-[var(--color-accent)] font-[family-name:var(--font-display)]">
            {res.current}
          </span>
          <span className="text-[var(--color-text-muted)]"> / {res.max}</span>
        </div>
        <div className="flex items-center gap-[var(--space-xs)]">
          <button type="button" aria-label={`Earn a ${def?.name ?? 'Benny'}`} className={btn} disabled={res.current >= res.max} onClick={() => adjust(1)}>
            +
          </button>
          <button type="button" aria-label="Refresh to full" className={btn + ' text-sm'} onClick={() => adjust(0, true)}>
            Refresh
          </button>
        </div>
      </div>
    </SectionPanel>
  );
}
