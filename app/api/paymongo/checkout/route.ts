import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCsrf } from '@/lib/csrf';
import { createPayMongoCheckoutSession, hasPayMongoConfig } from '@/lib/paymongo';
import { getMonthlySubmissionId, getMonthlySubmissionMonth } from '@/lib/payment-submission';
import { statementTime } from '@/lib/payment-allocation';

function getAppBaseUrl(request: NextRequest) {
  // Return to the same host where the resident started checkout so the
  // existing resident session cookie remains available after PayMongo.
  return new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  const tokenVerification = await requireApprovedUser(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

  if (!hasPayMongoConfig()) {
    return createErrorResponse('PayMongo is not configured. Set PAYMONGO_SECRET_KEY in your environment.', 500);
  }

  const decoded = tokenVerification.decoded!;
  const userId = decoded.uid;

  try {
    const userData = (tokenVerification as any).userData;

    if (!userData) {
      return createErrorResponse('User not found', 404);
    }

    const body = await request.json();
    const residentName = String(body.residentName ?? '').trim();
    const blockLot = String(body.blockLot ?? '').trim();
    const notes = String(body.notes ?? '').trim();
    const paymentDateTime = String(body.paymentDateTime ?? '').trim();
    const paymentAmount = Number(body.amount ?? body.paymentAmount ?? body.receiptAmount ?? 0);

    if (!residentName) {
      return createErrorResponse('Resident name is required', 400);
    }

    if (!blockLot) {
      return createErrorResponse('Block/Lot information is required', 400);
    }

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return createErrorResponse('Payment amount is required', 400);
    }

    const now = new Date();
    const currentMonth = getMonthlySubmissionMonth(now);
    const statementSnapshot = await adminDb.collection('statements').where('residentId', '==', userId).get();
    const oldestUnpaid = statementSnapshot.docs
      .map((statement: { data: () => Record<string, unknown> }) => ({ data: statement.data(), time: statementTime(statement.data()) }))
      .filter(({ data, time }: { data: Record<string, unknown>; time: number }) =>
        time <= new Date(now.getFullYear(), now.getMonth(), 1).getTime() &&
        (Number(data.balance ?? 0) > 0 || String(data.status ?? '').toLowerCase() !== 'paid')
      )
      .sort((a: { time: number }, b: { time: number }) => a.time - b.time)[0];
    const targetDate = oldestUnpaid ? new Date(oldestUnpaid.time) : now;
    const targetMonth = oldestUnpaid
      ? `${targetDate.toLocaleString(undefined, { month: 'long' })} ${targetDate.getFullYear()}`
      : currentMonth;
    const baseSubmissionId = getMonthlySubmissionId(userId, targetDate);
    const baseSubmissionRef = adminDb.collection('payment_submissions').doc(baseSubmissionId);
    const baseSubmission = await baseSubmissionRef.get();
    const submissionId = baseSubmission.exists && baseSubmission.data()?.status === 'Pending'
      ? baseSubmissionId
      : baseSubmission.exists
        ? `${baseSubmissionId}-${Date.now()}`
        : baseSubmissionId;
    const submissionRef = adminDb.collection('payment_submissions').doc(submissionId);

    // Check for any existing submission for this resident and month, including legacy documents.
    const existingMonthSubmissionQuery = await adminDb
      .collection('payment_submissions')
      .where('residentId', '==', userId)
      .where('month', '==', targetMonth)
      .get();

    if (existingMonthSubmissionQuery.docs.some((doc: { data: () => Record<string, unknown> }) => doc.data().status === 'Pending')) {
      return createErrorResponse(`You already have a pending payment for ${targetMonth}. Please wait for verification before submitting another payment.`, 400);
    }

    const referenceNumber = `PAYMONGO-${now.getTime()}`;

    const submissionData = {
      residentId: userId,
      residentName,
      blockLot,
      paymentAmount,
      paymentMethod: 'PayMongo',
      referenceNumber,
      notes: notes || 'PayMongo checkout initiated by resident',
      status: 'Pending' as const,
      month: targetMonth,
      submittedDate: now.toLocaleString(),
      submittedAt: now,
      updatedAt: now,
      paymentDateTime: paymentDateTime || now.toISOString(),
      receiptAmount: paymentAmount.toFixed(2),
      paymongoStatus: 'initiated',
      paymongoCheckoutSessionId: null,
      paymongoCheckoutUrl: null,
      paymongoEventType: null,
    };

    try {
      await submissionRef.create(submissionData);
    } catch (createError: any) {
      if (createError?.code === 6 || String(createError?.message || '').includes('already exists')) {
        return createErrorResponse(`You have already submitted a payment for ${currentMonth}. You cannot submit multiple payments for the same month.`, 400);
      }

      throw createError;
    }

    try {
      const baseUrl = getAppBaseUrl(request);
      const checkoutSession = await createPayMongoCheckoutSession({
        amount: paymentAmount,
        description: `Monthly HOA dues for ${residentName}`,
        successUrl: `${baseUrl}/dashboard`,
        cancelUrl: `${baseUrl}/dashboard`,
        metadata: {
          submissionId: submissionRef.id,
          residentId: userId,
          residentName,
          blockLot,
          referenceNumber,
          month: targetMonth,
          paymentMethod: 'PayMongo',
        },
      });

      await submissionRef.update({
        paymongoCheckoutSessionId: checkoutSession.sessionId,
        paymongoCheckoutUrl: checkoutSession.checkoutUrl,
        paymongoStatus: 'pending',
        updatedAt: new Date(),
      });

      return NextResponse.json({
        checkoutUrl: checkoutSession.checkoutUrl,
        sessionId: checkoutSession.sessionId,
        submission: {
          id: submissionRef.id,
          ...submissionData,
          paymongoCheckoutSessionId: checkoutSession.sessionId,
          paymongoCheckoutUrl: checkoutSession.checkoutUrl,
          paymongoStatus: 'pending',
        },
      });
    } catch (checkoutError: any) {
      await submissionRef.delete().catch(() => undefined);
      throw checkoutError;
    }
  } catch (error: any) {
    console.error('[PayMongo Checkout] Failed to create checkout session:', error?.message ?? error);
    return createErrorResponse(error?.message ?? 'Failed to create PayMongo checkout session', 500);
  }
}
