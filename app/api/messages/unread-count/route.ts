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

export async function GET(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;

  try {
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    const userData = userDoc.data();

    if (!userData) {
      return createErrorResponse('User not found', 404);
    }

    const userRole = String(userData.role ?? '').toLowerCase();
    const snapshot =
      userRole === 'admin'
        ? await adminDb.collection('messages').get()
        : await adminDb.collection('messages').where('recipientId', '==', decoded.uid).get();

    const unreadCount = (snapshot.docs || []).filter((doc: any) => isUnreadMessage(doc.data())).length;

    return NextResponse.json({ unreadCount, user: decoded });
  } catch (error: any) {
    console.error('Error fetching unread message count:', error.message || error);
    return createErrorResponse('Internal server error', 500);
  }
}