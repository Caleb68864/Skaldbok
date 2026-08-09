import { useEffect, useState, useCallback } from 'react';
import { NoCampaignPrompt } from '../components/shell/NoCampaignPrompt';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import * as routeRepository from '../storage/repositories/routeRepository';
import { readNumericField, totalDistance, reorder } from '../utils/routeMath';
import type { RouteStop } from '../types/routeStop';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { Button } from '../components/primitives/Button';
import { useToast } from '../context/ToastContext';
import { useExportActions } from '../features/export/useExportActions';

const inputClass =
  'w-full min-h-[44px] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';
const moveBtn =
  'min-h-[44px] min-w-[44px] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-lg cursor-pointer disabled:opacity-40 disabled:pointer-events-none';

/**
 * A campaign's route: an ordered, reorderable list of places it has travelled
 * through.
 *
 * @remarks
 * Every field on a stop — including its labels — comes from the active system's
 * `routePlanner` declaration, so this screen contains no ruleset vocabulary.
 * Traveller declares name/UWP/hex/jump/notes and gets a jump route; a system
 * that declares nothing does not get this screen at all, and navigating here
 * directly redirects rather than showing an empty shell.
 *
 * Reordering uses explicit up/down controls rather than drag: the app is used
 * on a tablet with a stylus, where drag is unreliable and there is no existing
 * drag primitive to reuse.
 */
export default function RouteScreen() {
  const { activeCampaign } = useCampaignContext();
  const { system } = useSystemDefinition(activeCampaign?.system ?? 'classic-fantasy');
  const { showToast } = useToast();
  const { exportRoute } = useExportActions();
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [newName, setNewName] = useState('');

  const campaignId = activeCampaign?.id;
  const planner = system?.routePlanner;

  const reload = useCallback(async () => {
    if (!campaignId) return;
    setStops(await routeRepository.listByCampaign(campaignId));
  }, [campaignId]);

  useEffect(() => {
    reload().catch(console.error);
  }, [reload]);

  if (!activeCampaign) return <NoCampaignPrompt />;

  // A system that declares no route fields has no route screen. Rendering an
  // empty shell would imply the feature exists and is merely unconfigured.
  if (system && !planner) {
    return (
      <div className="p-[var(--space-md)]">
        <SectionPanel title="Not available">
          <p className="text-[var(--color-text-muted)]">
            {system.displayName} does not use a route planner.
          </p>
        </SectionPanel>
      </div>
    );
  }
  if (!planner) return null;

  // `name` is a real column; every other declared field lives in `values`.
  const valueFields = planner.fields.filter(f => f.id !== 'name');
  const nameField = planner.fields.find(f => f.id === 'name');
  const total = totalDistance(stops, planner.distanceFieldId);
  const distanceLabel = planner.distanceFieldId
    ? planner.fields.find(f => f.id === planner.distanceFieldId)?.label
    : undefined;

  async function handleAdd() {
    const name = newName.trim();
    if (!name || !campaignId) return;
    await routeRepository.create({ campaignId, name });
    setNewName('');
    await reload();
  }

  async function patch(stop: RouteStop, changes: Partial<Pick<RouteStop, 'name' | 'values'>>) {
    await routeRepository.update(stop.id, changes);
    setStops(prev => prev.map(s => (s.id === stop.id ? { ...s, ...changes } : s)));
  }

  async function move(index: number, delta: number) {
    if (!campaignId) return;
    const next = reorder(stops, index, index + delta);
    setStops(next);
    await routeRepository.reorder(campaignId, next.map(s => s.id));
  }

  async function handleDelete(stop: RouteStop) {
    await routeRepository.softDelete(stop.id);
    await reload();
    showToast(`${stop.name} removed from the route`, 'success');
  }

  return (
    <div className="p-[var(--space-md)] flex flex-col gap-[var(--space-md)]">
      <SectionPanel
        title={planner.label}
        subtitle={
          stops.length > 0 && distanceLabel
            ? `${stops.length} ${stops.length === 1 ? 'stop' : 'stops'} · ${distanceLabel} total ${total}`
            : undefined
        }
      >
        <div className="flex gap-[var(--space-sm)] items-center">
          <input
            className={inputClass}
            value={newName}
            placeholder={nameField?.label ?? 'Name'}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void handleAdd();
            }}
          />
          <Button onClick={() => void handleAdd()} disabled={!newName.trim()}>
            Add
          </Button>
          {stops.length > 0 && (
            <Button variant="secondary" onClick={() => void exportRoute()}>
              Export
            </Button>
          )}
        </div>
      </SectionPanel>

      {stops.length === 0 && (
        <SectionPanel title="No stops yet">
          <p className="text-[var(--color-text-muted)]">
            Add the first place on the route above.
          </p>
        </SectionPanel>
      )}

      {stops.map((stop, index) => (
        <SectionPanel key={stop.id} title={`${index + 1}. ${stop.name || 'Unnamed'}`}>
          <div className="flex flex-col gap-[var(--space-sm)]">
            <div className="flex gap-1 items-center justify-end">
              <button
                className={moveBtn}
                aria-label={`Move ${stop.name} earlier`}
                disabled={index === 0}
                onClick={() => void move(index, -1)}
              >
                ↑
              </button>
              <button
                className={moveBtn}
                aria-label={`Move ${stop.name} later`}
                disabled={index === stops.length - 1}
                onClick={() => void move(index, 1)}
              >
                ↓
              </button>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-[var(--color-text-muted)]">
                {nameField?.label ?? 'Name'}
              </span>
              <input
                className={inputClass}
                value={stop.name}
                onChange={e => void patch(stop, { name: e.target.value })}
              />
            </label>

            {valueFields.map(field => (
              <label key={field.id} className="flex flex-col gap-1">
                <span className="text-sm text-[var(--color-text-muted)]">{field.label}</span>
                {field.type === 'textarea' ? (
                  <textarea
                    className={`${inputClass} min-h-[88px] py-2`}
                    value={stop.values[field.id] ?? ''}
                    onChange={e =>
                      void patch(stop, { values: { ...stop.values, [field.id]: e.target.value } })
                    }
                  />
                ) : (
                  <input
                    className={inputClass}
                    // The declared type drives the input only — every value is
                    // stored as a string and read back through readNumericField.
                    inputMode={field.type === 'number' ? 'decimal' : undefined}
                    value={stop.values[field.id] ?? ''}
                    onChange={e =>
                      void patch(stop, { values: { ...stop.values, [field.id]: e.target.value } })
                    }
                  />
                )}
                {field.id === planner.distanceFieldId &&
                  (stop.values[field.id] ?? '').trim() !== '' && (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      reads as {readNumericField(stop.values, field.id)}
                    </span>
                  )}
              </label>
            ))}

            <div>
              <Button variant="danger" onClick={() => void handleDelete(stop)}>
                Remove stop
              </Button>
            </div>
          </div>
        </SectionPanel>
      ))}
    </div>
  );
}
