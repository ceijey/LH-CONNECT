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
    let paymentsSnapshot;

    if (userRole === 'admin') {
      // Admins: return all payments ordered by createdAt desc
      paymentsSnapshot = await adminDb.collection('payments').orderBy('createdAt', 'desc').get();
    } else {
      // Residents: query payments for this resident. Avoid server-side orderBy to skip composite-index requirements.
      paymentsSnapshot = await adminDb.collection('payments').where('residentId', '==', userId).get();
    }

    const payments = (paymentsSnapshot.docs || [])
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => {
        const toMillis = (v: any) => {
          if (!v) return 0;
          if (typeof v.toMillis === 'function') return v.toMillis();
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
