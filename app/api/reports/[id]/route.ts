import { NextRequest, NextResponse } from 'next/server';
import { type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { requireAdmin, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCsrf } from '@/lib/csrf';
import { logAuditAction } from '@/lib/audit-logger';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenVerification = await requireAdmin(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const adminId = tokenVerification.decoded!.uid;
    const adminDoc = await adminDb.collection('users').doc(adminId).get();
    const adminData = adminDoc.data();
    if (!adminData) return createErrorResponse('User not found', 404);

    const body = await request.json() as { orNumber?: string };
    const normalizedOrNumber = body.orNumber?.trim() ?? '';
    if (!normalizedOrNumber) {
      return createErrorResponse('OR number is required', 400);
    }
    if (!/^\d+$/.test(normalizedOrNumber)) {
      return createErrorResponse('OR number must contain numbers only', 400);
    }

    const submissionRef = adminDb.collection('payment_submissions').doc(id);
    const newOrNumberRef = adminDb.collection('payment_or_numbers').doc(normalizedOrNumber);
    const result = await adminDb.runTransaction(async (transaction: Transaction) => {
      const submissionDoc = await transaction.get(submissionRef as DocumentReference);
      if (!submissionDoc.exists) {
        throw new Error('Submission not found');
      }

      const submissionData = submissionDoc.data()!;
      if (submissionData.status !== 'Verified') {
        const error = new Error('Only verified payments can have their OR number edited');
        error.name = 'InvalidSubmissionStatusError';
        throw error;
      }

      const currentOrNumber = String(submissionData.referenceNumber ?? '').trim();
      if (currentOrNumber === normalizedOrNumber) {
        return { submissionData, oldOrNumber: currentOrNumber };
      }

      const oldOrNumberRef = currentOrNumber
        ? adminDb.collection('payment_or_numbers').doc(currentOrNumber)
        : null;
      const [newOrNumberDoc, oldOrNumberDoc] = await Promise.all([
        transaction.get(newOrNumberRef as DocumentReference),
        oldOrNumberRef
          ? transaction.get(oldOrNumberRef as DocumentReference)
          : Promise.resolve(null),
      ]);

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

      if (
        newOrNumberDoc.exists ||
        duplicateSubmissionQuery.docs.some((doc) => doc.id !== id) ||
        !duplicatePaymentQuery.empty
      ) {
        const error = new Error('This OR number has already been used. Please enter a different OR number.');
        error.name = 'DuplicateOrNumberError';
        throw error;
      }

      const paymentId = oldOrNumberDoc?.exists ? oldOrNumberDoc.data()?.paymentId : undefined;
      const paymentRef = paymentId
        ? adminDb.collection('payments').doc(String(paymentId))
        : null;
      const paymentDoc = paymentRef
        ? await transaction.get(paymentRef as DocumentReference)
        : null;
      const paymentQuery = !paymentDoc?.exists
        ? await transaction.get(
            adminDb.collection('payments')
              .where('submissionId', '==', id)
              .limit(1),
          )
        : null;
      const linkedPaymentId = paymentDoc?.exists
        ? paymentRef!.id
        : paymentQuery && !paymentQuery.empty
          ? paymentQuery.docs[0].id
          : null;

      transaction.update(submissionRef, {
        referenceNumber: normalizedOrNumber,
        updatedAt: new Date(),
      });

      if (paymentDoc?.exists && paymentRef) {
        transaction.update(paymentRef, { referenceNumber: normalizedOrNumber, updatedAt: new Date() });
      } else if (paymentQuery && !paymentQuery.empty) {
        transaction.update(paymentQuery.docs[0].ref, { referenceNumber: normalizedOrNumber, updatedAt: new Date() });
      }

      if (oldOrNumberRef && oldOrNumberDoc?.exists) {
        transaction.delete(oldOrNumberRef);
      }
      transaction.create(newOrNumberRef, {
        ...(oldOrNumberDoc?.exists ? oldOrNumberDoc.data() : {}),
        orNumber: normalizedOrNumber,
        submissionId: id,
        paymentId: linkedPaymentId,
        updatedAt: new Date(),
      });

      return { submissionData, oldOrNumber: currentOrNumber };
    });

    const oldOrNumber = result.oldOrNumber || '—';
    const adminName = adminData.fullName || adminData.name || 'Admin';
    await logAuditAction(
      adminId,
      adminName,
      'Update OR Number',
      `Changed OR number for ${result.submissionData.residentName || 'Unknown'} from ${oldOrNumber} to ${normalizedOrNumber}`,
      id,
    );

    return NextResponse.json({
      submission: { id, ...result.submissionData, referenceNumber: normalizedOrNumber },
    });
  } catch (error: unknown) {
    const errorName = error instanceof Error ? error.name : '';
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorName === 'DuplicateOrNumberError') {
      return createErrorResponse(errorMessage, 409);
    }
    if (errorName === 'InvalidSubmissionStatusError') {
      return createErrorResponse(errorMessage, 400);
    }
    if (errorMessage === 'Submission not found') {
      return createErrorResponse(errorMessage, 404);
    }
    console.error('Error updating report OR number:', errorMessage || error);
    return createErrorResponse('Internal server error', 500);
  }
}
