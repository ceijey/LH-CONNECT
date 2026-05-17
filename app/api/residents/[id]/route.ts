import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { verifyCsrf } from '@/lib/csrf';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { sendDueBillEmail } from '@/lib/mailer';
import { sendDueBillSMS } from '@/lib/sms';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const userId = tokenVerification.decoded!.uid;

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

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

    return NextResponse.json({ id, ...residentData });
  } catch (error: any) {
    console.error('Error fetching resident:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Get the resident's current data before update
    const residentDoc = await adminDb.collection('users').doc(id).get();
    const currentData = residentDoc.data();
    const previousBalance = currentData?.balance ?? 0;

    const body = await request.json();
    const updatePayload: any = {};

    // Only allow updating certain fields
    const allowedFields = ['fullName', 'phone', 'phase', 'block', 'lot', 'status', 'balance', 'approvalStatus'];
    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updatePayload[field] = body[field];
      }
    });

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
      } catch (notifyErr) {
        console.error('Failed to update registration notifications:', notifyErr);
      }
    }

    // Create notification and send email if balance is being set
    if (updatePayload.balance !== undefined && updatePayload.balance > 0) {
      const now = new Date();
      const currentMonth = now.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      const currentMonthName = now.toLocaleString(undefined, { month: 'long' });
      const currentYear = now.getFullYear();
      
      // Automation: Create or Update Statement record
      try {
        const statementsRef = adminDb.collection('statements');
        const existingStmtQuery = await statementsRef
          .where('residentId', '==', id)
          .where('month', '==', currentMonthName)
          .where('year', '==', currentYear)
          .limit(1)
          .get();

        if (existingStmtQuery.empty) {
          console.log(`[Automation] Creating new statement for ${id} - ${currentMonth}`);
          await statementsRef.add({
            residentId: id,
            month: currentMonthName,
            year: currentYear,
            date: now.toISOString().split('T')[0],
            totalDues: updatePayload.balance,
            amountPaid: 0,
            balance: updatePayload.balance,
            status: 'Pending',
            createdAt: now.toISOString(),
            fileFormat: 'PDF'
          });
        } else {
          console.log(`[Automation] Updating existing statement for ${id} - ${currentMonth}`);
          const stmtDoc = existingStmtQuery.docs[0];
          await statementsRef.doc(stmtDoc.id).update({
            totalDues: updatePayload.balance,
            balance: updatePayload.balance,
            updatedAt: now.toISOString()
          });
        }
      } catch (stmtErr: any) {
        console.error('[Automation] Failed to sync statement:', stmtErr.message);
      }

      const notification = {
        userId: id,
        type: 'due-bill',
        title: 'Monthly Bill Due',
        message: `You have a pending bill of ₱${updatePayload.balance.toFixed(2)} due this month (${currentMonth}). Please submit your payment.`,
        dueAmount: updatePayload.balance,
        dueMonth: currentMonth,
        read: false,
        createdAt: new Date(),
      };

      await adminDb.collection('notifications').add(notification as any);

      // Send email + SMS notifications to resident (non-blocking)
      try {
        const authUser = await adminAuth.getUser(id);
        const residentEmail = authUser.email;
        const residentPhone = currentData?.phone as string | undefined;
        const residentName = currentData?.fullName || authUser.displayName || 'Resident';

        // Send email
        if (residentEmail) {
          sendDueBillEmail({
            toEmail: residentEmail,
            residentName,
            dueAmount: updatePayload.balance,
            dueMonth: currentMonth,
          }).catch((emailErr) => {
            console.error('[Mailer] Failed to send due-bill email:', emailErr.message);
          });
        }

        // Send SMS
        if (residentPhone) {
          sendDueBillSMS({
            toPhone: residentPhone,
            residentName,
            dueAmount: updatePayload.balance,
            dueMonth: currentMonth,
          }).catch((smsErr) => {
            console.error('[SMS] Failed to send due-bill SMS:', smsErr.message);
          });
        } else {
          console.warn('[SMS] Resident has no phone number stored, skipping SMS.');
        }
      } catch (authErr: any) {
        console.error('[Notifications] Could not fetch resident data:', authErr.message);
      }
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

  const userId = tokenVerification.decoded!.uid;

  try {
    const adminDoc = await adminDb.collection('users').doc(userId).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

    // 1. Delete from Firebase Auth
    try {
      await adminAuth.deleteUser(id);
    } catch (authError: any) {
      console.warn('User not found in Auth or failed to delete Auth account:', authError.message);
      // Continue to delete Firestore record anyway if it exists
    }

    // 2. Delete from Firestore
    await adminDb.collection('users').doc(id).delete();

    return NextResponse.json({ message: 'Resident deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting resident:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
