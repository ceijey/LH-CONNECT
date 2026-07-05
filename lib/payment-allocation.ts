import { adminDb } from '@/lib/firebase-admin';

const MONTHLY_DUES = 400;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

type StatementRecord = {
  id: string;
  month: string;
  year: number;
  totalDues: number;
  amountPaid: number;
  balance: number;
  status: 'Paid' | 'Pending';
};

type AllocationEntry = {
  statementId: string;
  month: string;
  year: number;
  appliedAmount: number;
};

export type PaymentAllocationResult = {
  allocations: AllocationEntry[];
  totalOutstandingBalance: number;
  primaryDueMonthLabel: string;
};

function monthNameToIndex(month: string): number {
  const normalized = String(month || '').trim().toLowerCase();
  const index = MONTH_NAMES.findIndex((name) => name.toLowerCase() === normalized);
  return index >= 0 ? index : 0;
}

function monthYearKey(year: number, monthIndex: number): number {
  return year * 12 + monthIndex;
}

function getCurrentMonthYear(now: Date): { month: string; year: number; monthIndex: number } {
  return {
    month: MONTH_NAMES[now.getMonth()],
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
  };
}

function getNextMonthYear(monthIndex: number, year: number): { monthIndex: number; year: number } {
  if (monthIndex === 11) {
    return { monthIndex: 0, year: year + 1 };
  }

  return { monthIndex: monthIndex + 1, year };
}

function createStatementPayload(residentId: string, monthIndex: number, year: number, now: Date) {
  const month = MONTH_NAMES[monthIndex];
  const createdAtIso = now.toISOString();
  const dueDate = new Date(year, monthIndex, 15, 23, 59, 59).toISOString();

  return {
    residentId,
    month,
    year,
    date: createdAtIso,
    dueDate,
    totalDues: MONTHLY_DUES,
    amountPaid: 0,
    balance: MONTHLY_DUES,
    status: 'Pending' as const,
    createdAt: createdAtIso,
    updatedAt: createdAtIso,
  };
}

async function fetchResidentStatements(residentId: string): Promise<StatementRecord[]> {
  const snapshot = await adminDb.collection('statements').where('residentId', '==', residentId).get();

  return snapshot.docs.map((doc: any) => {
    const data = doc.data() ?? {};
    const totalDues = Number(data.totalDues ?? MONTHLY_DUES) || MONTHLY_DUES;
    const amountPaid = Number(data.amountPaid ?? 0);
    const balance = Math.max(0, totalDues - amountPaid);

    return {
      id: doc.id,
      month: String(data.month || 'January'),
      year: Number(data.year || new Date().getFullYear()),
      totalDues,
      amountPaid,
      balance,
      status: balance === 0 ? 'Paid' : 'Pending',
    };
  });
}

export async function allocatePaymentAcrossDues(residentId: string, paymentAmount: number, now = new Date()): Promise<PaymentAllocationResult> {
  let remaining = Number(paymentAmount || 0);
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return {
      allocations: [],
      totalOutstandingBalance: 0,
      primaryDueMonthLabel: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`,
    };
  }

  const statementsRef = adminDb.collection('statements');
  const currentMonth = getCurrentMonthYear(now);
  const statements = await fetchResidentStatements(residentId);

  const hasCurrentStatement = statements.some((stmt) => (
    stmt.year === currentMonth.year && monthNameToIndex(stmt.month) === currentMonth.monthIndex
  ));

  if (!hasCurrentStatement) {
    const payload = createStatementPayload(residentId, currentMonth.monthIndex, currentMonth.year, now);
    const newDocRef = await statementsRef.add(payload);
    statements.push({
      id: newDocRef.id,
      month: payload.month,
      year: payload.year,
      totalDues: payload.totalDues,
      amountPaid: 0,
      balance: payload.balance,
      status: 'Pending',
    });
  }

  const sortStatements = () => {
    statements.sort((a, b) => {
      const aKey = monthYearKey(a.year, monthNameToIndex(a.month));
      const bKey = monthYearKey(b.year, monthNameToIndex(b.month));
      return aKey - bKey;
    });
  };

  const allocations: AllocationEntry[] = [];
  sortStatements();

  while (remaining > 0) {
    let target = statements.find((stmt) => stmt.balance > 0);

    if (!target) {
      const maxExisting = statements.reduce(
        (acc, stmt) => {
          const stmtIndex = monthNameToIndex(stmt.month);
          const stmtKey = monthYearKey(stmt.year, stmtIndex);
          const accKey = monthYearKey(acc.year, acc.monthIndex);
          return stmtKey > accKey ? { monthIndex: stmtIndex, year: stmt.year } : acc;
        },
        { monthIndex: currentMonth.monthIndex, year: currentMonth.year }
      );

      const next = getNextMonthYear(maxExisting.monthIndex, maxExisting.year);
      const payload = createStatementPayload(residentId, next.monthIndex, next.year, now);
      const newDocRef = await statementsRef.add(payload);
      target = {
        id: newDocRef.id,
        month: payload.month,
        year: payload.year,
        totalDues: payload.totalDues,
        amountPaid: 0,
        balance: payload.balance,
        status: 'Pending',
      };
      statements.push(target);
      sortStatements();
    }

    const applyAmount = Math.min(remaining, target.balance);
    target.amountPaid += applyAmount;
    target.balance = Math.max(0, target.totalDues - target.amountPaid);
    target.status = target.balance === 0 ? 'Paid' : 'Pending';
    remaining -= applyAmount;

    await statementsRef.doc(target.id).update({
      amountPaid: target.amountPaid,
      balance: target.balance,
      status: target.status,
      updatedAt: now.toISOString(),
    });

    allocations.push({
      statementId: target.id,
      month: target.month,
      year: target.year,
      appliedAmount: applyAmount,
    });
  }

  const totalOutstandingBalance = statements.reduce((sum, stmt) => sum + Math.max(0, stmt.balance), 0);
  await adminDb.collection('users').doc(residentId).update({
    balance: totalOutstandingBalance,
    updatedAt: now.toISOString(),
  });

  const firstAllocation = allocations[0];
  const primaryDueMonthLabel = firstAllocation
    ? `${firstAllocation.month} ${firstAllocation.year}`
    : `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  return {
    allocations,
    totalOutstandingBalance,
    primaryDueMonthLabel,
  };
}
