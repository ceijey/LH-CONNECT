import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { sendPaymentVerifiedEmail } from '@/lib/mailer';

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
  const month = data.month || new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const paymentAmount = Number(data.paymentAmount ?? 0);
  const now = new Date();
  const eventType = getEventType(payload);
  const paymentReference = String(
    payload?.data?.attributes?.metadata?.referenceNumber ??
      payload?.data?.attributes?.payment_intent?.data?.attributes?.reference_number ??
      data.referenceNumber ??
      `PAYMONGO-${doc.id}`
  );

  const paymentRef = adminDb.collection('payments').doc(doc.id);
  const statementsRef = adminDb.collection('statements');
  const subMonthStr = String(month || '').toLowerCase();
  const targetStmt = residentId
    ? (await statementsRef.where('residentId', '==', residentId).get()).docs.find((stmtDoc: any) => {
        const stmtData = stmtDoc.data();
        const stmtTarget = `${stmtData.month} ${stmtData.year}`.toLowerCase();
        return subMonthStr.includes(stmtTarget) || stmtTarget.includes(subMonthStr);
      }) ?? null
    : null;

  const finalized = await adminDb.runTransaction(async (transaction) => {
    const freshSubmission = await transaction.get(doc.ref);
    if (!freshSubmission.exists) {
      throw new Error('Submission not found');
    }

    const freshData = freshSubmission.data()!;
    if (freshData.status === 'Verified') {
      return false;
    }

    transaction.update(doc.ref, {
      status: 'Verified',
      verifiedAt: now,
      verifiedDate: now.toLocaleString(),
      updatedAt: now,
      paymongoStatus: 'paid',
      paymongoEventType: eventType || 'paid',
      paymongoReferenceNumber: paymentReference,
    });

    if (!residentId) {
      return true;
    }

    const residentRef = adminDb.collection('users').doc(residentId);
    const residentDoc = await transaction.get(residentRef);
    if (!residentDoc.exists) {
      throw new Error('Resident not found');
    }

    const residentData = residentDoc.data()!;
    const currentBalance = Number(residentData.balance ?? 0);
    transaction.update(residentRef, {
      balance: Math.max(0, currentBalance - paymentAmount),
      updatedAt: now.toISOString(),
    });

    transaction.create(paymentRef, {
      residentId,
      residentName,
      amount: paymentAmount,
      type: 'Payment',
      description: `Monthly Dues - ${month}`,
      paymentMethod: data.paymentMethod || 'PayMongo',
      referenceNumber: paymentReference,
      submissionId: doc.id,
      fileUrl: null,
      status: 'Paid',
      createdAt: now,
      date: now.toLocaleDateString(),
      source: 'paymongo',
    });

    if (targetStmt) {
      const stmtData = targetStmt.data();
      const newAmountPaid = Number(stmtData.amountPaid || 0) + paymentAmount;
      const newBalance = Math.max(0, Number(stmtData.totalDues || 0) - newAmountPaid);
      const newStatus = newBalance === 0 ? 'Paid' : 'Pending';

      transaction.update(statementsRef.doc(targetStmt.id), {
        amountPaid: newAmountPaid,
        balance: newBalance,
        status: newStatus,
        updatedAt: now.toISOString(),
      });
    }

    return true;
  });

  if (!finalized) {
    return;
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
  } catch (lookupError: unknown) {
    const message = lookupError instanceof Error ? lookupError.message : String(lookupError);
    console.warn('[PayMongo Webhook] Could not fetch resident auth user:', message);
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
        month,
      });
    } catch (emailError: unknown) {
      const message = emailError instanceof Error ? emailError.message : String(emailError);
      console.error('[PayMongo Webhook] Failed to send verification email:', message);
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[PayMongo Webhook] Failed to process payload:', message);
    return NextResponse.json({ received: false, error: message || 'Webhook processing failed' }, { status: 500 });
  }
}
