import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  try {
    const announcementsSnapshot = await adminDb
      .collection('announcements')
      .orderBy('createdAt', 'desc')
      .get();

    const announcements = announcementsSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now());
      return {
        id: doc.id,
        ...data,
        createdAt: createdAt.toISOString(),
      };
    });

    let joinedEventIds: string[] = [];
    if (tokenVerification.decoded) {
      const userId = tokenVerification.decoded.uid;
      const userDoc = await adminDb.collection('users').doc(userId).get();
      const userData = userDoc.data() || {};

      // If user is resident, log views for the most recent announcements
      if (userData.role !== 'admin' && announcementsSnapshot.docs.length > 0) {
        try {
          const batch = adminDb.batch();
          const now = new Date();
          // Log views for up to 10 most recent announcements
          const limit = Math.min(announcementsSnapshot.docs.length, 10);
          for (let i = 0; i < limit; i++) {
            const doc = announcementsSnapshot.docs[i];
            const viewRef = doc.ref.collection('views').doc(userId);
            batch.set(viewRef, {
              userName: userData.fullName || userData.name || 'Resident',
              viewedAt: now
            }, { merge: true });
          }
          await batch.commit();
        } catch (err) {
          console.error('Failed to log announcement views:', err);
        }
      }

      const attendanceSnapshot = await adminDb
        .collection('event_attendance')
        .where('userId', '==', userId)
        .get();
      joinedEventIds = attendanceSnapshot.docs.map((doc: any) => doc.data().announcementId);
    }

    return NextResponse.json({ announcements, joinedEventIds });
  } catch (error: any) {
    console.error('Error fetching announcements:', error.message);
    const mockAnnouncements = [
      {
        id: 'mock-announcement-1',
        title: 'Monthly Homeowners Meeting',
        content: 'Please attend our monthly meeting this Saturday at the clubhouse.',
        severity: 'event',
        createdBy: 'Admin',
        createdAt: new Date().toISOString()
      },
      {
        id: 'mock-announcement-2',
        title: 'Water Interruption Notice',
        content: 'There will be a water interruption tomorrow from 8AM to 12PM due to pipe maintenance.',
        severity: 'warning',
        createdBy: 'Admin',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      }
    ];
    return NextResponse.json({ announcements: mockAnnouncements, joinedEventIds: [] });
  }
}
