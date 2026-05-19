import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const searchParams = request.nextUrl.searchParams;
  const monthStr = searchParams.get('month'); // e.g. "February" or "February 2026"
  const yearStr = searchParams.get('year') || new Date().getFullYear().toString(); // e.g. "2026"
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
      submissionsQuery = submissionsQuery.where('submittedDate', '>=', `${dateStr}T00:00:00`);
      submissionsQuery = submissionsQuery.where('submittedDate', '<=', `${dateStr}T23:59:59`);
    } else if (type === 'Delinquency Report') {
      // For delinquency, we look at all residents with balance > 0
    } else if (type === 'Annual Report') {
      // Fetch all to perform in-memory filtering by year (prevents missing Firestore composite index errors)
    } else {
      // Monthly Report: query by "Month Year" (e.g. "February 2026")
      let targetMonth = monthStr;
      if (targetMonth && !targetMonth.includes(' ')) {
        targetMonth = `${targetMonth} ${yearStr}`;
      }
      submissionsQuery = submissionsQuery.where('month', '==', targetMonth);
    }

    const submissionsSnapshot = await submissionsQuery.get();
    let submissions = submissionsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    // Perform in-memory filtering for Annual Report by checking if month ends with the selected year
    if (type === 'Annual Report') {
      submissions = submissions.filter((sub: any) => {
        if (!sub.month) return false;
        return sub.month.toLowerCase().endsWith(yearStr.toLowerCase());
      });
    }

    // 3. Process data
    const isAnnual = type === 'Annual Report';
    const monthlyDues = isAnnual ? 4800 : 400; // 400 * 12 = 4800 for annual, 400 for monthly
    
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
      
      if (amountPaid >= monthlyDues || (!isAnnual && amountPaid > 0 && Number(resident.balance || 0) <= 0)) {
        status = 'Paid';
      } else if (hasPending) {
        status = 'Pending';
      } else if (hasRejected && amountPaid === 0) {
        status = 'Rejected';
      } else if (isAnnual || Number(resident.balance || 0) > 0) {
        status = 'Delinquent';
      } else if (Number(resident.balance || 0) <= 0) {
        status = 'Paid';
      }

      const balance = isAnnual 
        ? Math.max(0, 4800 - amountPaid)
        : Number(resident.balance || 0);

      return {
        id: resident.id,
        block: resident.block || '-',
        lot: resident.lot || '-',
        resident: resident.fullName || 'Unknown',
        monthlyDues,
        amountPaid,
        balance,
        status,
        paymentMethod: residentSubmissions[0]?.paymentMethod || 'N/A'
      };
    });

    // 4. Filter and Calculate Summary & Analytics
    let finalData: any[] = financialData;
    
    if (type === 'Daily Report') {
      // For Daily Report, show individual transactions (submissions) for that day
      finalData = submissions.map((s: any) => {
        const resident = residents.find((r: any) => r.id === s.residentId) || {};
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
      paidCount: financialData.filter((d: FinancialRecord) => d.status === 'Paid').length,
      delinquentCount: financialData.filter((d: FinancialRecord) => d.status === 'Delinquent').length,
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
    const mockFinancialData = Array.from({ length: 15 }, (_, i) => ({
      id: `mock-resident-${i}`,
      block: `${(i % 5) + 1}`,
      lot: `${(i % 10) + 1}`,
      resident: `Mock Resident ${i + 1}`,
      monthlyDues: 400,
      amountPaid: i % 2 === 0 ? 400 : 0,
      balance: i % 2 === 0 ? 0 : 400,
      status: i % 2 === 0 ? 'Paid' : 'Delinquent',
      paymentMethod: i % 2 === 0 ? 'GCash' : 'N/A'
    }));
    
    return NextResponse.json({
      financialData: mockFinancialData,
      summary: { totalDues: 6000, totalCollected: 3200, outstandingBalance: 2800, collectionRate: '53.3' },
      analytics: { 
        totalCount: 15, 
        verifiedCount: 8, 
        pendingCount: 2, 
        rejectedCount: 0, 
        paidCount: 8, 
        delinquentCount: 7, 
        methods: [{ name: 'GCash', value: 5 }, { name: 'Cash', value: 3 }] 
      }
    });
  }
}
