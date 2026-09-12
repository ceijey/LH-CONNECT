import type {
  CollectionReference,
  Transaction,
} from 'firebase-admin/firestore';

const MONTHLY_DUES = 400;
const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

export function statementTime(data: Record<string, unknown>): number {
  const monthText = String(data.month ?? '').toLowerCase();
  const month = MONTH_NAMES.findIndex((name) => monthText.includes(name));
  const monthYear = monthText.match(/\b(20\d{2})\b/)?.[1];
  const year = Number(data.year ?? monthYear);
  const createdAt = new Date(String(data.createdAt ?? '')).getTime();

  if (Number.isFinite(year) && month >= 0) {
    return new Date(year, month, 1).getTime();
  }

  return Number.isFinite(createdAt) ? createdAt : Number.MAX_SAFE_INTEGER;
}

export function getMonthIdentifier(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export async function ensureMissingStatementsForResident(
  transaction: Transaction,
  statementsRef: CollectionReference,
  residentId: string,
  residentCreatedAt?: string | Date | null,
  asOfDate: Date = new Date(),
): Promise<void> {
  const existingSnapshot = await transaction.get(
    statementsRef.where('residentId', '==', residentId),
  );

  const existingKeys = new Set<string>();
  for (const doc of existingSnapshot.docs) {
    const data = doc.data();
    const year = Number(data.year ?? 0);
    const monthName = String(data.month ?? '').trim();
    if (year && monthName) {
      const monthIndex = MONTH_NAMES.findIndex((name) => monthName.toLowerCase().includes(name));
      if (monthIndex >= 0) {
        existingKeys.add(getMonthIdentifier(new Date(year, monthIndex, 1)));
      }
    }
  }

  const startDate = residentCreatedAt ? new Date(residentCreatedAt) : asOfDate;
  const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const endMonth = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 1);
  const nowIso = new Date().toISOString();

  for (let cursor = new Date(startMonth); cursor <= endMonth; cursor.setMonth(cursor.getMonth() + 1)) {
    const monthKey = getMonthIdentifier(cursor);
    if (existingKeys.has(monthKey)) continue;

    const dueDate = new Date(cursor.getFullYear(), cursor.getMonth(), 15, 23, 59, 59);
    const monthName = cursor.toLocaleString('en-US', { month: 'long' });

    transaction.create(statementsRef.doc(), {
      residentId,
      month: monthName,
      year: cursor.getFullYear(),
      date: cursor.toISOString(),
      dueDate: dueDate.toISOString(),
      totalDues: MONTHLY_DUES,
      amountPaid: 0,
      balance: MONTHLY_DUES,
      status: 'Pending',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }
}

export function calculateOutstandingBalance(statementData: Record<string, unknown>[]): number {
  const statementsByMonth = new Map<string, { totalDues: number; amountPaid: number }>();

  for (const data of statementData) {
    const time = statementTime(data);
    const date = Number.isFinite(time) ? new Date(time) : null;
    const monthKey = date
      ? `${date.getFullYear()}-${date.getMonth()}`
      : String(data.month ?? '').toLowerCase();
    const totalDues = Math.max(0, Number(data.totalDues ?? MONTHLY_DUES));
    const amountPaid = Math.max(0, Number(data.amountPaid ?? 0));
    const existing = statementsByMonth.get(monthKey);

    if (!existing || amountPaid > existing.amountPaid) {
      statementsByMonth.set(monthKey, { totalDues, amountPaid });
    }
  }

  return Array.from(statementsByMonth.values()).reduce(
    (total, statement) => total + Math.max(0, statement.totalDues - statement.amountPaid),
    0
  );
}

export async function allocatePaymentToStatements(
  transaction: Transaction,
  statementsRef: CollectionReference,
  residentId: string,
  paymentAmount: number,
  residentCreatedAt?: string | Date | null,
): Promise<void> {
  if (paymentAmount <= 0) return;

  await ensureMissingStatementsForResident(
    transaction,
    statementsRef,
    residentId,
    residentCreatedAt,
    new Date(),
  );

  const statementSnapshot = await transaction.get(
    statementsRef.where('residentId', '==', residentId),
  );
  const statements = [...statementSnapshot.docs].sort(
    (a, b) => statementTime(a.data()) - statementTime(b.data()),
  );
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  let remaining = paymentAmount;

  for (const statement of statements) {
    if (remaining <= 0) break;

    const data = statement.data();
    if (statementTime(data) > currentMonthStart) continue;
    const totalDues = Math.max(0, Number(data.totalDues ?? MONTHLY_DUES));
    const amountPaid = Math.max(0, Number(data.amountPaid ?? 0));
    const currentBalance = Math.max(0, totalDues - amountPaid);

    if (currentBalance <= 0) continue;

    const appliedAmount = Math.min(remaining, currentBalance);
    const newAmountPaid = amountPaid + appliedAmount;
    const newBalance = Math.max(0, totalDues - newAmountPaid);

    transaction.update(statement.ref, {
      amountPaid: newAmountPaid,
      balance: newBalance,
      status: newBalance === 0 ? 'Paid' : 'Pending',
      updatedAt: new Date().toISOString(),
    });

    remaining -= appliedAmount;
  }
}
