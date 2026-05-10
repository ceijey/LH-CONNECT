import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const searchParams = request.nextUrl.searchParams;
  const monthStr = searchParams.get('month'); // e.g. "February 2026"
  const dateStr = searchParams.get('date');   // e.g. "2026-05-10"
  const type = searchParams.get('type') || 'Monthly Report';

  try {
    // 1. Fetch all residents
    const residentsSnapshot = await adminDb
      .collection('users')
      .where('role', '==', 'resident')
      .get();

    const residents = residentsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    // 2. Fetch submissions
    let submissionsQuery: any = adminDb.collection('payment_submissions');
    
    if (type === 'Daily Report' && dateStr) {
      // For daily report, we filter by the exact day in the 'submittedDate'
      // Note: In a real app, you'd probably use a timestamp range. 
      // Here we'll match the ISO string prefix or a specific field if available.
      submissionsQuery = submissionsQuery.where('submittedDate', '>=', `${dateStr}T00:00:00`);
      submissionsQuery = submissionsQuery.where('submittedDate', '<=', `${dateStr}T23:59:59`);
    } else if (type === 'Delinquency Report') {
      // For delinquency, we look at all residents with balance > 0
    } else {
      // Monthly/Annual (Annual would need more logic, for now we match monthStr)
      submissionsQuery = submissionsQuery.where('month', '==', monthStr);
    }

    const submissionsSnapshot = await submissionsQuery.get();
    const submissions = submissionsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    // 3. Process data
    const monthlyDues = 400; 
    
    const financialData = residents.map((resident: any) => {
      const residentSubmissions = submissions.filter((s: any) => s.residentId === resident.id);

      const amountPaid = residentSubmissions
        .filter((s: any) => s.status === 'Verified')
        .reduce((sum: number, s: any) => sum + (Number(s.paymentAmount) || 0), 0);

      const hasPending = residentSubmissions.some((s: any) => s.status === 'Pending');
      
      let status: 'Paid' | 'Pending' | 'Delinquent' = 'Delinquent';
      if (amountPaid >= monthlyDues) {
        status = 'Paid';
      } else if (hasPending) {
        status = 'Pending';
      } else if (Number(resident.balance || 0) > 0) {
        status = 'Delinquent';
      } else if (amountPaid > 0) {
        status = 'Paid'; 
      }

      return {
        id: resident.id,
        block: resident.block || '-',
        lot: resident.lot || '-',
        resident: resident.fullName || 'Unknown',
        monthlyDues,
        amountPaid,
        balance: Number(resident.balance || 0),
        status,
        paymentMethod: residentSubmissions[0]?.paymentMethod || 'N/A'
      };
    });

    // Filter Delinquency Report if requested
    const finalData = type === 'Delinquency Report' 
      ? financialData.filter(d => d.status === 'Delinquent') 
      : financialData;

    // 4. Calculate Summary & Analytics
    const totalDues = finalData.reduce((sum: number, d: any) => sum + d.monthlyDues, 0);
    const totalCollected = finalData.reduce((sum: number, d: any) => sum + d.amountPaid, 0);
    const outstandingBalance = finalData.reduce((sum: number, d: any) => sum + d.balance, 0);
    const collectionRate = totalDues > 0 ? ((totalCollected / totalDues) * 100).toFixed(1) : '0';

    // Analytics: Payment Method Breakdown
    const methodCounts: Record<string, number> = {};
    submissions.filter(s => s.status === 'Verified').forEach(s => {
      const method = s.paymentMethod || 'Other';
      methodCounts[method] = (methodCounts[method] || 0) + 1;
    });

    const analytics = {
      verifiedCount: submissions.filter(s => s.status === 'Verified').length,
      pendingCount: submissions.filter(s => s.status === 'Pending').length,
      methods: Object.entries(methodCounts).map(([name, value]) => ({ name, value }))
    };

    return NextResponse.json({
      financialData: finalData,
      summary: {
        totalDues,
        totalCollected,
        outstandingBalance,
        collectionRate
      },
      analytics
    });

  } catch (error: any) {
    console.error('Error generating report:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
