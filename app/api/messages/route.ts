import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';
import { groupMessagesIntoThreads } from '@/lib/message-threads';

const formatTimestamp = (date: Date) => {
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return {
    date: date.toLocaleDateString(),
    time,
  };
};

const buildReply = (
  messageText: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  date: string,
  time: string,
) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  senderId,
  senderName,
  senderRole,
  message: messageText,
  date,
  time,
});

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
      // Admins see all message threads.
      messagesSnapshot = await adminDb.collection('messages').get();
    } else {
      // Residents see their own threads, including sent messages and admin replies.
      messagesSnapshot = await adminDb.collection('messages').get();
    }

    const messages = groupMessagesIntoThreads((messagesSnapshot.docs || [])
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .filter((message: any) => (
        userRole === 'admin'
          ? true
          : message.senderId === userId || message.recipientId === userId
      )));

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
    const threadId = String(body.threadId ?? '').trim();

    if (!messageText) {
      return createErrorResponse('Message is required', 400);
    }

    const senderName = String(userData.fullName ?? userData.name ?? decoded.uid).trim();
    const senderRole = String(userData.role ?? 'resident').toLowerCase();
    const addressParts = [userData.phase, userData.block && `Blk ${userData.block}`, userData.lot && `Lot ${userData.lot}`]
      .filter(Boolean)
      .join(' ');
    const now = new Date();
    const { date, time } = formatTimestamp(now);
    const subject = subjectText || `Message from ${senderName}`;
    const reply = buildReply(messageText, decoded.uid, senderName, senderRole, date, time);

    if (threadId) {
      const threadRef = adminDb.collection('messages').doc(threadId);
      const threadDoc = await threadRef.get();

      if (!threadDoc.exists) {
        return createErrorResponse('Message thread not found', 404);
      }

      const existingThread = threadDoc.data() ?? {};
      const existingReplies = Array.isArray(existingThread.replies) ? existingThread.replies : [];
      const updatedReplies = [...existingReplies, reply];

      const updatedThread = {
        ...existingThread,
        senderId: existingThread.senderId ?? decoded.uid,
        senderName: existingThread.senderName ?? senderName,
        recipientId: recipientId || existingThread.recipientId || 'admin',
        recipientRole: String(body.recipientRole ?? existingThread.recipientRole ?? (recipientId === 'admin' ? 'admin' : 'resident')).toLowerCase(),
        from: senderName,
        to: String(body.to ?? existingThread.to ?? (recipientId === 'admin' ? 'HOA Admin' : recipientId)),
        phase: userData.phase ?? existingThread.phase ?? '',
        block: userData.block ?? existingThread.block ?? '',
        lot: userData.lot ?? existingThread.lot ?? '',
        subject,
        message: messageText,
        preview: messageText.slice(0, 120),
        status: 'Unread',
        read: false,
        priority,
        date,
        time,
        replies: updatedReplies,
        updatedAt: now.toISOString(),
      };

      await threadRef.set(updatedThread, { merge: true });

      return NextResponse.json({
        message: { id: threadDoc.id, ...updatedThread },
      }, { status: 200 });
    }

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
      replies: [reply],
    };

    const ref = adminDb.collection('messages').doc();

    await ref.set({
      ...messagePayload,
      threadId: ref.id,
    });

    return NextResponse.json({
      message: { id: ref.id, ...messagePayload, threadId: ref.id },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating message:', error.message || error);
    return createErrorResponse('Internal server error', 500);
  }
}
