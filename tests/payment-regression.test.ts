import { describe, expect, test } from 'vitest';
import {
  calculateOutstandingBalance,
  statementTime,
} from '../lib/payment-allocation';
import { validatePaymentAmount } from '../lib/payment-validation';

describe('payment validation', () => {
  test('accepts a positive finite amount', () => {
    expect(validatePaymentAmount(400)).toEqual({ isValid: true });
  });

  test('rejects zero, negative, non-finite, and oversized amounts', () => {
    expect(validatePaymentAmount(0).isValid).toBe(false);
    expect(validatePaymentAmount(-1).isValid).toBe(false);
    expect(validatePaymentAmount(Number.NaN).isValid).toBe(false);
    expect(validatePaymentAmount(Number.POSITIVE_INFINITY).isValid).toBe(false);
    expect(validatePaymentAmount(1_000_000_001).isValid).toBe(false);
  });
});

describe('statement ledger calculations', () => {
  test('uses the statement month and year for chronological ordering', () => {
    expect(statementTime({ month: 'February', year: 2026 }))
      .toBe(new Date(2026, 1, 1).getTime());
  });

  test('deduplicates repeated statements using the highest payment applied', () => {
    const balance = calculateOutstandingBalance([
      { month: 'January', year: 2026, totalDues: 400, amountPaid: 0 },
      { month: 'January', year: 2026, totalDues: 400, amountPaid: 400 },
      { month: 'February', year: 2026, totalDues: 400, amountPaid: 100 },
    ]);

    expect(balance).toBe(300);
  });

  test('never returns a negative outstanding balance', () => {
    expect(calculateOutstandingBalance([
      { month: 'March', year: 2026, totalDues: 400, amountPaid: 500 },
    ])).toBe(0);
  });
});