import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { sendPaymentVerifiedEmail } from '@/lib/mailer';
import { allocatePaymentAcrossDues } from '@/lib/payment-allocation';

function toMillis(value: any) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : new Date(value).getTime() || 0;
}

function getEventType(payload: any) {
  return String(
    payload?.data?.attributes?.type ??
      payload?.type ??
      payload?.event ??
      payload?.data?.attributes?.event ??
      ''
  ).toLowerCase();
}

function getSubmissionId(payload: any) {
  return String(
    payload?.data?.attributes?.metadata?.submissionId ??
      payload?.data?.attributes?.metadata?.submission_id ??
      payload?.data?.attributes?.metadata?.submission ??
      payload?.data?.attributes?.metadata?.paymentSubmissionId ??
      payload?.data?.attributes?.metadata?.payment_submission_id ??
      ''
  ).trim();
}

function getSessionId(payload: any) {
  return String(
    payload?.data?.id ??
      payload?.data?.attributes?.id ??
      payload?.data?.attributes?.checkout_session_id ??
      payload?.data?.attributes?.checkoutSessionId ??
      payload?.data?.attributes?.session_id ??
      payload?.data?.attributes?.metadata?.checkoutSessionId ??
      ''
  ).trim();
}

async function resolveSubmissionDoc(payload: any) {
  const submissionId = getSubmissionId(payload);
  if (submissionId) {
    const doc = await adminDb.collection('payment_submissions').doc(submissionId).get();
    if (doc.exists) {
      return doc;
    }
  }

  const sessionId = getSessionId(payload);
  if (sessionId) {
    const snapshot = await adminDb
      .collection('payment_submissions')
      .where('paymongoCheckoutSessionId', '==', sessionId)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      return snapshot.docs[0];
    }
  }

  return null;
}

async function finalizeSubmission(doc: any, payload: any) {
  const data = doc.data();
  if (!data) return;

  if (data.status === 'Verified') {
    return;
  }

  const residentId = data.residentId;
  const residentName = data.residentName || 'Resident';
  const blockLot = data.blockLot || '';
  const paymentAmount = Number(data.paymentAmount ?? 0);
  const now = new Date();
  const eventType = getEventType(payload);
  const paymentReference = String(
    payload?.data?.attributes?.metadata?.referenceNumber ??
      payload?.data?.attributes?.payment_intent?.data?.attributes?.reference_number ??
      data.referenceNumber ??
      `PAYMONGO-${doc.id}`
  );

  await doc.ref.update({
    status: 'Verified',
    verifiedAt: now,
    verifiedDate: now.toLocaleString(),
    updatedAt: now,
    paymongoStatus: 'paid',
    paymongoEventType: eventType || 'paid',
    paymongoReferenceNumber: paymentReference,
  });

  if (!residentId) {
    return;
  }

  const allocation = await allocatePaymentAcrossDues(residentId, paymentAmount, now);
  const allocatedDueMonths = allocation.allocations.map((entry) => `${entry.month} ${entry.year}`);
  await doc.ref.update({
    appliedToMonths: allocatedDueMonths,
    month: allocation.primaryDueMonthLabel,
    updatedAt: new Date(),
  });

  const existingPaymentBySubmission = await adminDb
    .collection('payments')
    .where('submissionId', '==', doc.id)
    .limit(1)
    .get();

  if (existingPaymentBySubmission.empty) {
    await adminDb.collection('payments').add({
      residentId,
      residentName,
      amount: paymentAmount,
      type: 'Payment',
      description: `Monthly Dues - ${allocation.primaryDueMonthLabel}`,
      paymentMethod: data.paymentMethod || 'PayMongo',
      referenceNumber: paymentReference,
      fileUrl: null,
      status: 'Paid',
      createdAt: now,
      date: now.toLocaleDateString(),
      source: 'paymongo',
      submissionId: doc.id,
      allocatedDueMonths,
    });
  }

  await adminDb.collection('notifications').add({
    userId: residentId,
    title: 'Payment Verified',
    message: `Your PayMongo payment of ₱${paymentAmount.toLocaleString()} has been verified.`,
    type: 'success',
    read: false,
    createdAt: now,
    submissionId: doc.id,
  });

  let residentEmail: string | undefined;
  try {
    const authUser = await adminAuth.getUser(residentId);
    residentEmail = authUser.email ?? undefined;
  } catch (lookupError: any) {
    console.warn('[PayMongo Webhook] Could not fetch resident auth user:', lookupError?.message ?? lookupError);
  }

  if (!residentEmail) {
    const residentProfile = await adminDb.collection('users').doc(residentId).get();
    residentEmail = residentProfile.data()?.email;
  }

  if (residentEmail) {
    try {
      await sendPaymentVerifiedEmail({
        toEmail: residentEmail,
        residentName,
        amount: paymentAmount,
        month: allocation.primaryDueMonthLabel,
      });
    } catch (emailError: any) {
      console.error('[PayMongo Webhook] Failed to send verification email:', emailError?.message ?? emailError);
    }
  }

  console.log(`[PayMongo Webhook] Verified submission ${doc.id} (${paymentAmount}) for ${residentName} ${blockLot}`);
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const eventType = getEventType(payload);

    if (!eventType.includes('paid')) {
      return NextResponse.json({ received: true, ignored: true, eventType });
    }

    const submissionDoc = await resolveSubmissionDoc(payload);

    if (!submissionDoc) {
      console.warn('[PayMongo Webhook] Could not find matching payment submission for payload:', payload?.data?.id ?? eventType);
      return NextResponse.json({ received: true, matched: false, eventType });
    }

    await finalizeSubmission(submissionDoc, payload);

    return NextResponse.json({ received: true, matched: true, eventType, submissionId: submissionDoc.id });
  } catch (error: any) {
    console.error('[PayMongo Webhook] Failed to process payload:', error?.message ?? error);
    return NextResponse.json({ received: false, error: error?.message ?? 'Webhook processing failed' }, { status: 500 });
  }
}
