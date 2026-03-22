import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useAppState } from '../context/AppStateContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { useAutosave } from '../hooks/useAutosave';
import { useFieldEditable } from '../utils/modeGuards';
import { AttributeField } from '../components/fields/AttributeField';
import { ConditionToggleGroup } from '../components/fields/ConditionToggleGroup';
import { ResourceTracker } from '../components/fields/ResourceTracker';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { DerivedFieldDisplay } from '../components/fields/DerivedFieldDisplay';
import { getDerivedValue } from '../utils/derivedValues';
import * as characterRepository from '../storage/repositories/characterRepository';
import { nowISO } from '../utils/dates';

export default function SheetScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const { settings } = useAppState();
  const { system } = useSystemDefinition(character?.systemId ?? 'dragonbane');
  const { error: saveError } = useAutosave(character, characterRepository.save, 1000);

  const identityEditable = useFieldEditable('identity');
  const attributesEditable = useFieldEditable('attributes.str');
  const resourceMaxEditable = useFieldEditable('resources.hp.max');
  const derivedEditable = useFieldEditable('derivedOverrides');

  if (isLoading) return <div style={{ padding: 'var(--space-md)', color: 'var(--color-text)' }}>Loading...</div>;
  if (!character) {
    navigate('/library');
    return null;
  }

  const isPlayMode = settings.mode === 'play';

  function updateAttr(id: string, value: number) {
    if (!character) return;
    updateCharacter({ attributes: { ...character.attributes, [id]: value }, updatedAt: nowISO() });
  }

  function updateCondition(id: string, value: boolean) {
    if (!character) return;
    updateCharacter({ conditions: { ...character.conditions, [id]: value }, updatedAt: nowISO() });
  }

  function updateResourceCurrent(id: string, value: number) {
    if (!character) return;
    updateCharacter({ resources: { ...character.resources, [id]: { ...character.resources[id], current: value } }, updatedAt: nowISO() });
  }

  function updateResourceMax(id: string, value: number) {
    if (!character) return;
    updateCharacter({ resources: { ...character.resources, [id]: { ...character.resources[id], max: value } }, updatedAt: nowISO() });
  }

  function updateMeta(field: string, value: string) {
    if (!character) return;
    updateCharacter({ metadata: { ...character.metadata, [field]: value }, updatedAt: nowISO() });
  }

  function setDerivedOverride(key: string, value: number) {
    if (!character) return;
    updateCharacter({ derivedOverrides: { ...character.derivedOverrides, [key]: value }, updatedAt: nowISO() });
  }

  function resetDerivedOverride(key: string) {
    if (!character) return;
    updateCharacter({ derivedOverrides: { ...character.derivedOverrides, [key]: null }, updatedAt: nowISO() });
  }

  const inputStyle = (editable: boolean): React.CSSProperties => ({
    padding: 'var(--space-sm)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    background: editable ? 'var(--color-surface-alt)' : 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 'var(--font-size-md)',
    width: '100%',
    cursor: editable ? 'text' : 'default',
    opacity: editable ? 1 : 0.7,
  });

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      {saveError && <div style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>{saveError}</div>}

      <SectionPanel title="Identity" collapsible defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Name</label>
            <input
              style={inputStyle(identityEditable)}
              value={character.name}
              disabled={!identityEditable}
              className={identityEditable ? 'field--editable' : 'field--locked'}
              onChange={e => updateCharacter({ name: e.target.value, updatedAt: nowISO() })}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Kin</label>
              <input style={inputStyle(identityEditable)} value={character.metadata.kin} disabled={!identityEditable} className={identityEditable ? 'field--editable' : 'field--locked'} onChange={e => updateMeta('kin', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Profession</label>
              <input style={inputStyle(identityEditable)} value={character.metadata.profession} disabled={!identityEditable} className={identityEditable ? 'field--editable' : 'field--locked'} onChange={e => updateMeta('profession', e.target.value)} />
            </div>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel title={`Attributes${isPlayMode ? ' (locked in Play Mode)' : ''}`} collapsible defaultOpen>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', justifyContent: 'center' }}>
          {system?.attributes.map(attr => (
            <AttributeField
              key={attr.id}
              attributeId={attr.id}
              abbreviation={attr.abbreviation}
              value={character.attributes[attr.id] ?? 10}
              min={attr.min}
              max={attr.max}
              onChange={v => updateAttr(attr.id, v)}
              disabled={!attributesEditable}
            />
          ))}
        </div>
      </SectionPanel>

      <SectionPanel title="Conditions" collapsible defaultOpen>
        {system && (
          <ConditionToggleGroup
            conditions={character.conditions}
            definitions={system.conditions}
            onChange={updateCondition}
          />
        )}
      </SectionPanel>

      <SectionPanel title="Resources" collapsible defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {['hp', 'wp'].map(resId => {
            const res = character.resources[resId];
            if (!res) return null;
            const def = system?.resources.find(r => r.id === resId);
            return (
              <ResourceTracker
                key={resId}
                resourceId={resId}
                label={def?.name ?? resId.toUpperCase()}
                current={res.current}
                max={res.max}
                onCurrentChange={v => updateResourceCurrent(resId, v)}
                onMaxChange={v => updateResourceMax(resId, v)}
                maxDisabled={!resourceMaxEditable}
              />
            );
          })}
        </div>
      </SectionPanel>

      <SectionPanel title="Derived Values" collapsible defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {([
            { key: 'movement', label: 'Movement' },
            { key: 'hpMax', label: 'HP Max' },
            { key: 'wpMax', label: 'WP Max' },
            { key: 'damageBonus', label: 'Damage Bonus' },
          ] as const).map(({ key, label }) => {
            const dv = getDerivedValue(character, key);
            return (
              <DerivedFieldDisplay
                key={key}
                label={label}
                computedValue={dv.computed}
                override={dv.override as number | null}
                onOverride={v => setDerivedOverride(key, v)}
                onReset={() => resetDerivedOverride(key)}
                editable={derivedEditable}
              />
            );
          })}
        </div>
      </SectionPanel>
    </div>
  );
}
