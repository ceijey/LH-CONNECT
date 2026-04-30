import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

const formatTimestamp = (date: Date) => {
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return {
    date: date.toLocaleDateString(),
    time,
  };
};

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

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const messageText = String(body.message ?? '').trim();
    const subjectText = String(body.subject ?? '').trim();
    const recipientId = String(body.recipientId ?? '').trim() || 'admin';
    const priority = String(body.priority ?? 'Normal').trim() || 'Normal';

    if (!messageText) {
      return createErrorResponse('Message is required', 400);
    }

    const senderName = String(userData.fullName ?? userData.name ?? decoded.uid).trim();
    const addressParts = [userData.phase, userData.block && `Blk ${userData.block}`, userData.lot && `Lot ${userData.lot}`]
      .filter(Boolean)
      .join(' ');
    const now = new Date();
    const { date, time } = formatTimestamp(now);
    const subject = subjectText || `Message from ${senderName}`;

    const messagePayload = {
      senderId: decoded.uid,
      senderName,
      recipientId,
      recipientRole: String(body.recipientRole ?? (recipientId === 'admin' ? 'admin' : 'resident')).toLowerCase(),
      from: senderName,
      to: String(body.to ?? (recipientId === 'admin' ? 'HOA Admin' : recipientId)),
      phase: userData.phase ?? '',
      block: userData.block ?? '',
      lot: userData.lot ?? '',
      subject,
      message: messageText,
      preview: messageText.slice(0, 120),
      status: 'Unread',
      read: false,
      priority,
      date,
      time,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      address: addressParts,
    };

    const ref = await adminDb.collection('messages').add(messagePayload);

    return NextResponse.json({
      message: { id: ref.id, ...messagePayload },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating message:', error.message || error);
    return createErrorResponse('Internal server error', 500);
  }
}
