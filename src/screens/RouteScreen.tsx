import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { NoCampaignPrompt } from '../components/shell/NoCampaignPrompt';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { useRoute } from '../features/route/useRoute';
import { readNumericField } from '../utils/routeMath';
import { formatRouteDate, isRouteDateValid, describeDuration } from '../utils/route/calendar';
import type { RouteStop } from '../types/routeStop';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { Button } from '../components/primitives/Button';
import { useToast } from '../context/ToastContext';
import { useExportActions } from '../features/export/useExportActions';
import { RouteImportModal } from '../features/route/RouteImportModal';

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
 * `routePlanner` declaration, so this screen contains no ruleset vocabulary at
 * all, not even in a comment: a system declares its own world fields and their
 * names, and this file renders whatever it is given. A system that declares
 * nothing does not get this screen, and navigating here directly redirects
 * rather than showing an empty shell or an error page.
 *
 * Reordering uses explicit up/down controls rather than drag: the app is used
 * on a tablet with a stylus, where drag is unreliable and there is no existing
 * drag primitive to reuse.
 */
export default function RouteScreen() {
  const { activeCampaign } = useCampaignContext();
  const route = useRoute();
  const { showToast } = useToast();
  const { exportRoute } = useExportActions();
  const [newName, setNewName] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  if (!activeCampaign) return <NoCampaignPrompt />;

  const { stops, planner, valueFields, nameField, distanceLabel, total, schedule, plan, calendar } = route;
  const dateHint = calendar?.example ?? 'day number';
  const fmtDate = (d: number | null) => (d === null ? '—' : formatRouteDate(d, calendar));

  // A ruleset that declares no route fields has no route screen — so this is a
  // redirect, not an error page. Telling someone "not available" implies the
  // feature exists and is merely unconfigured; for their ruleset it does not
  // exist at all. Matches the catch-all convention in `routes/index.tsx`.
  //
  // Gated on the *system* having resolved, not on the stops query: those race,
  // and stops win, so gating on the wrong one redirects a Traveller crew away
  // from their own route before the declaration has loaded.
  if (route.systemResolved && !planner) return <Navigate to="/session" replace />;

  // Still resolving the system definition — render nothing rather than flashing
  // a redirect at someone whose ruleset does declare a planner.
  if (!planner) return null;

  async function handleAdd() {
    await route.addStop(newName);
    setNewName('');
  }

  async function handleDelete(stop: RouteStop) {
    await route.removeStop(stop.id);
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
        <div className="flex gap-[var(--space-sm)] items-center flex-wrap">
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
          <Button variant="secondary" onClick={() => setIsImporting(true)}>
            Import…
          </Button>
          {stops.length > 0 && (
            <Button variant="secondary" onClick={() => void exportRoute()}>
              Export
            </Button>
          )}
        </div>
      </SectionPanel>

      <SectionPanel
        title="Schedule"
        subtitle={
          schedule.totalEstimatedDays > 0
            ? `${describeDuration(schedule.totalEstimatedDays)} of travel estimated`
            : 'Add an estimate to each leg to project the journey'
        }
        collapsible
        defaultOpen={stops.length > 0}
      >
        <div className="flex flex-col gap-[var(--space-sm)]">
          <div className="flex gap-[var(--space-sm)] flex-wrap">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-[var(--color-text-muted)]">Departs</span>
              <input
                className={`${inputClass} max-w-[10rem]`}
                value={plan?.startDate ?? ''}
                placeholder={dateHint}
                aria-label="Journey start date"
                onChange={e => void route.updatePlan({ startDate: e.target.value })}
                style={
                  isRouteDateValid(plan?.startDate, calendar)
                    ? undefined
                    : { borderColor: 'var(--color-danger, #b3261e)' }
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-[var(--color-text-muted)]">Must arrive by</span>
              <input
                className={`${inputClass} max-w-[10rem]`}
                value={plan?.targetDate ?? ''}
                placeholder={dateHint}
                aria-label="Target date"
                onChange={e => void route.updatePlan({ targetDate: e.target.value })}
                style={
                  isRouteDateValid(plan?.targetDate, calendar)
                    ? undefined
                    : { borderColor: 'var(--color-danger, #b3261e)' }
                }
              />
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[10rem]">
              <span className="text-sm text-[var(--color-text-muted)]">What for</span>
              <input
                className={inputClass}
                value={plan?.targetNote ?? ''}
                placeholder="Deliver the trake fruit"
                aria-label="What the deadline is for"
                onChange={e => void route.updatePlan({ targetNote: e.target.value })}
              />
            </label>
          </div>

          {schedule.projectedEnd !== null && (
            <p className="text-[var(--color-text)]">
              Arrives <strong>{fmtDate(schedule.projectedEnd)}</strong>
              {schedule.lastActual && (
                <span className="text-[var(--color-text-muted)]">
                  {' '}— projected from the last recorded arrival
                </span>
              )}
            </p>
          )}

          {schedule.slack !== null && (
            <p
              className="font-semibold"
              style={{
                color:
                  schedule.slack < 0
                    ? 'var(--color-danger, #b3261e)'
                    : 'var(--color-success, #2e7d32)',
              }}
            >
              {schedule.slack < 0
                ? `${describeDuration(schedule.slack)} late`
                : schedule.slack === 0
                  ? 'Arrives exactly on the deadline'
                  : `${describeDuration(schedule.slack)} to spare`}
              {plan?.targetNote ? ` — ${plan.targetNote}` : ''}
            </p>
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

      {isImporting && (
        <RouteImportModal
          fields={planner.fields}
          existingCount={stops.length}
          onCancel={() => setIsImporting(false)}
          onImport={async (parsed, replace) => {
            const count = await route.importStops(parsed, replace);
            setIsImporting(false);
            showToast(`Imported ${count} stop${count === 1 ? '' : 's'}`, 'success');
          }}
        />
      )}

      {stops.map((stop, index) => (
        <SectionPanel key={stop.id} title={`${index + 1}. ${stop.name || 'Unnamed'}`}>
          <div className="flex flex-col gap-[var(--space-sm)]">
            <div className="flex gap-1 items-center justify-end">
              <button
                className={moveBtn}
                aria-label={`Move ${stop.name} earlier`}
                disabled={index === 0}
                onClick={() => void route.moveStop(index, -1)}
              >
                ↑
              </button>
              <button
                className={moveBtn}
                aria-label={`Move ${stop.name} later`}
                disabled={index === stops.length - 1}
                onClick={() => void route.moveStop(index, 1)}
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
                onChange={e => void route.updateStop(stop, { name: e.target.value })}
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
                      void route.updateStop(stop, {
                        values: { ...stop.values, [field.id]: e.target.value },
                      })
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
                      void route.updateStop(stop, {
                        values: { ...stop.values, [field.id]: e.target.value },
                      })
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

            {(() => {
              const row = schedule.stops[index];
              if (!row) return null;
              return (
                <div className="flex flex-col gap-[var(--space-sm)] border-t border-[var(--color-border)] pt-[var(--space-sm)]">
                  <div className="flex gap-[var(--space-sm)] flex-wrap">
                    {index > 0 && (
                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-[var(--color-text-muted)]">
                          Days to get here
                        </span>
                        <input
                          className={`${inputClass} max-w-[8rem]`}
                          inputMode="numeric"
                          value={stop.estimatedDays ?? ''}
                          aria-label={`Estimated days to ${stop.name}`}
                          onChange={e => {
                            const n = Number(e.target.value);
                            void route.setStopSchedule(stop, {
                              estimatedDays:
                                e.target.value.trim() === '' || !Number.isFinite(n) || n < 0
                                  ? undefined
                                  : n,
                            });
                          }}
                        />
                      </label>
                    )}
                    <label className="flex flex-col gap-1">
                      <span className="text-sm text-[var(--color-text-muted)]">Arrived</span>
                      <input
                        className={`${inputClass} max-w-[9rem]`}
                        value={stop.arrivedOn ?? ''}
                        placeholder={dateHint}
                        aria-label={`Arrived at ${stop.name}`}
                        onChange={e => void route.setStopSchedule(stop, { arrivedOn: e.target.value })}
                        style={
                          isRouteDateValid(stop.arrivedOn, calendar)
                            ? undefined
                            : { borderColor: 'var(--color-danger, #b3261e)' }
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-sm text-[var(--color-text-muted)]">Departed</span>
                      <input
                        className={`${inputClass} max-w-[9rem]`}
                        value={stop.departedOn ?? ''}
                        placeholder={dateHint}
                        aria-label={`Departed ${stop.name}`}
                        onChange={e => void route.setStopSchedule(stop, { departedOn: e.target.value })}
                        style={
                          isRouteDateValid(stop.departedOn, calendar)
                            ? undefined
                            : { borderColor: 'var(--color-danger, #b3261e)' }
                        }
                      />
                    </label>
                  </div>

                  <p className="text-sm text-[var(--color-text-muted)]">
                    {row.actualArrival !== null ? 'Arrived' : 'Due'}{' '}
                    <strong className="text-[var(--color-text)]">
                      {fmtDate(row.projectedArrival)}
                    </strong>
                    {row.variance !== null && row.variance !== 0 && (
                      <span
                        style={{
                          color:
                            row.variance > 0
                              ? 'var(--color-danger, #b3261e)'
                              : 'var(--color-success, #2e7d32)',
                        }}
                      >
                        {' '}· {describeDuration(row.variance)} {row.variance > 0 ? 'late' : 'early'}
                      </span>
                    )}
                    {row.daysInPort !== null && row.daysInPort > 0 && (
                      <span> · {describeDuration(row.daysInPort)} in port</span>
                    )}
                  </p>
                </div>
              );
            })()}

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
