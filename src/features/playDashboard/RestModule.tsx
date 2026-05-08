import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import { useToast } from '../../context/ToastContext';
import { applyRoundRest, applyShiftRest, applyStretchRest } from '../../utils/restActions';
import { nowISO } from '../../utils/dates';
import { clamp, rollDie, type PlayModuleProps } from './types';
import { useSessionLog } from '../session/useSessionLog';

export function RestModule({ character, updateCharacter }: PlayModuleProps) {
  const { showToast } = useToast();
  const { logRest } = useSessionLog();

  function roundRest() {
    const roll = rollDie(6);
    const result = applyRoundRest(character, roll);
    updateCharacter(prev => ({
      resources: { ...prev.resources, wp: { ...prev.resources.wp, current: result.newWpCurrent } },
      updatedAt: nowISO(),
    }));
    showToast(`Round rest rolled ${roll}: recovered ${result.recovered} WP.`, 'success');
    logRest(character.name, 'Round Rest', `Rolled ${roll}, recovered ${result.recovered} WP`);
  }

  function stretchRest() {
    const wpRoll = rollDie(6);
    const hpRoll = rollDie(6);
    const activeCondition = Object.entries(character.conditions).find(([, active]) => active)?.[0];
    const result = applyStretchRest(character, wpRoll, hpRoll, activeCondition);
    updateCharacter(prev => ({
      resources: {
        ...prev.resources,
        wp: { ...prev.resources.wp, current: result.newWpCurrent },
        hp: { ...prev.resources.hp, current: result.newHpCurrent },
      },
      conditions: result.conditionCleared ? { ...prev.conditions, [result.conditionCleared]: false } : prev.conditions,
      updatedAt: nowISO(),
    }));
    showToast(`Stretch rest: HP +${result.hpRecovered}, WP restored.`, 'success');
    logRest(character.name, 'Stretch Rest', `HP roll ${hpRoll}, WP roll ${wpRoll}`);
  }

  function shiftRest() {
    const result = applyShiftRest(character);
    updateCharacter(prev => ({
      resources: {
        ...prev.resources,
        hp: { ...prev.resources.hp, current: prev.resources.hp?.max ?? 0 },
        wp: { ...prev.resources.wp, current: prev.resources.wp?.max ?? 0 },
      },
      conditions: Object.fromEntries(Object.keys(prev.conditions).map(id => [id, false])),
      updatedAt: nowISO(),
    }));
    showToast(`Shift rest: ${clamp(result.hpRestored, 0, 999)} HP and ${clamp(result.wpRestored, 0, 999)} WP restored.`, 'success');
    logRest(character.name, 'Shift Rest', 'Fully recovered');
  }

  return (
    <SectionPanel title="Rest" collapsible defaultOpen>
      <div className="flex gap-3 flex-wrap">
        <Button variant="secondary" onClick={roundRest}>Round Rest</Button>
        <Button variant="secondary" onClick={stretchRest}>Stretch Rest</Button>
        <Button variant="primary" onClick={shiftRest}>Shift Rest</Button>
      </div>
    </SectionPanel>
  );
}
