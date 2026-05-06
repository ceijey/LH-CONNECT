import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

export async function PATCH(request: NextRequest, context: any) {
  const id = context?.params?.id;
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;
  const userId = decoded.uid;

  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    if (!userData) return createErrorResponse('User not found', 404);

    if ((userData.role ?? '') !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

    const body = await request.json();
    const { status } = body as { status?: string };
    if (!status || !['Verified', 'Pending', 'Rejected'].includes(status)) {
      return createErrorResponse('Invalid status', 400);
    }

    const docRef = adminDb.collection('payment_submissions').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return createErrorResponse('Submission not found', 404);

    const now = new Date();
    const updatePayload: any = { status, updatedAt: now };
    if (status === 'Verified') {
      updatePayload.verifiedAt = now;
      updatePayload.verifiedDate = now.toLocaleString();
    } else if (status === 'Rejected') {
      updatePayload.verifiedAt = null;
      updatePayload.verifiedDate = null;
    }

    await docRef.update(updatePayload);

    const updated = (await docRef.get()).data();

    // Optionally add an admin notification or resident notification here

    return NextResponse.json({ submission: { id, ...updated } });
  } catch (error: any) {
    console.error('Error updating submission status:', error?.message ?? error);
    return createErrorResponse('Internal server error', 500);
  }
}
