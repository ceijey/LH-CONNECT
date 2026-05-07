import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const userId = tokenVerification.decoded!.uid;

  try {
    const adminDoc = await adminDb.collection('users').doc(userId).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

    const residentDoc = await adminDb.collection('users').doc(id).get();
    if (!residentDoc.exists) {
      return createErrorResponse('Resident not found', 404);
    }

    const residentData = residentDoc.data();
    if (residentData?.role !== 'resident') {
      return createErrorResponse('User is not a resident', 400);
    }

    return NextResponse.json({ id, ...residentData });
  } catch (error: any) {
    console.error('Error fetching resident:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const userId = tokenVerification.decoded!.uid;

  try {
    const adminDoc = await adminDb.collection('users').doc(userId).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

    const body = await request.json();
    const updatePayload: any = {};

    // Only allow updating certain fields
    const allowedFields = ['fullName', 'phone', 'phase', 'block', 'lot', 'status', 'balance', 'approvalStatus'];
    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updatePayload[field] = body[field];
      }
    });

    if (Object.keys(updatePayload).length === 0) {
      return createErrorResponse('No valid fields to update', 400);
    }

    updatePayload.updatedAt = new Date().toISOString();

    await adminDb.collection('users').doc(id).update(updatePayload);

    return NextResponse.json({ message: 'Resident updated successfully' });
  } catch (error: any) {
    console.error('Error updating resident:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const userId = tokenVerification.decoded!.uid;

  try {
    const adminDoc = await adminDb.collection('users').doc(userId).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

    // 1. Delete from Firebase Auth
    try {
      await adminAuth.deleteUser(id);
    } catch (authError: any) {
      console.warn('User not found in Auth or failed to delete Auth account:', authError.message);
      // Continue to delete Firestore record anyway if it exists
    }

    // 2. Delete from Firestore
    await adminDb.collection('users').doc(id).delete();

    return NextResponse.json({ message: 'Resident deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting resident:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
