import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { verifyCsrf } from '@/lib/csrf';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const userId = tokenVerification.decoded!.uid;

  try {
    // Verify admin role
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

    const url = new URL(request.url);
    const params = url.searchParams;
    const limitParam = Math.min(Number(params.get('limit') || '50'), 200);
    const before = params.get('before');

    let queryRef: FirebaseFirestore.Query = adminDb
      .collection('admin_notifications')
      .orderBy('createdAt', 'desc')
      .limit(limitParam);

    // If a `before` cursor (ISO date) is provided, fetch older notifications
    if (before) {
      const beforeDate = new Date(before);
      // For simpler pagination with descending order, use a where clause to get items older than `before`
      queryRef = adminDb
        .collection('admin_notifications')
        .where('createdAt', '<', beforeDate)
        .orderBy('createdAt', 'desc')
        .limit(limitParam);
    }

    const notificationsSnapshot = await queryRef.get();

    const notifications = notificationsSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now());
      return {
        id: doc.id,
        ...data,
        createdAt: createdAt.toISOString(),
      };
    });

    // Compute nextCursor: the createdAt of the last item (if there may be more)
    const nextCursor = notifications.length === limitParam
      ? notifications[notifications.length - 1].createdAt
      : null;

    return NextResponse.json({ notifications, nextCursor });
  } catch (error: any) {
    console.error('Error fetching admin notifications:', error.message);
    return NextResponse.json({ notifications: [], nextCursor: null });
  }
}

export async function PATCH(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const userId = tokenVerification.decoded!.uid;

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    // Verify admin role
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

    const body = await request.json();
    const { notificationId, readAll } = body;

    if (readAll) {
      const unreadSnapshot = await adminDb
        .collection('admin_notifications')
        .where('read', '==', false)
        .get();
      
      const batch = adminDb.batch();
      unreadSnapshot.docs.forEach((doc: any) => {
        batch.update(doc.ref, { read: true });
      });
      await batch.commit();
      return NextResponse.json({ message: 'All notifications marked as read' });
    }

    if (!notificationId) {
      return createErrorResponse('Notification ID is required', 400);
    }

    await adminDb.collection('admin_notifications').doc(notificationId).update({
      read: true,
    });

    return NextResponse.json({ message: 'Notification marked as read' });
  } catch (error: any) {
    console.error('Error updating admin notification:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}

export async function DELETE(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

  const userId = tokenVerification.decoded!.uid;

  try {
    // Verify admin role
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

    const body = await request.json();
    const { notificationId, clearAll } = body;

    if (clearAll) {
      const snapshot = await adminDb.collection('admin_notifications').get();
      const batch = adminDb.batch();
      snapshot.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      return NextResponse.json({ message: 'All notifications cleared' });
    }

    if (!notificationId) {
      return createErrorResponse('Notification ID is required', 400);
    }

    await adminDb.collection('admin_notifications').doc(notificationId).delete();

    return NextResponse.json({ message: 'Notification deleted' });
  } catch (error: any) {
    console.error('Error deleting admin notification:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
