import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';
import { countUnreadThreads } from '@/lib/message-threads';

export async function GET(request: NextRequest) {
  const tokenVerification = await requireApprovedUser(request);

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

    const unreadCount = countUnreadThreads((snapshot.docs || []).map((doc: any) => ({ id: doc.id, ...doc.data() })));

    return NextResponse.json({ unreadCount, user: decoded });
  } catch (error: any) {
    console.error('Error fetching unread message count:', error.message || error);
    return createErrorResponse('Internal server error', 500);
  }
}