import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { sendPaymentStatusEmail } from '@/lib/mailer';
import { verifyCsrf } from '@/lib/csrf';
import { logAuditAction } from '@/lib/audit-logger';
import { allocatePaymentAcrossDues } from '@/lib/payment-allocation';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenVerification = await requireApprovedUser(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;
  const userId = decoded.uid;

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    if (!userData) return createErrorResponse('User not found', 404);

    if ((userData.role ?? '') !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }
    const adminName = userData.fullName || userData.name || 'Admin';

    const body = await request.json();
    const { status, rejectionReason } = body as { status?: string; rejectionReason?: string };
    if (!status || !['Verified', 'Pending', 'Rejected'].includes(status)) {
      return createErrorResponse('Invalid status', 400);
    }

    const docRef = adminDb.collection('payment_submissions').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return createErrorResponse('Submission not found', 404);

    const submissionData = doc.data()!;
    const residentId = submissionData.residentId;
    const paymentAmount = Number(submissionData.paymentAmount ?? 0);
    const month = submissionData.month || 'Current';
    const residentName = submissionData.residentName || 'Resident';
    let appliedMonthForMessage = month;

    if (status === 'Verified' && submissionData.status === 'Verified') {
      return NextResponse.json({ submission: { id, ...submissionData }, alreadyVerified: true });
    }

    let residentEmail: string | undefined;
    if (residentId) {
      try {
        const authUser = await adminAuth.getUser(residentId);
        residentEmail = authUser.email ?? undefined;
      } catch (emailLookupErr: any) {
        console.warn('[PaymentSubmission] Could not fetch auth user email:', emailLookupErr?.message ?? emailLookupErr);
      }

      if (!residentEmail) {
        const residentDoc = await adminDb.collection('users').doc(residentId).get();
        residentEmail = residentDoc.data()?.email;
      }
    }

    const now = new Date();
    const updatePayload: any = { 
      status, 
      updatedAt: now 
    };

    if (status === 'Verified') {
      updatePayload.verifiedAt = now;
      updatePayload.verifiedDate = now.toLocaleString();
      updatePayload.rejectionReason = null; // Clear any previous reason

      if (residentId) {
        const allocation = await allocatePaymentAcrossDues(residentId, paymentAmount, now);
        const allocatedDueMonths = allocation.allocations.map((entry) => `${entry.month} ${entry.year}`);
        updatePayload.appliedToMonths = allocatedDueMonths;
        appliedMonthForMessage = allocation.primaryDueMonthLabel;
        updatePayload.month = appliedMonthForMessage;

        const existingPaymentBySubmission = await adminDb
          .collection('payments')
          .where('submissionId', '==', id)
          .limit(1)
          .get();

        if (existingPaymentBySubmission.empty) {
          await adminDb.collection('payments').add({
            residentId,
            residentName,
            amount: paymentAmount,
            type: 'Payment',
            description: `Monthly Dues - ${allocation.primaryDueMonthLabel}`,
            paymentMethod: submissionData.paymentMethod,
            referenceNumber: submissionData.referenceNumber,
            fileUrl: submissionData.fileUrl || null,
            status: 'Paid',
            createdAt: now,
            date: now.toLocaleDateString(),
            submissionId: id,
            allocatedDueMonths,
            source: 'submission-approval',
          });
        }
      }
    } else if (status === 'Rejected') {
      updatePayload.verifiedAt = now; // Store rejection time too
      updatePayload.verifiedDate = now.toLocaleString();
      updatePayload.rejectionReason = rejectionReason || 'No reason provided';
    }

    await docRef.update(updatePayload);

    // Create a notification for the resident
    if (residentId) {
      const notificationMessage = status === 'Verified' 
        ? `Your payment of ₱${paymentAmount} has been approved for ${appliedMonthForMessage}.` 
        : `Your payment of ₱${paymentAmount} was rejected. Reason: ${rejectionReason || 'No reason provided'}`;

      await adminDb.collection('notifications').add({
        userId: residentId,
        title: `Payment ${status}`,
        message: notificationMessage,
        type: status === 'Verified' ? 'success' : 'error',
        read: false,
        createdAt: now,
        submissionId: id
      });

      if (residentEmail && (status === 'Verified' || status === 'Rejected')) {
        try {
          await sendPaymentStatusEmail({
            toEmail: residentEmail,
            residentName,
            amount: paymentAmount,
            month: appliedMonthForMessage,
            status,
            rejectionReason: status === 'Rejected' ? (rejectionReason || 'No reason provided') : undefined,
          });
        } catch (emailErr: any) {
          console.error('[PaymentSubmission] Failed to send payment status email:', emailErr?.message ?? emailErr);
        }
      }
    }
    
    await logAuditAction(
      userId,
      adminName,
      status === 'Verified' ? 'Verify Payment' : (status === 'Rejected' ? 'Reject Payment' : 'Verify Payment'),
      `${status} payment of ₱${paymentAmount} from ${residentName}`,
      id
    );

    const updated = (await docRef.get()).data();
    return NextResponse.json({ submission: { id, ...updated } });
  } catch (error: any) {
    console.error('Error updating submission status:', error?.message ?? error);
    return createErrorResponse('Internal server error', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenVerification = await requireApprovedUser(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const userId = tokenVerification.decoded!.uid;

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    if (!userDoc.exists || userData?.role !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }
    const adminName = userData?.fullName || userData?.name || 'Admin';

    const docRef = adminDb.collection('payment_submissions').doc(id);
    const docData = (await docRef.get()).data();

    await docRef.delete();

    await logAuditAction(
      userId,
      adminName,
      'Delete Submission',
      `Deleted payment submission from ${docData?.residentName || 'Unknown'} for ₱${docData?.paymentAmount || 0}`,
      id
    );

    return NextResponse.json({ message: 'Submission deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting submission:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
