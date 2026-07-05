import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCsrf } from '@/lib/csrf';
import { createPayMongoCheckoutSession, hasPayMongoConfig } from '@/lib/paymongo';

function getAppBaseUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
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

    if (paymentAmount > 400) {
      return createErrorResponse('Payment amount cannot exceed the monthly dues of ₱400.', 400);
    }

    const now = new Date();
    const currentMonth = now.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    const referenceNumber = `PAYMONGO-${now.getTime()}`;

    const existingPendingSnapshot = await adminDb
      .collection('payment_submissions')
      .where('residentId', '==', userId)
      .limit(30)
      .get();

    const existingPending = existingPendingSnapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
      .filter((submission: any) => (
        submission.status === 'Pending' &&
        submission.paymentMethod === 'PayMongo' &&
        Number(submission.paymentAmount ?? 0) === paymentAmount &&
        String(submission.month ?? '') === currentMonth &&
        ['initiated', 'pending'].includes(String(submission.paymongoStatus ?? '').toLowerCase()) &&
        Boolean(submission.paymongoCheckoutUrl)
      ))
      .sort((a: any, b: any) => {
        const aTime = a.submittedAt?.toDate?.()?.getTime?.() ?? new Date(a.submittedAt ?? 0).getTime() ?? 0;
        const bTime = b.submittedAt?.toDate?.()?.getTime?.() ?? new Date(b.submittedAt ?? 0).getTime() ?? 0;
        return bTime - aTime;
      })[0];

    if (existingPending) {
      return NextResponse.json({
        checkoutUrl: existingPending.paymongoCheckoutUrl,
        sessionId: existingPending.paymongoCheckoutSessionId,
        reused: true,
        submission: existingPending,
      });
    }

    const submissionRef = adminDb.collection('payment_submissions').doc();
    const submissionData = {
      residentId: userId,
      residentName,
      blockLot,
      paymentAmount,
      paymentMethod: 'PayMongo',
      referenceNumber,
      notes: notes || 'PayMongo checkout initiated by resident',
      status: 'Pending' as const,
      month: currentMonth,
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

    await submissionRef.set(submissionData);

    try {
      const baseUrl = getAppBaseUrl(request);
      const checkoutSession = await createPayMongoCheckoutSession({
        amount: paymentAmount,
        description: `Monthly HOA dues for ${residentName}`,
        successUrl: `${baseUrl}/dashboard/submit-payment?paymongo=success`,
        cancelUrl: `${baseUrl}/dashboard/submit-payment?paymongo=cancelled`,
        metadata: {
          submissionId: submissionRef.id,
          residentId: userId,
          residentName,
          blockLot,
          referenceNumber,
          month: currentMonth,
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
