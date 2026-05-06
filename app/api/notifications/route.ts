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
    const notificationsSnapshot = await adminDb
      .collection('notifications')
      .where('userId', '==', userId)
      .get();

    const notifications = notificationsSnapshot.docs
      .map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now());
        return {
          id: doc.id,
          ...data,
          createdAt: createdAt.toISOString(),
          _sortTime: createdAt.getTime()
        };
      })
      .sort((a: any, b: any) => b._sortTime - a._sortTime)
      .slice(0, 20);

    return NextResponse.json({ notifications });
  } catch (error: any) {
    console.error('Error fetching notifications:', error.message);
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
    const body = await request.json();
    const { notificationId, read } = body;

    if (!notificationId) {
      return createErrorResponse('Notification ID is required', 400);
    }

    const notificationRef = adminDb.collection('notifications').doc(notificationId);
    const doc = await notificationRef.get();

    if (!doc.exists) {
      return createErrorResponse('Notification not found', 404);
    }

    if (doc.data()?.userId !== userId) {
      return createErrorResponse('Forbidden', 403);
    }

    await notificationRef.update({ read: !!read });

    return NextResponse.json({ message: 'Notification updated successfully' });
  } catch (error: any) {
    console.error('Error updating notification:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
