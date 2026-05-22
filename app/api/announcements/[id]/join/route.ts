import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCsrf } from '@/lib/csrf';

// GET: Fetch attendance list or joined status
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: announcementId } = await params;
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error || !tokenVerification.decoded) {
    return createErrorResponse(tokenVerification.error ?? 'Unauthorized', tokenVerification.status ?? 401);
  }

  const userId = tokenVerification.decoded.uid;

  try {
    // 1. Fetch user data to check if admin
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};
    const isAdmin = userData.role === 'admin';

    // 2. Query all RSVPs for this announcement
    const attendanceSnapshot = await adminDb
      .collection('event_attendance')
      .where('announcementId', '==', announcementId)
      .get();

    const attendees = attendanceSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      const joinedAt = data.joinedAt?.toDate ? data.joinedAt.toDate() : new Date(data.joinedAt || Date.now());
      return {
        id: doc.id,
        ...data,
        joinedAt: joinedAt.toISOString(),
      };
    });

    const hasJoined = attendees.some((att: any) => att.userId === userId);

    // If admin, return the full list of attendees. If resident, only return their status and count.
    if (isAdmin) {
      return NextResponse.json({
        hasJoined,
        count: attendees.length,
        attendees,
      });
    } else {
      return NextResponse.json({
        hasJoined,
        count: attendees.length,
        // Residents can also see a safe/clean list of attendee names
        attendees: attendees.map((a: any) => ({
          userId: a.userId,
          userName: a.userName,
          phase: a.phase,
          block: a.block,
          lot: a.lot,
          joinedAt: a.joinedAt,
        })),
      });
    }
  } catch (error: any) {
    console.error('Error fetching event attendance:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}

// POST: Join event
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: announcementId } = await params;
  const tokenVerification = await requireApprovedUser(request);

  if (tokenVerification.error || !tokenVerification.decoded) {
    return createErrorResponse(tokenVerification.error ?? 'Unauthorized', tokenVerification.status ?? 401);
  }

  const userId = tokenVerification.decoded.uid;

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    // 1. Verify the announcement exists and is an event
    const announcementDoc = await adminDb.collection('announcements').doc(announcementId).get();
    if (!announcementDoc.exists) {
      return createErrorResponse('Announcement not found', 404);
    }

    const annData = announcementDoc.data()!;
    if (annData.severity !== 'event') {
      return createErrorResponse('This announcement is not an event and cannot be joined.', 400);
    }

    // 2. Check if already joined
    const existingSnapshot = await adminDb
      .collection('event_attendance')
      .where('announcementId', '==', announcementId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      return NextResponse.json({ success: true, message: 'Already joined' });
    }

    // 3. Fetch resident's detailed profile
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return createErrorResponse('User profile not found', 404);
    }

    const profile = userDoc.data()!;

    // 4. Save attendance
    await adminDb.collection('event_attendance').add({
      announcementId,
      eventTitle: annData.title,
      userId,
      userName: profile.fullName || profile.name || 'Resident',
      email: profile.email || '',
      phase: profile.phase || 'Lincoln Heights',
      block: profile.block || '',
      lot: profile.lot || '',
      joinedAt: new Date(),
    });

    // 5. Notify admin that a resident RSVP'd to the event
    const residentName = profile.fullName || profile.name || 'A resident';
    const location = [
      profile.phase ? `Phase ${profile.phase}` : null,
      profile.block ? `Block ${profile.block}` : null,
      profile.lot ? `Lot ${profile.lot}` : null,
    ].filter(Boolean).join(', ');

    await adminDb.collection('admin_notifications').add({
      type: 'event_rsvp',
      title: '📅 Event RSVP',
      message: `${residentName}${location ? ` (${location})` : ''} confirmed attendance to "${annData.title}".`,
      residentId: userId,
      residentName,
      announcementId,
      eventTitle: annData.title,
      read: false,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully joined meeting / event.',
    });
  } catch (error: any) {
    console.error('Error joining event:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}

// DELETE: Leave event
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: announcementId } = await params;
  const tokenVerification = await requireApprovedUser(request);

  if (tokenVerification.error || !tokenVerification.decoded) {
    return createErrorResponse(tokenVerification.error ?? 'Unauthorized', tokenVerification.status ?? 401);
  }

  const userId = tokenVerification.decoded.uid;

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const existingSnapshot = await adminDb
      .collection('event_attendance')
      .where('announcementId', '==', announcementId)
      .where('userId', '==', userId)
      .get();

    if (existingSnapshot.empty) {
      return NextResponse.json({ success: true, message: 'Not attending' });
    }

    const batch = adminDb.batch();
    existingSnapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    return NextResponse.json({
      success: true,
      message: 'Successfully cancelled attendance.',
    });
  } catch (error: any) {
    console.error('Error leaving event:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
