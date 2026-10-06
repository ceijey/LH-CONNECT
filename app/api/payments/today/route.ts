import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const tokenVerification = await requireAdmin(request);
  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  try {
    // Use server local timezone for "today" (midnight -> now)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // Query regular payments where createdAt >= startOfDay
    const paymentsQuery = adminDb
      .collection('payments')
      .where('createdAt', '>=', startOfDay);

    const paymentsSnapshot = await paymentsQuery.get();
    const paymentsCount = paymentsSnapshot.size || 0;

    // Query payment submissions where submittedAt >= startOfDay
    const submissionsQuery = adminDb
      .collection('payment_submissions')
      .where('submittedAt', '>=', startOfDay);

    const submissionsSnapshot = await submissionsQuery.get();
    const submissionsCount = submissionsSnapshot.size || 0;

    const total = paymentsCount + submissionsCount;

    return NextResponse.json({ count: total });
  } catch (err: any) {
    console.error('Error fetching today payments count', err?.message || err);
    return NextResponse.json({ error: 'Payment count is temporarily unavailable' }, { status: 503 });
  }
}
