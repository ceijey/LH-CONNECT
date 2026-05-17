import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';
import { sendPaymentVerifiedEmail } from '@/lib/mailer';
import { verifyCsrf } from '@/lib/csrf';

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

    // 1. Create payment_submissions record (Status: Verified)
    const submissionRef = await adminDb.collection('payment_submissions').add({
      residentId,
      residentName,
      blockLot,
      paymentAmount: amount,
      paymentMethod,
      referenceNumber: `CASH-${Date.now()}`,
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

    // 2. Update resident balance
    const currentBalance = Number(residentData.balance ?? 0);
    const newBalance = Math.max(0, currentBalance - amount);
    await residentRef.update({
      balance: newBalance,
      updatedAt: now.toISOString()
    });

    // 3. Create official payment record
    await adminDb.collection('payments').add({
      residentId,
      residentName,
      amount: amount,
      type: 'Payment',
      description: `Manual Payment - ${month}`,
      paymentMethod,
      referenceNumber: `CASH-${Date.now()}`,
      status: 'Paid',
      createdAt: now,
      date: now.toLocaleDateString(),
    });

    // 4. Sync Statement record
    try {
      const subMonthStr = String(month || '').toLowerCase();
      const statementsRef = adminDb.collection('statements');
      const stmtSnapshot = await statementsRef.where('residentId', '==', residentId).get();

      const targetStmt = stmtSnapshot.docs.find((doc: any) => {
        const d = doc.data();
        const stmtTarget = `${d.month} ${d.year}`.toLowerCase();
        return subMonthStr.includes(stmtTarget) || stmtTarget.includes(subMonthStr);
      });

      if (targetStmt) {
        const stmtData = targetStmt.data();
        const newAmountPaid = Number(stmtData.amountPaid || 0) + amount;
        const stmtTotalDues = Number(stmtData.totalDues || 0);
        const newStmtBalance = Math.max(0, stmtTotalDues - newAmountPaid);
        const newStatus = newStmtBalance === 0 ? 'Paid' : (newAmountPaid > 0 ? 'Partially Paid' : 'Pending');

        await statementsRef.doc(targetStmt.id).update({
          amountPaid: newAmountPaid,
          balance: newStmtBalance,
          status: newStatus,
          updatedAt: now.toISOString()
        });
      }
    } catch (stmtErr: any) {
      console.error('[ManualPayment] Failed to sync statement:', stmtErr.message);
    }

    // 5. Notify resident
    await adminDb.collection('notifications').add({
      userId: residentId,
      title: 'Payment Received',
      message: `Your cash payment of ₱${amount.toLocaleString()} for ${month} has been recorded by the admin.`,
      type: 'success',
      read: false,
      createdAt: now,
      submissionId: submissionRef.id
    });

    // 6. Send Email if possible
    if (residentEmail && process.env.RESEND_API_KEY) {
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
