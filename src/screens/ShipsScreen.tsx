import { useEffect, useState, useCallback } from 'react';
import { NoCampaignPrompt } from '../components/shell/NoCampaignPrompt';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import * as shipRepository from '../storage/repositories/shipRepository';
import * as characterRepository from '../storage/repositories/characterRepository';
import type { Ship } from '../types/ship';
import type { CharacterRecord } from '../types/character';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { Button } from '../components/primitives/Button';
import { useToast } from '../context/ToastContext';

const inputClass =
  'w-full min-h-[44px] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';
const stepBtn =
  'min-h-[44px] min-w-[44px] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-lg cursor-pointer disabled:opacity-50 disabled:pointer-events-none';

/**
 * Manages a campaign's ships. Each ship is campaign-scoped and may belong to a
 * character (or none, for a shared party vessel), so a crew can share one ship
 * or characters can each own their own.
 *
 * @remarks
 * A list of the campaign's ships with a create action; selecting one opens an
 * inline editor. Live-play counters (hull, fuel, cargo) get steppers; every
 * change persists straight through the ship repository. Requires an active
 * campaign — otherwise shows {@link NoCampaignPrompt}.
 */
export default function ShipsScreen() {
  const { activeCampaign } = useCampaignContext();
  const { showToast } = useToast();
  const [ships, setShips] = useState<Ship[]>([]);
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const campaignId = activeCampaign?.id;

  const reload = useCallback(async () => {
    if (!campaignId) return;
    setShips(await shipRepository.listByCampaign(campaignId));
    setCharacters(await characterRepository.getAll());
  }, [campaignId]);

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
    const ship = await shipRepository.create({ campaignId, name });
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
        <h1 className="text-[length:var(--font-size-xl)] text-[var(--color-text)] m-0">Ships</h1>
        <span className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">{activeCampaign.name}</span>
      </div>

      {/* Create */}
      <div className="flex gap-[var(--space-sm)] flex-wrap">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
          placeholder="New ship name…"
          aria-label="New ship name"
          className={inputClass + ' flex-1 min-w-[160px]'}
        />
        <Button variant="primary" onClick={handleCreate} disabled={!newName.trim()}>+ Add Ship</Button>
      </div>

      {/* List */}
      {ships.length === 0 && (
        <p className="text-[var(--color-text-muted)]">No ships yet. Add your vessel above.</p>
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
                {ship.shipClass && <span className="text-[var(--color-text-muted)]"> · {ship.shipClass}</span>}
                <span className="block text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
                  {characterName(ship.ownerCharacterId)} · Fuel {ship.fuelCurrent}/{ship.fuelMax} · Cargo {ship.cargoCurrent}/{ship.cargoMax}t · Hull {ship.hullCurrent}/{ship.hullMax}
                </span>
              </button>
              <Button size="sm" variant="danger" onClick={() => handleDelete(ship)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>

      {/* Editor */}
      {selected && <ShipEditor key={selected.id} ship={selected} characters={characters} patch={patch} />}
    </div>
  );
}

function ShipEditor({
  ship,
  characters,
  patch,
}: {
  ship: Ship;
  characters: CharacterRecord[];
  patch: (changes: Partial<Ship>) => void;
}) {
  const [newWeapon, setNewWeapon] = useState('');

  const num = (v: string) => (v === '' ? 0 : Math.max(0, Math.floor(Number(v) || 0)));

  function counter(label: string, currentKey: keyof Ship, maxKey: keyof Ship, unit = '') {
    const current = ship[currentKey] as number;
    const max = ship[maxKey] as number;
    return (
      <div className="flex items-center justify-between gap-[var(--space-sm)] flex-wrap">
        <span className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] min-w-[70px]">{label}</span>
        <div className="flex items-center gap-[var(--space-xs)]">
          <button type="button" aria-label={`Decrease ${label}`} className={stepBtn} disabled={current <= 0}
            onClick={() => patch({ [currentKey]: Math.max(0, current - 1) } as Partial<Ship>)}>−</button>
          <span className="min-w-[54px] text-center font-bold text-[var(--color-text)]">{current}<span className="text-[var(--color-text-muted)]"> / {max}{unit}</span></span>
          <button type="button" aria-label={`Increase ${label}`} className={stepBtn}
            onClick={() => patch({ [currentKey]: current + 1 } as Partial<Ship>)}>+</button>
          <label className="ml-2 text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">Max</label>
          <input type="number" min={0} value={max} aria-label={`${label} max`} className={inputClass + ' w-20'}
            onChange={e => {
              const m = num(e.target.value);
              patch({ [maxKey]: m, [currentKey]: Math.min(current, m) } as Partial<Ship>);
            }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-md)]">
      <SectionPanel title="Ship Details" collapsible defaultOpen>
        <div className="grid gap-[var(--space-sm)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr))]">
          <Field label="Name"><input className={inputClass} value={ship.name} aria-label="Ship name" onChange={e => patch({ name: e.target.value })} /></Field>
          <Field label="Class / Type"><input className={inputClass} value={ship.shipClass} aria-label="Ship class" placeholder="e.g. Free Trader" onChange={e => patch({ shipClass: e.target.value })} /></Field>
          <Field label="TL"><input type="number" className={inputClass} value={ship.tl ?? ''} aria-label="Ship TL" onChange={e => patch({ tl: e.target.value === '' ? undefined : num(e.target.value) })} /></Field>
          <Field label="Owner">
            <select className={inputClass} value={ship.ownerCharacterId ?? ''} aria-label="Ship owner" onChange={e => patch({ ownerCharacterId: e.target.value || null })}>
              <option value="">Shared (party)</option>
              {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
      </SectionPanel>

      <SectionPanel title="Status" collapsible defaultOpen>
        <div className="flex flex-col gap-[var(--space-sm)]">
          {counter('Hull', 'hullCurrent', 'hullMax')}
          {counter('Fuel', 'fuelCurrent', 'fuelMax')}
          {counter('Cargo', 'cargoCurrent', 'cargoMax', 't')}
          <div className="flex items-center gap-[var(--space-sm)]">
            <span className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] min-w-[70px]">Armour</span>
            <input type="number" min={0} className={inputClass + ' w-24'} value={ship.armor} aria-label="Armour" onChange={e => patch({ armor: num(e.target.value) })} />
          </div>
        </div>
      </SectionPanel>

      <SectionPanel title="Drives" collapsible defaultOpen>
        <div className="grid gap-[var(--space-sm)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,10rem),1fr))]">
          <Field label="Jump"><input type="number" className={inputClass} value={ship.jump ?? ''} aria-label="Jump rating" onChange={e => patch({ jump: e.target.value === '' ? undefined : num(e.target.value) })} /></Field>
          <Field label="Thrust"><input type="number" className={inputClass} value={ship.thrust ?? ''} aria-label="Thrust rating" onChange={e => patch({ thrust: e.target.value === '' ? undefined : num(e.target.value) })} /></Field>
          <Field label="Power Plant"><input className={inputClass} value={ship.power} aria-label="Power plant" onChange={e => patch({ power: e.target.value })} /></Field>
          <Field label="Monthly Upkeep (Cr)"><input type="number" className={inputClass} value={ship.upkeep ?? ''} aria-label="Monthly upkeep" onChange={e => patch({ upkeep: e.target.value === '' ? undefined : num(e.target.value) })} /></Field>
        </div>
      </SectionPanel>

      <SectionPanel title="Crew" collapsible defaultOpen>
        <div className="flex flex-col gap-[var(--space-xs)]">
          {ship.crew.map((slot, i) => (
            <div key={i} className="flex items-center gap-[var(--space-sm)]">
              <span className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] min-w-[90px]">{slot.role}</span>
              <input
                className={inputClass + ' flex-1'}
                value={slot.assignee}
                aria-label={`${slot.role} assignee`}
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
              <Button size="sm" variant="secondary" onClick={() => patch({ weapons: ship.weapons.filter((_, j) => j !== i) })}>Remove</Button>
            </div>
          ))}
          <div className="flex gap-[var(--space-sm)]">
            <input className={inputClass + ' flex-1'} value={newWeapon} aria-label="New weapon"
              placeholder="e.g. Triple Turret (Beam Laser)"
              onChange={e => setNewWeapon(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newWeapon.trim()) { patch({ weapons: [...ship.weapons, newWeapon.trim()] }); setNewWeapon(''); } }} />
            <Button size="sm" variant="secondary" disabled={!newWeapon.trim()}
              onClick={() => { patch({ weapons: [...ship.weapons, newWeapon.trim()] }); setNewWeapon(''); }}>Add</Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel title="Notes" collapsible defaultOpen>
        <textarea className={inputClass + ' min-h-[100px]'} value={ship.notes} aria-label="Ship notes"
          placeholder="Construction details, quirks, cargo manifest…"
          onChange={e => patch({ notes: e.target.value })} />
      </SectionPanel>
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
