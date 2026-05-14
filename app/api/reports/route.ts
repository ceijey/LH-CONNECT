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
    
    interface FinancialRecord {
      id: string;
      block: string;
      lot: string;
      resident: string;
      monthlyDues: number;
      amountPaid: number;
      balance: number;
      status: 'Paid' | 'Pending' | 'Delinquent' | 'Rejected';
      paymentMethod: string;
    }

    const financialData: FinancialRecord[] = residents.map((resident: any) => {
      const residentSubmissions = submissions.filter((s: any) => s.residentId === resident.id);

      const amountPaid = residentSubmissions
        .filter((s: any) => s.status === 'Verified')
        .reduce((sum: number, s: any) => sum + (Number(s.paymentAmount) || 0), 0);

      const hasPending = residentSubmissions.some((s: any) => s.status === 'Pending');
      const hasRejected = residentSubmissions.some((s: any) => s.status === 'Rejected');
      const hasVerified = residentSubmissions.some((s: any) => s.status === 'Verified');
      
      let status: 'Paid' | 'Pending' | 'Delinquent' | 'Rejected' = 'Delinquent';
      
      if (amountPaid >= monthlyDues || (amountPaid > 0 && Number(resident.balance || 0) <= 0)) {
        status = 'Paid';
      } else if (hasPending) {
        status = 'Pending';
      } else if (hasRejected && amountPaid === 0) {
        status = 'Rejected';
      } else if (Number(resident.balance || 0) > 0) {
        status = 'Delinquent';
      } else if (Number(resident.balance || 0) <= 0) {
        // If they have no balance and no pending/rejected, they are effectively Paid
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

    // 4. Filter and Calculate Summary & Analytics
    let finalData: any[] = financialData;
    
    if (type === 'Daily Report') {
      // For Daily Report, show individual transactions (submissions) for that day
      finalData = submissions.map((s: any) => {
        const resident = residents.find(r => r.id === s.residentId) || {};
        return {
          id: s.id,
          block: resident.block || s.blockLot?.split(' ')[1] || '-',
          lot: resident.lot || s.blockLot?.split(' ')[3] || '-',
          resident: resident.fullName || s.residentName || 'Unknown',
          monthlyDues: 400,
          amountPaid: Number(s.paymentAmount) || 0,
          balance: Number(resident.balance || 0),
          status: s.status === 'Verified' ? 'Paid' : s.status, // Map to table status types
          paymentMethod: s.paymentMethod || 'N/A',
          referenceNumber: s.referenceNumber || '-',
          date: s.submittedDate
        };
      });
    }

    // Summary logic
    let totalDues, totalCollected, outstandingBalance;

    if (type === 'Daily Report') {
      // For daily, summary reflects the day's submission volume
      totalDues = submissions.reduce((sum: number, s: any) => sum + (Number(s.paymentAmount) || 0), 0);
      totalCollected = submissions
        .filter((s: any) => s.status === 'Verified')
        .reduce((sum: number, s: any) => sum + (Number(s.paymentAmount) || 0), 0);
      outstandingBalance = totalDues - totalCollected;
    } else {
      // For monthly/annual, summary reflects overall resident balances
      totalDues = finalData.reduce((sum: number, d: FinancialRecord) => sum + d.monthlyDues, 0);
      totalCollected = finalData.reduce((sum: number, d: FinancialRecord) => sum + d.amountPaid, 0);
      outstandingBalance = finalData.reduce((sum: number, d: FinancialRecord) => sum + d.balance, 0);
    }

    const collectionRate = totalDues > 0 ? ((totalCollected / totalDues) * 100).toFixed(1) : '0';

    // Analytics: Payment Method Breakdown (including all statuses for total distribution)
    const methodCounts: Record<string, number> = {};
    submissions.forEach((s: any) => {
      const method = s.paymentMethod || 'Other';
      methodCounts[method] = (methodCounts[method] || 0) + 1;
    });

    const analytics = {
      totalCount: submissions.length,
      verifiedCount: submissions.filter((s: any) => s.status === 'Verified').length,
      pendingCount: submissions.filter((s: any) => s.status === 'Pending').length,
      rejectedCount: submissions.filter((s: any) => s.status === 'Rejected').length,
      paidCount: financialData.filter(d => d.status === 'Paid').length,
      delinquentCount: financialData.filter(d => d.status === 'Delinquent').length,
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
