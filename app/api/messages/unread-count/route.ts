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
    // Use userData from middleware to avoid redundant Firestore read
    const userData = (tokenVerification as any).userData;

    if (!userData) {
      return createErrorResponse('User not found', 404);
    }

    const userRole = String(userData.role ?? '').toLowerCase();

    // For admins, count across all messages. For residents, include threads
    // where they are either the sender or the recipient (de-duplicated).
    let docs: any[] = [];

    if (userRole === 'admin') {
      const snapshot = await adminDb.collection('messages').get();
      docs = snapshot.docs;
    } else {
      const [sentSnap, receivedSnap] = await Promise.all([
        adminDb.collection('messages').where('senderId', '==', decoded.uid).get(),
        adminDb.collection('messages').where('recipientId', '==', decoded.uid).get(),
      ]);

      const map = new Map<string, any>();
      for (const d of [...(sentSnap.docs || []), ...(receivedSnap.docs || [])]) {
        map.set(d.id, d);
      }

      docs = Array.from(map.values());
    }

    const unreadCount = countUnreadThreads((docs || []).map((doc: any) => ({ id: doc.id, ...doc.data() })));

    return NextResponse.json({ unreadCount, user: decoded });
  } catch (error: any) {
    console.error('Error fetching unread message count:', error.message || error);
    return NextResponse.json({ unreadCount: 0, user: decoded });
  }
}