import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

const isUnreadMessage = (message: any) => {
  const status = String(message?.status ?? '').trim().toLowerCase();
  const read = message?.read;

  if (typeof read === 'boolean') {
    return !read;
  }

  return status === 'unread' || status === 'new';
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;
  const { id } = await params;

  try {
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    const userData = userDoc.data();

    if (!userData) {
      return createErrorResponse('User not found', 404);
    }

    const messageRef = adminDb.collection('messages').doc(id);
    const messageDoc = await messageRef.get();

    if (!messageDoc.exists) {
      return createErrorResponse('Message not found', 404);
    }

    const messageData = messageDoc.data() ?? {};
    const userRole = String(userData.role ?? '').toLowerCase();
    const canUpdate = userRole === 'admin' || messageData.recipientId === decoded.uid;

    if (!canUpdate) {
      return createErrorResponse('Forbidden', 403);
    }

    await messageRef.update({
      status: 'Read',
      read: true,
      updatedAt: new Date().toISOString(),
    });

    const updated = await messageRef.get();

    return NextResponse.json({
      message: { id: updated.id, ...updated.data() },
      unread: isUnreadMessage(updated.data()),
    });
  } catch (error: any) {
    console.error('Error updating message:', error.message || error);
    return createErrorResponse('Internal server error', 500);
  }
}