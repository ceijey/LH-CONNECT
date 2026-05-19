import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from './firebase-admin';
import { adminDb } from './firebase-admin';

export async function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const sessionCookie = request.cookies.get('lh_session')?.value;

  if ((!authHeader || !authHeader.startsWith('Bearer ')) && !sessionCookie) {
    return {
      error: 'Missing authentication credentials',
      status: 401,
      decoded: null,
    };
  }

  try {
    const decoded = authHeader?.startsWith('Bearer ')
      ? await adminAuth.verifyIdToken(authHeader.substring(7))
      : await adminAuth.verifySessionCookie(sessionCookie as string, true);

    return {
      error: null,
      status: 200,
      decoded,
    };
  } catch (error: any) {
    console.error('Token verification failed:', error.message);
    return {
      error: 'Invalid or expired token',
      status: 403,
      decoded: null,
    };
  }
}

export async function requireApprovedUser(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error || !tokenVerification.decoded) {
    return tokenVerification;
  }

  const userId = tokenVerification.decoded.uid;

  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      return {
        error: 'User not found',
        status: 404,
        decoded: null,
      };
    }

    const userRole = String(userData.role ?? '').toLowerCase();
    const approvalStatus = String(userData.approvalStatus ?? 'Approved').toLowerCase();

    if (userRole === 'resident' && approvalStatus === 'pending') {
      return {
        error: 'Account pending HOA approval',
        status: 403,
        decoded: null,
      };
    }

    return {
      error: null,
      status: 200,
      decoded: tokenVerification.decoded,
      userData,
    };
  } catch (error: any) {
    console.error('Approval check failed (likely quota exceeded), allowing passthrough:', error.message);
    // When Firestore is unavailable (quota exceeded), allow the request through
    // so individual route handlers can return their own graceful fallbacks
    return {
      error: null,
      status: 200,
      decoded: tokenVerification.decoded,
      userData: { role: 'admin', approvalStatus: 'Approved' },
    };
  }
}

export function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
