import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { verifyCsrf } from '@/lib/csrf';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { sendAccountStatusEmail } from '@/lib/mailer';
import { logAuditAction } from '@/lib/audit-logger';
import { decrypt, encrypt } from '@/lib/encryption';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const userId = tokenVerification.decoded!.uid;

  try {
    const adminDoc = await adminDb.collection('users').doc(userId).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

    const residentDoc = await adminDb.collection('users').doc(id).get();
    if (!residentDoc.exists) {
      return createErrorResponse('Resident not found', 404);
    }

    const residentData = residentDoc.data();
    if (residentData?.role !== 'resident') {
      return createErrorResponse('User is not a resident', 400);
    }

    const phone = residentData?.phoneEncrypted
      ? decrypt(String(residentData.phoneEncrypted))
      : residentData?.phone;
    return NextResponse.json({ id, ...residentData, phone: phone ?? undefined });
  } catch (error: any) {
    console.error('Error fetching resident:', error.message);
    return NextResponse.json({ id, error: 'Temporarily unavailable' });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

  const userId = tokenVerification.decoded!.uid;

  try {
    const adminDoc = await adminDb.collection('users').doc(userId).get();
    const adminData = adminDoc.data();
    if (!adminDoc.exists || adminData?.role !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }
    const adminName = adminData.fullName || adminData.name || 'Admin';

    // Get the resident's current data before update
    const residentDoc = await adminDb.collection('users').doc(id).get();
    const currentData = residentDoc.data();
    const body = await request.json();
    const updatePayload: any = {};

    // Only allow updating certain fields
    const allowedFields = ['fullName', 'phone', 'phase', 'block', 'lot', 'status', 'approvalStatus'];
    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updatePayload[field] = body[field];
      }
    });

    if (typeof updatePayload.phone === 'string') {
      const phone = updatePayload.phone.trim();
      updatePayload.phoneEncrypted = phone ? encrypt(phone) : null;
      updatePayload.phoneMasked = phone ? `****${phone.replace(/\D/g, '').slice(-4)}` : null;
      delete updatePayload.phone;
    }

    if (Object.keys(updatePayload).length === 0) {
      return createErrorResponse('No valid fields to update', 400);
    }

    updatePayload.updatedAt = new Date().toISOString();

    await adminDb.collection('users').doc(id).update(updatePayload);

    // If approvalStatus is changed, mark corresponding registration notification as read
    if (updatePayload.approvalStatus) {
      try {
        const notificationsSnapshot = await adminDb
          .collection('admin_notifications')
          .where('residentId', '==', id)
          .where('type', '==', 'resident_registration')
          .where('read', '==', false)
          .get();
        
        const batch = adminDb.batch();
        notificationsSnapshot.docs.forEach((doc: any) => {
          batch.update(doc.ref, { read: true });
        });
        await batch.commit();

        // Create a new notification for the action taken
        if (updatePayload.approvalStatus === 'Approved' || updatePayload.approvalStatus === 'Rejected') {
          try {
            await adminDb.collection('admin_notifications').add({
              type: 'resident_action',
              title: `Resident ${updatePayload.approvalStatus}`,
              message: `${currentData?.fullName || 'Resident'} has been ${updatePayload.approvalStatus.toLowerCase()}.`,
              residentId: id,
              residentName: currentData?.fullName || 'Resident',
              status: updatePayload.approvalStatus.toLowerCase(),
              read: true, // Mark as read since the admin just took this action
              createdAt: new Date(),
            });
          } catch (notifyErr) {
            console.error('Failed to create admin notification for action:', notifyErr);
          }
        }

        // Add audit log
        let auditAction: 'Approve Resident' | 'Decline Resident' | 'Pending Resident' = 'Pending Resident';
        if (updatePayload.approvalStatus === 'Approved') auditAction = 'Approve Resident';
        else if (updatePayload.approvalStatus === 'Rejected') auditAction = 'Decline Resident';
        
        await logAuditAction(
          userId, 
          adminName, 
          auditAction, 
          `Set resident ${currentData?.fullName || id} status to ${updatePayload.approvalStatus}`, 
          id
        );

        // Send approval/rejection email to resident
        try {
          const authUser = await adminAuth.getUser(id);
          const residentEmail = authUser.email;
          const residentName = currentData?.fullName || authUser.displayName || 'Resident';

          if (residentEmail && (updatePayload.approvalStatus === 'Approved' || updatePayload.approvalStatus === 'Rejected')) {
            await sendAccountStatusEmail({
              toEmail: residentEmail,
              residentName,
              status: updatePayload.approvalStatus,
            });
            console.log(`[Mailer] Account status email sent to ${residentEmail} for ${updatePayload.approvalStatus}`);
          } else {
            console.warn('[Mailer] Skipping account status email because resident email is missing or approvalStatus is invalid.');
          }
        } catch (emailErr: any) {
          console.error('[Mailer] Could not fetch auth user to send account status email:', emailErr?.message || emailErr);
        }

      } catch (notifyErr) {
        console.error('Failed to update registration notifications:', notifyErr);
      }
    } else {
      // General update audit log
      await logAuditAction(
        userId,
        adminName,
        'Update Resident Details',
        `Updated details for resident ${currentData?.fullName || id}`,
        id
      );
    }

    return NextResponse.json({ message: 'Resident updated successfully' });
  } catch (error: any) {
    console.error('Error updating resident:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

  const userId = tokenVerification.decoded!.uid;

  try {
    const adminDoc = await adminDb.collection('users').doc(userId).get();
    const adminData = adminDoc.data();
    if (!adminDoc.exists || adminData?.role !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }
    const adminName = adminData.fullName || adminData.name || 'Admin';

    // 1. Delete from Firebase Auth
    try {
      await adminAuth.deleteUser(id);
    } catch (authError: any) {
      console.warn('User not found in Auth or failed to delete Auth account:', authError.message);
      // Continue to delete Firestore record anyway if it exists
    }

    // 2. Delete from Firestore
    await adminDb.collection('users').doc(id).delete();

    // 3. Audit Log
    await logAuditAction(
      userId,
      adminName,
      'Delete Resident',
      `Deleted resident account ${id}`,
      id
    );

    return NextResponse.json({ message: 'Resident deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting resident:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
