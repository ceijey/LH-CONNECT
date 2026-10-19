import { describe, expect, test } from 'vitest';
import {
  calculateOutstandingBalance,
  allocatePaymentToStatements,
  allocatePaymentToSelectedStatements,
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

  test('creates and pays two months when an 800 advance payment is allocated', async () => {
    const now = new Date();
    const created: Array<Record<string, unknown>> = [];
    const updated: Array<Record<string, unknown>> = [];
    let referenceId = 0;
    const transaction = {
      get: async () => ({ docs: [] }),
      create: (_ref: unknown, data: Record<string, unknown>) => created.push(data),
      update: (_ref: unknown, data: Record<string, unknown>) => updated.push(data),
    };
    const statementsRef = {
      where: () => ({}),
      doc: () => ({ id: `statement-${referenceId++}` }),
    };
    const residentCreatedAt = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    await allocatePaymentToStatements(
      transaction as never,
      statementsRef as never,
      'resident-1',
      800,
      residentCreatedAt,
    );

    expect(created).toHaveLength(2);
    expect(created.map((statement) => statement.amountPaid)).toEqual([400, 400]);
    expect(updated).toHaveLength(0);
  });

  test('applies a partial payment to the oldest unpaid statement', async () => {
    const updated: Array<{ id: string; data: Record<string, unknown> }> = [];
    const transaction = {
      get: async () => ({
        docs: [{
          ref: { id: 'january' },
          data: () => ({
            month: 'January',
            year: 2026,
            totalDues: 400,
            amountPaid: 0,
          }),
        }],
      }),
      create: () => undefined,
      update: (ref: { id: string }, data: Record<string, unknown>) => updated.push({ id: ref.id, data }),
    };
    const statementsRef = {
      where: () => ({}),
      doc: () => ({ id: 'new-statement' }),
    };

    await allocatePaymentToStatements(
      transaction as never,
      statementsRef as never,
      'resident-1',
      250,
      new Date(2026, 0, 1).toISOString(),
    );

    expect(updated).toEqual([{
      id: 'january',
      data: expect.objectContaining({
        amountPaid: 250,
        balance: 150,
        status: 'Pending',
      }),
    }]);
  });

  test('uses a 4800 payment for twelve total months including arrears', async () => {
    const updated: Array<{ id: string; data: Record<string, unknown> }> = [];
    const existingDocs = [-3, -2, -1].map((offset) => {
      const date = new Date(2026, 5 + offset, 1);
      return {
        ref: { id: `statement-${offset}` },
        data: () => ({
          month: date.toLocaleString('en-US', { month: 'long' }),
          year: date.getFullYear(),
          totalDues: 400,
          amountPaid: 0,
        }),
      };
    });
    const transaction = {
      get: async () => ({ docs: existingDocs }),
      create: () => undefined,
      update: (ref: { id: string }, data: Record<string, unknown>) => updated.push({ id: ref.id, data }),
    };
    const statementsRef = {
      where: () => ({}),
      doc: () => ({ id: 'future-statement' }),
    };

    await allocatePaymentToStatements(
      transaction as never,
      statementsRef as never,
      'resident-1',
      4800,
      new Date(2026, 3, 1).toISOString(),
    );

    expect(updated).toHaveLength(3);
    expect(updated.every(({ data }) => data.amountPaid === 400 && data.status === 'Paid')).toBe(true);
  });

  test('pays older July-to-September balances before creating future advance statements', async () => {
    const now = new Date();
    const monthData = (offset: number, id: string) => {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return {
        ref: { id },
        data: () => ({
          residentId: 'resident-1',
          month: date.toLocaleString('en-US', { month: 'long' }),
          year: date.getFullYear(),
          totalDues: 400,
          amountPaid: 0,
          balance: 400,
          status: 'Pending',
          createdAt: date.toISOString(),
        }),
      };
    };
    const existingDocs = [monthData(-3, 'july'), monthData(-2, 'august'), monthData(-1, 'september')];
    const updated: Array<{ id: string; data: Record<string, unknown> }> = [];
    const transaction = {
      get: async () => ({ docs: existingDocs }),
      create: () => undefined,
      update: (ref: { id: string }, data: Record<string, unknown>) => updated.push({ id: ref.id, data }),
    };
    const statementsRef = {
      where: () => ({}),
      doc: () => ({ id: 'future-statement' }),
    };
    const residentCreatedAt = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();

    await allocatePaymentToStatements(
      transaction as never,
      statementsRef as never,
      'resident-1',
      1200,
      residentCreatedAt,
    );

    expect(updated.map((entry) => entry.id)).toEqual(['july', 'august', 'september']);
    expect(updated.every((entry) => entry.data.amountPaid === 400 && entry.data.status === 'Paid')).toBe(true);
  });

  test('pays explicitly selected non-consecutive months', async () => {
    const created: Array<Record<string, unknown>> = [];
    const updated: Array<{ id: string; data: Record<string, unknown> }> = [];
    const existingDocs = [{
      ref: { id: 'june' },
      data: () => ({ month: 'June', year: 2026, totalDues: 400, amountPaid: 0 }),
    }];
    const transaction = {
      get: async () => ({ docs: existingDocs }),
      create: (_ref: unknown, data: Record<string, unknown>) => created.push(data),
      update: (ref: { id: string }, data: Record<string, unknown>) => updated.push({ id: ref.id, data }),
    };
    const statementsRef = {
      where: () => ({}),
      doc: () => ({ id: 'september' }),
    };

    await allocatePaymentToSelectedStatements(
      transaction as never,
      statementsRef as never,
      'resident-1',
      800,
      [
        { month: 'June', year: 2026 },
        { month: 'September', year: 2026 },
      ],
    );

    expect(updated).toEqual([{ id: 'june', data: expect.objectContaining({ amountPaid: 400, status: 'Paid' }) }]);
    expect(created).toHaveLength(1);
    expect(created[0]).toEqual(expect.objectContaining({
      month: 'September',
      year: 2026,
      amountPaid: 400,
      status: 'Paid',
    }));
  });
});