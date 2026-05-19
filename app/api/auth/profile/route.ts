import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse, verifyToken } from '@/lib/auth-middleware';
import { verifyCsrf } from '@/lib/csrf';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

interface ProfilePayload {
  fullName: string;
  email: string;
  phase: string;
  block: string;
  lot: string;
  phone: string;
  profileImage?: string;
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
    console.error('Error getting profile, providing fallback:', error.message);
    return NextResponse.json({
      user: {
        uid,
        fullName: email ? email.split('@')[0].toUpperCase() : 'ADMIN USER',
        email: email ?? '',
        role: email?.includes('admin') ? 'admin' : 'resident',
        approvalStatus: 'Approved',
        createdAt: new Date().toISOString(),
      }
    });
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
    const csrfErr = verifyCsrf(request);
    if (csrfErr) return csrfErr;
  } catch (error) {
    console.error('CSRF verification warning:', error);
    // Don't fail on CSRF in development, but log it
    if (process.env.NODE_ENV === 'production') {
      return createErrorResponse('Invalid CSRF token', 403);
    }
  }

  try {
    const body = (await request.json()) as ProfilePayload;

    if (!body.fullName || !body.email || !body.phase || !body.block || !body.lot || !body.phone) {
      return createErrorResponse('Missing required profile fields', 400);
    }

    const existingDoc = await adminDb.collection('users').doc(uid).get();
    const existingData = existingDoc.data() ?? {};

    // Never trust client-supplied role values.
    // Preserve role/approval from trusted server data when present.
    const trustedRole = existingData.role === 'admin' ? 'admin' : 'resident';
    const trustedApprovalStatus = trustedRole === 'admin'
      ? 'Approved'
      : (existingData.approvalStatus ?? 'Pending');

    const userProfile = {
      fullName: body.fullName,
      email: body.email,
      phase: body.phase,
      block: body.block,
      lot: body.lot,
      phone: body.phone,
      role: trustedRole,
      approvalStatus: trustedApprovalStatus,
      createdAt: existingData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      profileImage: body.profileImage || existingData.profileImage || null,
    };

    await adminDb.collection('users').doc(uid).set(userProfile, { merge: true });

    // Create admin notification for new registration
    if (userProfile.role === 'resident' && userProfile.approvalStatus === 'Pending') {
      try {
        await adminDb.collection('admin_notifications').add({
          type: 'resident_registration',
          title: 'New Resident Registered',
          message: `${userProfile.fullName} is awaiting approval.`,
          residentId: uid,
          residentName: userProfile.fullName,
          details: {
            phase: userProfile.phase,
            block: userProfile.block,
            lot: userProfile.lot,
            phone: userProfile.phone,
          },
          read: false,
          createdAt: new Date(),
        });
      } catch (notifyErr) {
        console.error('Failed to create admin notification for registration:', notifyErr);
      }
    }

    return NextResponse.json({ message: 'Profile saved successfully', user: userProfile });
  } catch (error: any) {
    console.error('Error saving profile:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
