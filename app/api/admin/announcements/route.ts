import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCsrf } from '@/lib/csrf';
import { logAuditAction } from '@/lib/audit-logger';

export async function POST(request: NextRequest) {
  const tokenVerification = await requireApprovedUser(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;
  const adminId = decoded.uid;

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const adminDoc = await adminDb.collection('users').doc(adminId).get();
    const adminData = adminDoc.data();
    if (!adminData || (adminData.role ?? '') !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

    const adminName = adminData.fullName || adminData.name || 'Admin';

    const body = await request.json();
    const { title, content, severity = 'info' } = body;

    if (!title || !content) {
      return createErrorResponse('Missing required fields: title, content', 400);
    }

    const now = new Date();

    // 1. Create the announcement record
    const announcementRef = await adminDb.collection('announcements').add({
      title,
      content,
      severity, // 'info' | 'warning' | 'success' | 'event'
      createdBy: adminName,
      createdAt: now,
    });

    // 2. Query all resident users
    const residentsSnapshot = await adminDb
      .collection('users')
      .where('role', '==', 'resident')
      .get();

    // 3. Batch write notifications to all residents
    let batch = adminDb.batch();
    let count = 0;

    for (const resDoc of residentsSnapshot.docs) {
      const notificationRef = adminDb.collection('notifications').doc();
      batch.set(notificationRef, {
        userId: resDoc.id,
        title: '📢 New Announcement',
        message: `Admin posted: "${title}"`,
        type: severity === 'warning' ? 'warning' : 'info',
        read: false,
        createdAt: now,
      });

      count++;
      if (count === 500) {
        await batch.commit();
        batch = adminDb.batch();
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    await logAuditAction(
      adminId,
      adminName,
      'Create Announcement',
      `Posted a new ${severity} announcement: "${title}"`,
      announcementRef.id
    );

    return NextResponse.json({
      success: true,
      message: 'Announcement posted successfully',
      announcementId: announcementRef.id,
    });

  } catch (error: any) {
    console.error('Error posting announcement:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
