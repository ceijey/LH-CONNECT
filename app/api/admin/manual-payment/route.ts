import { NextRequest, NextResponse } from 'next/server';
import { type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';
import { sendPaymentVerifiedEmail } from '@/lib/mailer';
import { verifyCsrf } from '@/lib/csrf';
import { logAuditAction } from '@/lib/audit-logger';
import {
  allocatePaymentToSelectedStatements,
  allocatePaymentToStatements,
  type SelectedStatementMonth,
} from '@/lib/payment-allocation';
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
    const {
      residentId,
      paymentAmount,
      paymentMethod = 'Cash',
      month,
      selectedMonths,
      notes,
      orNumber,
    } = body;

    if (!residentId || paymentAmount === undefined || paymentAmount === null || (!month && !Array.isArray(selectedMonths)) || !orNumber?.trim()) {
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

    let normalizedSelectedMonths: SelectedStatementMonth[] = [];
    if (Array.isArray(selectedMonths)) {
      try {
        normalizedSelectedMonths = selectedMonths.map((entry: unknown) => {
          if (!entry || typeof entry !== 'object') {
            throw new Error('Each selected month must include a month and year');
          }
          const candidate = entry as { month?: unknown; year?: unknown };
          const normalizedMonth = String(candidate.month ?? '').trim();
          const normalizedYear = Number(candidate.year);
          const parsedMonth = new Date(`${normalizedMonth} 1, 2020`).getMonth();
          if (!/^[A-Za-z]+$/.test(normalizedMonth) || Number.isNaN(parsedMonth) || !Number.isInteger(normalizedYear) || normalizedYear < 2000 || normalizedYear > 2100) {
            throw new Error('Each selected month must include a valid month and year');
          }
          return {
            month: normalizedMonth.charAt(0).toUpperCase() + normalizedMonth.slice(1).toLowerCase(),
            year: normalizedYear,
          };
        });
      } catch (error) {
        return createErrorResponse(error instanceof Error ? error.message : 'Selected months are invalid', 400);
      }
    }

    if (normalizedSelectedMonths.length > 0) {
      if (normalizedSelectedMonths.length > 12) {
        return createErrorResponse('You can select up to 12 billing months per payment.', 400);
      }
      const uniqueMonths = new Set(normalizedSelectedMonths.map((entry) => `${entry.year}-${entry.month.toLowerCase()}`));
      if (uniqueMonths.size !== normalizedSelectedMonths.length) {
        return createErrorResponse('The same billing month cannot be selected more than once.', 400);
      }
      if (amount !== normalizedSelectedMonths.length * 400) {
        return createErrorResponse(`Payment amount must be exactly ₱${normalizedSelectedMonths.length * 400} for the selected month${normalizedSelectedMonths.length === 1 ? '' : 's'}.`, 400);
      }
    } else if (Array.isArray(selectedMonths) && !month) {
      return createErrorResponse('At least one billing month is required.', 400);
    }

    const paymentMonthLabel = normalizedSelectedMonths.length > 0
      ? normalizedSelectedMonths.map((entry) => `${entry.month} ${entry.year}`).join(', ')
      : String(month);

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
      if (normalizedSelectedMonths.length > 0) {
        await allocatePaymentToSelectedStatements(
          transaction,
          adminDb.collection('statements'),
          residentId,
          amount,
          normalizedSelectedMonths,
        );
      } else {
        await allocatePaymentToStatements(
          transaction,
          adminDb.collection('statements'),
          residentId,
          amount,
          freshResident.data()?.createdAt,
        );
      }
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
        month: paymentMonthLabel,
        selectedMonths: normalizedSelectedMonths,
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
        description: `Manual Payment - ${paymentMonthLabel}`,
        paymentMethod,
        referenceNumber: normalizedOrNumber,
        status: 'Paid',
        createdAt: now,
        date: now.toLocaleDateString(),
      });

      transaction.create(notificationRef, {
        userId: residentId,
        title: 'Payment Received',
        message: `Your cash payment of ₱${amount.toLocaleString()} for ${paymentMonthLabel} has been recorded by the admin.`,
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
          month: paymentMonthLabel
        });
      } catch (emailErr: any) {
        console.error('[ManualPayment] Failed to send email:', emailErr.message);
      }
    }

    await logAuditAction(
      adminId,
      adminName,
      'Manual Payment',
      `Recorded manual ${paymentMethod} payment of ₱${amount} for ${residentName} (${paymentMonthLabel})`,
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
