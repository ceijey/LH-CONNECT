import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;
  const userId = decoded.uid;

  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    if (!userData) return createErrorResponse('User not found', 404);

    if ((userData.role ?? '') !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

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

    const now = new Date();
    const updatePayload: any = { 
      status, 
      updatedAt: now 
    };

    if (status === 'Verified') {
      updatePayload.verifiedAt = now;
      updatePayload.verifiedDate = now.toLocaleString();
      updatePayload.rejectionReason = null; // Clear any previous reason

      // Update resident balance
      if (residentId) {
        const residentRef = adminDb.collection('users').doc(residentId);
        const residentDoc = await residentRef.get();
        if (residentDoc.exists) {
          const currentBalance = Number(residentDoc.data()?.balance ?? 0);
          const paymentAmount = Number(submissionData.paymentAmount ?? 0);
          await residentRef.update({
            balance: Math.max(0, currentBalance - paymentAmount),
            updatedAt: now.toISOString()
          });

          // Create official payment record
          await adminDb.collection('payments').add({
            residentId,
            residentName: submissionData.residentName || 'Unknown',
            amount: paymentAmount,
            type: 'Payment',
            description: `Monthly Dues - ${submissionData.month || 'Current'}`,
            paymentMethod: submissionData.paymentMethod,
            referenceNumber: submissionData.referenceNumber,
            fileUrl: submissionData.fileUrl || null,
            status: 'Paid',
            createdAt: now,
            date: now.toLocaleDateString(),
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
        ? `Your payment of ₱${submissionData.paymentAmount} has been approved.` 
        : `Your payment of ₱${submissionData.paymentAmount} was rejected. Reason: ${rejectionReason || 'No reason provided'}`;

      await adminDb.collection('notifications').add({
        userId: residentId,
        title: `Payment ${status}`,
        message: notificationMessage,
        type: status === 'Verified' ? 'success' : 'error',
        read: false,
        createdAt: now,
        submissionId: id
      });
    }

    const updated = (await docRef.get()).data();
    return NextResponse.json({ submission: { id, ...updated } });
  } catch (error: any) {
    console.error('Error updating submission status:', error?.message ?? error);
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
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

    await adminDb.collection('payment_submissions').doc(id).delete();

    return NextResponse.json({ message: 'Submission deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting submission:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
