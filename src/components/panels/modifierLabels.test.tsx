// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BuffChipBar } from './BuffChipBar';
import { DebtList } from '../fields/DebtList';
import { getEngine } from '../../features/systems/engine';
import { classicFantasySystem } from '../../systems/classic-fantasy';
import { formatStatLabel } from '../../features/systems/engine/statLabel';

vi.mock('../../features/systems/engine', async importOriginal => ({
  ...(await importOriginal<typeof import('../../features/systems/engine')>()),
  useSystemEngine: () => getEngineForTest(),
}));
const getEngineForTest = () => getEngine(classicFantasySystem);

afterEach(cleanup);

describe('modifier labels (roadmap C4)', () => {
  it('prints the label the engine offered, not the namespaced id', () => {
    const modifier = {
      id: 'm1', label: 'Strong', duration: 'round', createdAt: '',
      effects: [{ stat: 'attr:str', delta: 2 }],
    };
    render(<BuffChipBar modifiers={[modifier] as never} onRemove={() => {}} onClearAll={() => {}} onAdd={() => {}} system={classicFantasySystem} />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(document.body.textContent).toContain('STR +2');
    expect(document.body.textContent).not.toContain('ATTR:STR');
  });

  it('falls back to the stat id for one the engine no longer offers', () => {
    expect(formatStatLabel('attr:gone', getEngine(classicFantasySystem), classicFantasySystem)).toBe('attr:gone');
  });
});

describe('DebtList amounts (roadmap C4)', () => {
  it('formats with the engine, as the purse does', () => {
    const debts = [{ id: 'd', counterparty: 'Bank', amount: 150, direction: 'owed', createdAt: '' }];
    render(
      <DebtList
        debts={debts as never}
        abbr="c"
        formatAmount={getEngine(classicFantasySystem).currency.formatAmount}
        editable={false}
        onAdd={() => {}} onSettle={() => {}} onPay={() => {}} onReopen={() => {}} onRemove={() => {}}
      />,
    );
    expect(document.body.textContent).toContain('1g 5s');
    expect(document.body.textContent).not.toContain('150 c');
  });
});
