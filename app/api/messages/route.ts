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
    // Get the requesting user's role
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      return createErrorResponse('User not found', 404);
    }

    const userRole = userData.role;

    let messagesSnapshot;

    if (userRole === 'admin') {
      // Admins see all messages
      messagesSnapshot = await adminDb.collection('messages').orderBy('createdAt', 'desc').get();
    } else {
      // Residents see messages addressed to them (recipientId)
      // Avoid server-side orderBy to prevent Firestore composite index requirements.
      messagesSnapshot = await adminDb.collection('messages').where('recipientId', '==', userId).get();
    }

    const messages = (messagesSnapshot.docs || [])
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

    return NextResponse.json({ messages, user: decoded });
  } catch (error: any) {
    console.error('Error fetching messages:', error.message || error);
    return createErrorResponse('Internal server error', 500);
  }
}
