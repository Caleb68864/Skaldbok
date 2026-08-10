import { useEffect, useState, useCallback } from 'react';
import { NoCampaignPrompt } from '../components/shell/NoCampaignPrompt';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import * as shipRepository from '../storage/repositories/shipRepository';
import * as characterRepository from '../storage/repositories/characterRepository';
import type { Ship } from '../types/ship';
import type { CharacterRecord } from '../types/character';
import type { VehicleModel, VehicleSpec } from '../types/system';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { useSystemEngineFor } from '../features/systems/engine';
import { readCounter, readSpec, summariseCounters, vehicleSubtitle } from '../features/vehicles/vehicleView';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { Button } from '../components/primitives/Button';
import { WritePad } from '../components/notes/WritePad';
import { useToast } from '../context/ToastContext';
import { useIsEditMode } from '../utils/modeGuards';

const inputClass =
  'w-full min-h-[44px] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';
/**
 * Panel the live counters live under, and the section name a spec uses to be
 * filed beside them.
 *
 * @remarks
 * Structural rather than vocabulary: it names the *kind* of panel (what is true
 * right now, versus what was built), not any ruleset's concept, so it stays in
 * code while every field inside it comes from the system declaration.
 */
const COUNTER_SECTION = 'Status';

const stepBtn =
  'min-h-[44px] min-w-[44px] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-lg cursor-pointer disabled:opacity-50 disabled:pointer-events-none';

/**
 * Manages a campaign's vehicles. Each is campaign-scoped and may belong to a
 * character (or none, for a shared party vessel), so a crew can share one
 * vessel or characters can each own their own.
 *
 * @remarks
 * A list of the campaign's vehicles with a create action; selecting one opens
 * an inline editor. Which counters and specs exist — and what the whole thing
 * is called — come from the active ruleset's `vehicles` declaration; this
 * screen names none of them and knows nothing about starships. A ruleset that
 * declares no vehicles gets a plain explanation rather than an empty starship.
 * Requires an active campaign — otherwise shows {@link NoCampaignPrompt}.
 */
export default function ShipsScreen() {
  const { activeCampaign } = useCampaignContext();
  const { showToast } = useToast();
  const { system } = useSystemDefinition(activeCampaign?.system ?? 'classic-fantasy');
  const engine = useSystemEngineFor(activeCampaign?.system);
  const model = system?.vehicles ?? null;
  // Fall back to generic words rather than to "Ship": arriving here with no
  // declaration means the ruleset has no vehicles, and naming Traveller's is
  // exactly the leak this screen was rewritten to remove.
  const title = model?.label ?? 'Vehicles';
  const singular = model?.singular ?? 'Vehicle';
  // Ships lock down in play mode: the vessel's build (name, drives, weapons,
  // crew roster, upkeep) is not something a tap during a session should rewrite.
  // Hull/fuel/cargo *current* stay live — they are the ship's HP, and locking
  // them would make the screen useless exactly when it is wanted.
  // Declared above the no-campaign early return: hooks cannot be conditional.
  const isEditMode = useIsEditMode();
  const [ships, setShips] = useState<Ship[]>([]);
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const campaignId = activeCampaign?.id;

  const reload = useCallback(async () => {
    if (!campaignId) return;
    setShips(await shipRepository.listByCampaign(campaignId));
    // Characters are a global library; scope the owner options to this campaign's
    // system so a Traveller ship can't be assigned a Dragonbane owner (and the
    // list isn't cluttered with characters from unrelated campaigns).
    const all = await characterRepository.getAll();
    setCharacters(activeCampaign ? all.filter(c => c.systemId === activeCampaign.system) : all);
  }, [campaignId, activeCampaign]);

  useEffect(() => {
    reload().catch(console.error);
  }, [reload]);

  if (!activeCampaign) return <NoCampaignPrompt />;

  const selected = ships.find(s => s.id === selectedId) ?? null;
  const characterName = (id?: string | null) =>
    id ? characters.find(c => c.id === id)?.name ?? 'Unknown' : 'Shared (party)';

  async function handleCreate() {
    const name = newName.trim();
    if (!name || !campaignId) return;
    const ship = await shipRepository.create({
      campaignId,
      name,
      counterIds: (model?.counters ?? []).map(c => c.id),
      crewRoles: model?.crewRoles,
    });
    setNewName('');
    await reload();
    setSelectedId(ship.id);
  }

  /** Patches the selected ship in the DB and refreshes the local copy. */
  async function patch(changes: Partial<Ship>) {
    if (!selected) return;
    await shipRepository.update(selected.id, changes);
    setShips(prev => prev.map(s => (s.id === selected.id ? { ...s, ...changes } : s)));
  }

  async function handleDelete(ship: Ship) {
    await shipRepository.softDelete(ship.id);
    if (selectedId === ship.id) setSelectedId(null);
    await reload();
    showToast(`${ship.name} removed`, 'success');
  }

  return (
    <div className="p-[var(--space-md)] flex flex-col gap-[var(--space-md)]">
      <div className="flex items-center justify-between flex-wrap gap-[var(--space-sm)]">
        <h1 className="text-[length:var(--font-size-xl)] text-[var(--color-text)] m-0">{title}</h1>
        <span className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">{activeCampaign.name}</span>
      </div>

      {/* A ruleset with no vehicles says so rather than offering a blank one.
          The nav entry is hidden for the same systems, so arriving here at all
          means a bookmark or a system that changed under an open tab. */}
      {!model && (
        <p className="text-[var(--color-text-muted)]">
          {system?.displayName ?? 'This ruleset'} does not track vehicles.
        </p>
      )}

      {/* Create — build-time only. A vessel is not commissioned mid-session. */}
      {isEditMode && model && (
        <div className="flex gap-[var(--space-sm)] flex-wrap">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
            placeholder={`New ${singular.toLowerCase()} name…`}
            aria-label={`New ${singular.toLowerCase()} name`}
            className={inputClass + ' flex-1 min-w-[160px]'}
          />
          <Button variant="primary" onClick={handleCreate} disabled={!newName.trim()}>+ Add {singular}</Button>
        </div>
      )}

      {/* List */}
      {model && ships.length === 0 && (
        <p className="text-[var(--color-text-muted)]">
          No {title.toLowerCase()} yet. Add your first above.
        </p>
      )}
      <div className="flex flex-col gap-[var(--space-sm)]">
        {ships.map(ship => (
          <div
            key={ship.id}
            className={
              'rounded-[var(--radius-sm)] border p-[var(--space-sm)] ' +
              (ship.id === selectedId ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]')
            }
          >
            <div className="flex items-center justify-between gap-[var(--space-sm)] flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedId(ship.id === selectedId ? null : ship.id)}
                className="flex-1 text-left bg-transparent border-none cursor-pointer text-[var(--color-text)] min-h-[44px]"
              >
                <span className="font-semibold text-[length:var(--font-size-md)]">{ship.name}</span>
                {vehicleSubtitle(ship, model) && (
                  <span className="text-[var(--color-text-muted)]"> · {vehicleSubtitle(ship, model)}</span>
                )}
                <span className="block text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
                  {[characterName(ship.ownerCharacterId), summariseCounters(ship, model)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
              {isEditMode && <Button size="sm" variant="danger" onClick={() => handleDelete(ship)}>Delete</Button>}
            </div>
          </div>
        ))}
      </div>

      {/* Editor */}
      {selected && model && (
        <ShipEditor
          key={selected.id}
          ship={selected}
          model={model}
          currencyAbbr={
            engine.currency.denominations.find(d => d.id === engine.currency.baseDenominationId)?.abbr ?? ''
          }
          characters={characters}
          patch={patch}
          editable={isEditMode}
        />
      )}
    </div>
  );
}

function ShipEditor({
  ship,
  model,
  currencyAbbr,
  characters,
  patch,
  editable,
}: {
  ship: Ship;
  /** The active ruleset's vehicle declaration — the source of every field here. */
  model: VehicleModel;
  /** Base currency abbreviation, for specs declaring `unit: 'currency'`. */
  currencyAbbr: string;
  characters: CharacterRecord[];
  patch: (changes: Partial<Ship>) => void;
  /** False in play mode: the build is read-only, only the status counters move. */
  editable: boolean;
}) {
  const [newWeapon, setNewWeapon] = useState('');
  const [notesPadOpen, setNotesPadOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(ship.notes);

  const num = (v: string) => (v === '' ? 0 : Math.max(0, Math.floor(Number(v) || 0)));

  /** Writes one counter without disturbing the others in the bag. */
  const patchCounter = (id: string, next: { current?: number; max?: number }) => {
    const existing = readCounter(ship, id);
    patch({ counters: { ...ship.counters, [id]: { ...existing, ...next } } });
  };

  function counter({ id, label, unit }: NonNullable<VehicleModel['counters']>[number]) {
    const { current, max } = readCounter(ship, id);
    return (
      <div key={id} className="flex items-center justify-between gap-[var(--space-sm)] flex-wrap">
        <span className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] min-w-[70px]">{label}</span>
        <div className="flex items-center gap-[var(--space-xs)]">
          <button type="button" aria-label={`Decrease ${label}`} className={stepBtn} disabled={current <= 0}
            onClick={() => patchCounter(id, { current: Math.max(0, current - 1) })}>−</button>
          <span className="min-w-[54px] text-center font-bold text-[var(--color-text)]">{current}<span className="text-[var(--color-text-muted)]"> / {max}{unit ?? ''}</span></span>
          <button type="button" aria-label={`Increase ${label}`} className={stepBtn}
            onClick={() => patchCounter(id, { current: current + 1 })}>+</button>
          <label className="ml-2 text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">Max</label>
          <input type="number" min={0} value={max} aria-label={`${label} max`} disabled={!editable} className={inputClass + ' w-20'}
            onChange={e => {
              const m = num(e.target.value);
              // Clamp current to the new maximum: a hull rebuilt smaller cannot
              // still be carrying more damage than it now has hull for.
              patchCounter(id, { max: m, current: Math.min(current, m) });
            }} />
        </div>
      </div>
    );
  }

  function spec(field: VehicleSpec) {
    const label =
      field.unit === 'currency' && currencyAbbr ? `${field.label} (${currencyAbbr})` : field.label;
    const value = readSpec(ship, field.id);
    return (
      <Field key={field.id} label={label}>
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          className={inputClass}
          value={value}
          aria-label={label}
          disabled={!editable}
          placeholder={field.placeholder}
          onChange={e => {
            const raw = e.target.value;
            // A cleared number field drops the key rather than storing 0 — "not
            // recorded" and "zero" are different answers about a ship's jump.
            const next = { ...ship.specs };
            if (raw === '') delete next[field.id];
            else next[field.id] = field.type === 'number' ? num(raw) : raw;
            patch({ specs: next });
          }}
        />
      </Field>
    );
  }

  const counters = model.counters ?? [];
  const specs = model.specs ?? [];
  const detailSpecs = specs.filter(s => !s.section);
  const specsInCounterSection = counters.length > 0 ? specs.filter(s => s.section === COUNTER_SECTION) : [];
  // Sections in first-declaration order, so the ruleset controls the panel
  // sequence without this screen knowing what "Drives" is.
  const specSections = [
    ...specs
      .filter(s => s.section && !specsInCounterSection.includes(s))
      .reduce((acc, s) => {
        acc.set(s.section!, [...(acc.get(s.section!) ?? []), s]);
        return acc;
      }, new Map<string, VehicleSpec[]>())
      .entries(),
  ];

  return (
    <div className="flex flex-col gap-[var(--space-md)]">
      <SectionPanel title={`${model.singular} Details`} collapsible defaultOpen>
        <div className="grid gap-[var(--space-sm)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr))]">
          <Field label="Name"><input className={inputClass} value={ship.name} aria-label={`${model.singular} name`} disabled={!editable} onChange={e => patch({ name: e.target.value })} /></Field>
          {detailSpecs.map(spec)}
          <Field label="Owner">
            <select className={inputClass} value={ship.ownerCharacterId ?? ''} aria-label={`${model.singular} owner`} disabled={!editable} onChange={e => patch({ ownerCharacterId: e.target.value || null })}>
              <option value="">Shared (party)</option>
              {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
      </SectionPanel>

      {counters.length > 0 && (
        <SectionPanel title={COUNTER_SECTION} collapsible defaultOpen>
          <div className="flex flex-col gap-[var(--space-sm)]">
            {counters.map(counter)}
            {/* Specs filed under the counters' own section sit with them rather
                than in a second panel of the same name — Traveller's armour
                rating belongs beside hull, not in a duplicate "Status" box. */}
            {specsInCounterSection.map(spec)}
          </div>
        </SectionPanel>
      )}

      {specSections.map(([section, fields]) => (
        <SectionPanel key={section} title={section} collapsible defaultOpen>
          <div className="grid gap-[var(--space-sm)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,10rem),1fr))]">
            {fields.map(spec)}
          </div>
        </SectionPanel>
      ))}

      <SectionPanel title="Crew" collapsible defaultOpen>
        <div className="flex flex-col gap-[var(--space-xs)]">
          {ship.crew.map((slot, i) => (
            <div key={i} className="flex items-center gap-[var(--space-sm)]">
              <span className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] min-w-[90px]">{slot.role}</span>
              <input
                className={inputClass + ' flex-1'}
                value={slot.assignee}
                aria-label={`${slot.role} assignee`}
                disabled={!editable}
                placeholder="—"
                onChange={e => {
                  const crew = ship.crew.map((s, j) => (j === i ? { ...s, assignee: e.target.value } : s));
                  patch({ crew });
                }}
              />
            </div>
          ))}
        </div>
      </SectionPanel>

      <SectionPanel title="Weapons" collapsible defaultOpen>
        <div className="flex flex-col gap-[var(--space-xs)]">
          {ship.weapons.length === 0 && <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">No weapons.</p>}
          {ship.weapons.map((w, i) => (
            <div key={i} className="flex items-center justify-between gap-[var(--space-sm)]">
              <span className="text-[var(--color-text)]">{w}</span>
              {editable && <Button size="sm" variant="secondary" onClick={() => patch({ weapons: ship.weapons.filter((_, j) => j !== i) })}>Remove</Button>}
            </div>
          ))}
          {editable && (
            <div className="flex gap-[var(--space-sm)]">
              <input className={inputClass + ' flex-1'} value={newWeapon} aria-label="New weapon"
                placeholder="e.g. Triple Turret (Beam Laser)"
                onChange={e => setNewWeapon(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newWeapon.trim()) { patch({ weapons: [...ship.weapons, newWeapon.trim()] }); setNewWeapon(''); } }} />
              <Button size="sm" variant="secondary" disabled={!newWeapon.trim()}
                onClick={() => { patch({ weapons: [...ship.weapons, newWeapon.trim()] }); setNewWeapon(''); }}>Add</Button>
            </div>
          )}
        </div>
      </SectionPanel>

      <SectionPanel title="Notes" collapsible defaultOpen>
        <div className="flex flex-col gap-[var(--space-xs)]">
          {editable && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => { setNotesDraft(ship.notes); setNotesPadOpen(true); }}
              >
                Expand
              </Button>
            </div>
          )}
          <textarea className={inputClass + ' min-h-[100px]'} value={ship.notes} aria-label="Ship notes" disabled={!editable}
            placeholder="Construction details, quirks, cargo manifest…"
            onChange={e => patch({ notes: e.target.value })} />
        </div>
      </SectionPanel>

      {editable && (
        <WritePad
          open={notesPadOpen}
          value={notesDraft}
          onChange={setNotesDraft}
          onCommit={value => {
            patch({ notes: value });
            setNotesPadOpen(false);
          }}
          onClose={() => {
            // Closing must not silently bin what was typed. The draft is
            // local, so a bare close would discard it with no warning —
            // unacceptable when the whole point of the pad is long-form
            // handwriting. Persist on close; the field stays editable.
            if (notesDraft !== ship.notes) patch({ notes: notesDraft });
            setNotesPadOpen(false);
          }}
          placeholder="Construction details, quirks, cargo manifest…"
          commitLabel="Done"
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">{label}</label>
      {children}
    </div>
  );
}
