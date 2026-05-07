import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, verifyToken } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

interface ProfilePayload {
  fullName: string;
  email: string;
  phase: string;
  block: string;
  lot: string;
  phone: string;
  role?: 'admin' | 'resident';
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
}

export async function GET(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error || !tokenVerification.decoded) {
    return createErrorResponse(
      tokenVerification.error ?? 'Unauthorized',
      tokenVerification.status ?? 401
    );
  }

  const { uid, email } = tokenVerification.decoded;

  try {
    const userRef = adminDb.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      const fallbackProfile = {
        fullName: 'User',
        email: email ?? '',
        role: 'resident' as const,
        approvalStatus: 'Pending' as const,
        createdAt: new Date().toISOString(),
      };

      await userRef.set(fallbackProfile, { merge: true });
      return NextResponse.json({ user: fallbackProfile });
    }

    return NextResponse.json({ user: userDoc.data() });
  } catch (error: any) {
    console.error('Error getting profile:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error || !tokenVerification.decoded) {
    return createErrorResponse(
      tokenVerification.error ?? 'Unauthorized',
      tokenVerification.status ?? 401
    );
  }

  const { uid } = tokenVerification.decoded;

  try {
    const body = (await request.json()) as ProfilePayload;

    if (!body.fullName || !body.email || !body.phase || !body.block || !body.lot || !body.phone) {
      return createErrorResponse('Missing required profile fields', 400);
    }

    const userProfile = {
      fullName: body.fullName,
      email: body.email,
      phase: body.phase,
      block: body.block,
      lot: body.lot,
      phone: body.phone,
      role: body.role === 'admin' ? 'admin' : 'resident',
      approvalStatus: body.role === 'admin' ? 'Approved' : 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingDoc = await adminDb.collection('users').doc(uid).get();
    if (existingDoc.exists) {
      const existingData = existingDoc.data();
      userProfile.approvalStatus = existingData?.approvalStatus ?? userProfile.approvalStatus;
    }

    await adminDb.collection('users').doc(uid).set(userProfile, { merge: true });

    return NextResponse.json({ message: 'Profile saved successfully', user: userProfile });
  } catch (error: any) {
    console.error('Error saving profile:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
