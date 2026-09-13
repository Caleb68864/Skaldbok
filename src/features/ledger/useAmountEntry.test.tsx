// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useAmountEntry } from './useAmountEntry';

/**
 * The amount field's two modes and the string that records how a figure was
 * reached.
 *
 * @remarks
 * `computeLineTotal` already covers the arithmetic. What is left here is the
 * part the ledger stores: `workings` goes into the entry's description, so an
 * empty one must mean "say nothing" rather than "say nothing useful" — an
 * entry reading `Fuel ()` is worse than one reading `Fuel`.
 */

afterEach(cleanup);

describe('useAmountEntry', () => {
  it('reads the field as a lump sum by default', () => {
    const { result } = renderHook(() => useAmountEntry());
    act(() => result.current.setAmountText('8400'));
    expect(result.current.total).toBe(8_400);
    expect(result.current.isUsable).toBe(true);
    expect(result.current.workings).toBe('');
  });

  it('multiplies once the quantity toggle is on', () => {
    const { result } = renderHook(() => useAmountEntry());
    act(() => result.current.setByUnit(true));
    act(() => result.current.setQtyText('6'));
    act(() => result.current.setAmountText('1400'));
    expect(result.current.total).toBe(8_400);
    expect(result.current.workings).toBe('6 × 1,400');
  });

  it('has nothing to record while the quantity is still blank', () => {
    const { result } = renderHook(() => useAmountEntry());
    act(() => result.current.setByUnit(true));
    act(() => result.current.setAmountText('1400'));
    // Not 1,400: a half-filled line must not be recordable as the unit price,
    // which is the figure the field happens to hold.
    expect(result.current.total).toBe(0);
    expect(result.current.isUsable).toBe(false);
    expect(result.current.workings).toBe('');
  });

  it('keeps the total when the toggle goes back off', () => {
    const { result } = renderHook(() => useAmountEntry());
    act(() => result.current.setByUnit(true));
    act(() => result.current.setQtyText('6'));
    act(() => result.current.setAmountText('1400'));
    act(() => result.current.setByUnit(false));
    // The field now reads as the sum it always was — 1,400, the number on
    // screen. Silently keeping 8,400 while showing 1,400 is the worse answer.
    expect(result.current.total).toBe(1_400);
    expect(result.current.workings).toBe('');
  });

  it('starts from an existing entry as an unsigned figure', () => {
    // Direction is a separate control, so the editor shows the magnitude.
    const { result } = renderHook(() => useAmountEntry(-5_000));
    expect(result.current.amountText).toBe('5000');
    expect(result.current.total).toBe(5_000);
  });

  it('clears the figures but leaves the toggle where the user put it', () => {
    const { result } = renderHook(() => useAmountEntry());
    act(() => result.current.setByUnit(true));
    act(() => result.current.setQtyText('6'));
    act(() => result.current.setAmountText('1400'));
    act(() => result.current.reset());
    expect(result.current.amountText).toBe('');
    expect(result.current.qtyText).toBe('');
    // Several passenger lines usually follow one another; re-toggling for each
    // is the tap this feature exists to remove.
    expect(result.current.byUnit).toBe(true);
  });
});
