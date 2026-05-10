import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

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

    const notificationsSnapshot = await adminDb
      .collection('admin_notifications')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const notifications = notificationsSnapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now());
      return {
        id: doc.id,
        ...data,
        createdAt: createdAt.toISOString(),
      };
    });

    return NextResponse.json({ notifications });
  } catch (error: any) {
    console.error('Error fetching admin notifications:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}

export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { notificationId, readAll } = body;

    if (readAll) {
      const unreadSnapshot = await adminDb
        .collection('admin_notifications')
        .where('read', '==', false)
        .get();
      
      const batch = adminDb.batch();
      unreadSnapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
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
      snapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
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
