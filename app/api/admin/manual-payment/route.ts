import { NextRequest, NextResponse } from 'next/server';
import { type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';
import { sendPaymentVerifiedEmail } from '@/lib/mailer';
import { verifyCsrf } from '@/lib/csrf';
import { logAuditAction } from '@/lib/audit-logger';
import { allocatePaymentToStatements } from '@/lib/payment-allocation';
import { validatePaymentAmount } from '@/lib/payment-validation';

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
    const { residentId, paymentAmount, paymentMethod = 'Cash', month, notes, orNumber } = body;

    if (!residentId || paymentAmount === undefined || paymentAmount === null || !month || !orNumber?.trim()) {
      return createErrorResponse('Missing required fields: residentId, paymentAmount, month, orNumber', 400);
    }
    if (!/^\d+$/.test(orNumber.trim())) {
      return createErrorResponse('OR number must contain numbers only', 400);
    }

    const residentRef = adminDb.collection('users').doc(residentId);
    const residentDoc = await residentRef.get();
    if (!residentDoc.exists) {
      return createErrorResponse('Resident not found', 404);
    }

    const residentData = residentDoc.data()!;
    if (residentData.role !== 'resident') {
      return createErrorResponse('Target user is not a resident', 400);
    }
    const residentName = residentData.fullName || residentData.name || 'Resident';
    const residentEmail = residentData.email;
    const blockLot = `Phase ${residentData.phase || ''} Blk ${residentData.block || ''} Lot ${residentData.lot || ''}`.trim();

    const now = new Date();
    const amount = Number(paymentAmount);
    const amountValidation = validatePaymentAmount(amount);
    if (!amountValidation.isValid) {
      return createErrorResponse(amountValidation.error ?? 'Payment amount is invalid', 400);
    }

    const normalizedOrNumber = orNumber.trim();
    const orNumberRef = adminDb.collection('payment_or_numbers').doc(normalizedOrNumber);
    const submissionRef = adminDb.collection('payment_submissions').doc();
    const paymentRef = adminDb.collection('payments').doc();
    const notificationRef = adminDb.collection('notifications').doc();

    await adminDb.runTransaction(async (transaction: Transaction) => {
      const orNumberDoc = await transaction.get(orNumberRef as DocumentReference);
      const duplicateSubmissionQuery = await transaction.get(
        adminDb.collection('payment_submissions')
          .where('referenceNumber', '==', normalizedOrNumber)
          .limit(1),
      );
      const duplicatePaymentQuery = await transaction.get(
        adminDb.collection('payments')
          .where('referenceNumber', '==', normalizedOrNumber)
          .limit(1),
      );
      const freshResident = await transaction.get(residentRef as DocumentReference);

      if (orNumberDoc.exists || !duplicateSubmissionQuery.empty || !duplicatePaymentQuery.empty) {
        const duplicateError = new Error('This OR number has already been used. Please enter a different OR number.');
        duplicateError.name = 'DuplicateOrNumberError';
        throw duplicateError;
      }

      if (!freshResident.exists) {
        throw new Error('Resident not found');
      }

      const currentBalance = Number(freshResident.data()?.balance ?? 0);
      await allocatePaymentToStatements(
        transaction,
        adminDb.collection('statements'),
        residentId,
        amount,
        freshResident.data()?.createdAt,
      );
      transaction.update(residentRef, {
        balance: Math.max(0, currentBalance - amount),
        updatedAt: now.toISOString(),
      });

      transaction.create(orNumberRef, {
        orNumber: normalizedOrNumber,
        residentId,
        submissionId: submissionRef.id,
        paymentId: paymentRef.id,
        createdAt: now,
      });

      transaction.create(submissionRef, {
        residentId,
        residentName,
        blockLot,
        paymentAmount: amount,
        paymentMethod,
        referenceNumber: normalizedOrNumber,
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

      transaction.create(paymentRef, {
        residentId,
        residentName,
        amount,
        type: 'Payment',
        description: `Manual Payment - ${month}`,
        paymentMethod,
        referenceNumber: normalizedOrNumber,
        status: 'Paid',
        createdAt: now,
        date: now.toLocaleDateString(),
      });

      transaction.create(notificationRef, {
        userId: residentId,
        title: 'Payment Received',
        message: `Your cash payment of ₱${amount.toLocaleString()} for ${month} has been recorded by the admin.`,
        type: 'success',
        read: false,
        createdAt: now,
        submissionId: submissionRef.id,
      });
    });

    // Send Email if possible
    if (residentEmail) {
      try {
        await sendPaymentVerifiedEmail({
          toEmail: residentEmail,
          residentName,
          amount: amount,
          month: month
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
    if (error?.name === 'DuplicateOrNumberError') {
      return createErrorResponse(error.message, 409);
    }
    console.error('Error recording manual payment:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
