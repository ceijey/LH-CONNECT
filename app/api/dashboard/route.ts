import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const tokenVerification = await requireApprovedUser(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;
  const userId = decoded.uid;

  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData || userData.role !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Fetch Today's Collections
    const todayPaymentsSnapshot = await adminDb.collection('payments')
      .where('createdAt', '>=', today)
      .get();
    const todayCollections = todayPaymentsSnapshot.docs.reduce((sum: number, doc: any) => sum + (Number(doc.data().amount) || 0), 0);

    // 2. Fetch Monthly Total
    const monthlyPaymentsSnapshot = await adminDb.collection('payments')
      .where('createdAt', '>=', firstDayOfMonth)
      .get();
    const monthlyTotal = monthlyPaymentsSnapshot.docs.reduce((sum: number, doc: any) => sum + (Number(doc.data().amount) || 0), 0);

    // 3. Pending Verifications
    const pendingSubmissionsSnapshot = await adminDb.collection('payment_submissions')
      .where('status', '==', 'Pending')
      .get();
    const pendingVerifications = pendingSubmissionsSnapshot.size;

    // 4. Delinquent Accounts
    const residentsSnapshot = await adminDb.collection('users')
      .where('role', '==', 'resident')
      .get();
    const residents = residentsSnapshot.docs.map((doc: any) => doc.data());
    const delinquentCount = residents.filter((r: any) => (Number(r.balance) || 0) > 0).length;

    // 5. Collection Trends (Last 6 months)
    const trends: { month: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString('en-US', { month: 'short' });
      const monthName = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      
      // We can query by 'month' field if it exists, or by date range
      // The current system seems to use 'month' string in submissions
      // Let's check payments instead
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      
      const monthPaymentsSnapshot = await adminDb.collection('payments')
        .where('createdAt', '>=', start)
        .where('createdAt', '<=', end)
        .get();
      
      const total = monthPaymentsSnapshot.docs.reduce((sum: number, doc: any) => sum + (Number(doc.data().amount) || 0), 0);
      trends.push({ month: monthLabel, value: total });
    }

    // 6. Delinquency by Phase
    const phaseCounts: Record<string, number> = {};
    residents.forEach((r: any) => {
      if ((Number(r.balance) || 0) > 0) {
        const phase = r.phase || 'Unknown';
        phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
      }
    });
    
    const delinquencyByPhase = Object.entries(phaseCounts).map(([phase, count]) => ({
      phase,
      delinquent: count
    })).sort((a, b) => a.phase.localeCompare(b.phase));

    return NextResponse.json({
      stats: {
        todayCollections,
        monthlyTotal,
        pendingVerifications,
        delinquentCount,
        totalResidents: residents.length
      },
      trends,
      delinquencyByPhase
    });

  } catch (error: any) {
    console.error('Dashboard API Error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
