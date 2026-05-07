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

    // 2. Fetch payments/submissions for the selected month
    // For simplicity, we'll look at 'Verified' payments in the 'payments' collection
    // and 'Pending' submissions in 'payment_submissions'
    const submissionsSnapshot = await adminDb
      .collection('payment_submissions')
      .where('status', 'in', ['Verified', 'Pending'])
      .get();

    const submissions = submissionsSnapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data());

    // 3. Process data
    const monthlyDues = 500; // Fixed for now
    
    const financialData = residents.map((resident: any) => {
      // Find submission for this resident in the selected month
      const residentSubmissions = submissions.filter((s: any) => 
        s.residentId === resident.id && s.month === monthStr
      );

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
        block: resident.block || '-',
        lot: resident.lot || '-',
        resident: resident.fullName || 'Unknown',
        monthlyDues,
        amountPaid,
        balance: Number(resident.balance || 0),
        status
      };
    });

    // 4. Calculate Summary
    const totalDues = financialData.reduce((sum: number, d: any) => sum + d.monthlyDues, 0);
    const totalCollected = financialData.reduce((sum: number, d: any) => sum + d.amountPaid, 0);
    const outstandingBalance = financialData.reduce((sum: number, d: any) => sum + d.balance, 0);
    const collectionRate = totalDues > 0 ? ((totalCollected / totalDues) * 100).toFixed(1) : '0';

    return NextResponse.json({
      financialData,
      summary: {
        totalDues,
        totalCollected,
        outstandingBalance,
        collectionRate
      }
    });

  } catch (error: any) {
    console.error('Error generating report:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
