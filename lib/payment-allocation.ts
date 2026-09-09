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

export async function allocatePaymentToStatements(
  transaction: Transaction,
  statementsRef: CollectionReference,
  residentId: string,
  paymentAmount: number,
): Promise<void> {
  if (paymentAmount <= 0) return;

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
