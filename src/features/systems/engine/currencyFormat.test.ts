import { describe, it, expect } from 'vitest';
import { classicFantasyEngine, travellerEngine, savageWorldsEngine } from './index';

describe('CurrencyModel.formatAmount / baseDenominationId', () => {
  describe('Traveller', () => {
    it('names credits as the base denomination', () => {
      expect(travellerEngine.currency.baseDenominationId).toBe('credits');
    });

    it('formats a positive amount with thousands separators', () => {
      expect(travellerEngine.currency.formatAmount(15000)).toContain('15,000');
    });

    it('formats a negative amount as negative', () => {
      const formatted = travellerEngine.currency.formatAmount(-15000);
      expect(formatted).toContain('-');
      expect(formatted).toContain('15,000');
    });

    it('renders zero as the base denomination with a 0', () => {
      const formatted = travellerEngine.currency.formatAmount(0);
      expect(formatted).toContain('0');
      expect(formatted.length).toBeGreaterThan(1);
    });
  });

  describe('classic-fantasy', () => {
    it('names copper as the base denomination', () => {
      expect(classicFantasyEngine.currency.baseDenominationId).toBe('copper');
    });

    it('decomposes an amount spanning denominations into more than one abbreviation', () => {
      // 1g 2s 3c
      const formatted = classicFantasyEngine.currency.formatAmount(123);
      expect(formatted).toContain('g');
      expect(formatted).toContain('s');
      expect(formatted).toContain('c');
    });

    it('renders zero as the smallest denomination with a 0', () => {
      expect(classicFantasyEngine.currency.formatAmount(0)).toBe('0c');
    });

    it('formats a negative amount as negative', () => {
      expect(classicFantasyEngine.currency.formatAmount(-123)).toMatch(/^-/);
    });
  });

  describe('Savage Worlds', () => {
    it('names cash as the base denomination', () => {
      expect(savageWorldsEngine.currency.baseDenominationId).toBe('cash');
    });

    it('formats a single-denomination amount', () => {
      expect(savageWorldsEngine.currency.formatAmount(500)).toContain('500');
    });
  });
});
