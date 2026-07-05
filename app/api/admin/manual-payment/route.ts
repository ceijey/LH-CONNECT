import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';
import { sendPaymentVerifiedEmail } from '@/lib/mailer';
import { verifyCsrf } from '@/lib/csrf';
import { logAuditAction } from '@/lib/audit-logger';
import { allocatePaymentAcrossDues } from '@/lib/payment-allocation';

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
    const { residentId, paymentAmount, paymentMethod = 'Cash', month, notes } = body;

    if (!residentId || !paymentAmount || !month) {
      return createErrorResponse('Missing required fields: residentId, paymentAmount, month', 400);
    }

    const residentRef = adminDb.collection('users').doc(residentId);
    const residentDoc = await residentRef.get();
    if (!residentDoc.exists) {
      return createErrorResponse('Resident not found', 404);
    }

    const residentData = residentDoc.data()!;
    const residentName = residentData.fullName || residentData.name || 'Resident';
    const residentEmail = residentData.email;
    const blockLot = `Phase ${residentData.phase || ''} Blk ${residentData.block || ''} Lot ${residentData.lot || ''}`.trim();

    const now = new Date();
    const amount = Number(paymentAmount);
    const referenceNumber = `CASH-${Date.now()}`;

    // 1. Create payment_submissions record (Status: Verified)
    const submissionRef = await adminDb.collection('payment_submissions').add({
      residentId,
      residentName,
      blockLot,
      paymentAmount: amount,
      paymentMethod,
      referenceNumber,
      notes: notes || 'Manual cash payment recorded by admin',
      status: 'Verified',
      month,
      submittedDate: now.toLocaleString(),
      submittedAt: now,
      verifiedDate: now.toLocaleString(),
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Allocate payment to oldest unpaid dues, then next dues for advance payments.
    const allocation = await allocatePaymentAcrossDues(residentId, amount, now);
    const allocatedDueMonths = allocation.allocations.map((entry) => `${entry.month} ${entry.year}`);

    await adminDb.collection('payment_submissions').doc(submissionRef.id).update({
      month: allocation.primaryDueMonthLabel,
      appliedToMonths: allocatedDueMonths,
      updatedAt: now,
    });

    // 3. Create official payment record
    await adminDb.collection('payments').add({
      residentId,
      residentName,
      amount: amount,
      type: 'Payment',
      description: `Manual Payment - ${allocation.primaryDueMonthLabel}`,
      paymentMethod,
      referenceNumber,
      status: 'Paid',
      createdAt: now,
      date: now.toLocaleDateString(),
      submissionId: submissionRef.id,
      allocatedDueMonths,
      source: 'manual-payment',
    });

    // 4. Notify resident
    await adminDb.collection('notifications').add({
      userId: residentId,
      title: 'Payment Received',
      message: `Your cash payment of ₱${amount.toLocaleString()} has been recorded for ${allocation.primaryDueMonthLabel}.`,
      type: 'success',
      read: false,
      createdAt: now,
      submissionId: submissionRef.id
    });

    // 5. Send Email if possible
    if (residentEmail) {
      try {
        await sendPaymentVerifiedEmail({
          toEmail: residentEmail,
          residentName,
          amount: amount,
          month: allocation.primaryDueMonthLabel
        });
      } catch (emailErr: any) {
        console.error('[ManualPayment] Failed to send email:', emailErr.message);
      }
    }

    await logAuditAction(
      adminId,
      adminName,
      'Manual Payment',
      `Recorded manual ${paymentMethod} payment of ₱${amount} for ${residentName} (${month})`,
      submissionRef.id
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Manual payment recorded successfully',
      submissionId: submissionRef.id
    });

  } catch (error: any) {
    console.error('Error recording manual payment:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
