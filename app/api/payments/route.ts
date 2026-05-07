import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;
  const userId = decoded.uid;

  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      return createErrorResponse('User not found', 404);
    }

    const userRole = userData.role;
    let payments: any[] = [];

    if (userRole === 'admin') {
      // Admins: return all payments ordered by createdAt desc
      const paymentsSnapshot = await adminDb.collection('payments').orderBy('createdAt', 'desc').get();
      payments = paymentsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data(), source: 'payments' }));
      
      // Also fetch all submissions
      const submissionsSnapshot = await adminDb.collection('payment_submissions').orderBy('submittedAt', 'desc').get();
      const submissions = submissionsSnapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          residentId: data.residentId,
          amount: Number(data.paymentAmount ?? 0),
          status: data.status, // 'Pending', 'Verified', 'Rejected'
          method: data.paymentMethod,
          reference: data.referenceNumber,
          createdAt: data.submittedAt,
          submittedDate: data.submittedDate,
          verifiedDate: data.verifiedDate,
          month: data.month,
          source: 'submissions',
          notes: data.notes,
          rejectionReason: data.rejectionReason,
          fileUrl: data.fileUrl
        };
      });
      
      payments = [...payments, ...submissions];
    } else {
      // Residents: query payments for this resident
      const paymentsSnapshot = await adminDb.collection('payments').where('residentId', '==', userId).get();
      const regularPayments = paymentsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data(), source: 'payments' }));
      
      // Query submissions for this resident
      const submissionsSnapshot = await adminDb.collection('payment_submissions').where('residentId', '==', userId).get();
      const submissions = submissionsSnapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          residentId: data.residentId,
          amount: Number(data.paymentAmount ?? 0),
          status: data.status,
          method: data.paymentMethod,
          reference: data.referenceNumber,
          createdAt: data.submittedAt,
          submittedDate: data.submittedDate,
          verifiedDate: data.verifiedDate,
          month: data.month,
          source: 'submissions',
          notes: data.notes,
          rejectionReason: data.rejectionReason,
          fileUrl: data.fileUrl
        };
      });
      
      payments = [...regularPayments, ...submissions];
    }

    // Sort combined list by date descending
    payments.sort((a: any, b: any) => {
      const toMillis = (v: any) => {
        if (!v) return 0;
        if (typeof v.toMillis === 'function') return v.toMillis();
        if (v instanceof Date) return v.getTime();
        if (typeof v === 'string') return new Date(v).getTime() || 0;
        const n = Number(v);
        return Number.isFinite(n) ? n : new Date(v).getTime() || 0;
      };
      return toMillis(b.createdAt) - toMillis(a.createdAt);
    });

    return NextResponse.json({ payments, user: decoded });
  } catch (error: any) {
    console.error('Error fetching payments:', error.message || error);
    return createErrorResponse('Internal server error', 500);
  }
}
