import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

const MONTHLY_DUES = 400;

export async function GET(request: NextRequest) {
  console.log('[API] /api/statements called');
  // Verify token
  const tokenVerification = await requireApprovedUser(request);

  if (tokenVerification.error) {
    console.log('[API] Token verification failed:', tokenVerification.error);
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;
  const userId = decoded.uid;
  console.log('[API] Token verified, userId:', userId);

  try {
    // Get user role from Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      console.log('[API] User not found');
      return createErrorResponse('User not found', 404);
    }

    if (userData.role !== 'resident') {
      console.log('[API] User is not a resident:', userData.role);
      return createErrorResponse('Only residents can view statements', 403);
    }

    console.log('[API] User is a resident, fetching statements and submissions...');

    const now = new Date();
    const currentMonthName = now.toLocaleString(undefined, { month: 'long' });
    const currentYear = now.getFullYear();

    // Fetch resident's statements and submissions from Firestore
    let statements: any[] = [];
    let submissions: any[] = [];
    
    try {
      // Fetch statements
      const statementsRef = adminDb.collection('statements');
      const statementsSnapshot = await statementsRef
        .where('residentId', '==', userId)
        .get();

      const existingStatements = statementsSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const currentStatement = existingStatements.find((stmt: any) => (
        String(stmt.month ?? '').toLowerCase() === currentMonthName.toLowerCase() &&
        Number(stmt.year ?? 0) === currentYear
      ));

      if (!currentStatement) {
        const createdAt = now.toISOString();
        // compute due date as 15th of current month/year
        const monthIndex = new Date(`${currentMonthName} 1, ${currentYear}`).getMonth();
        const due = new Date(currentYear, monthIndex, 15, 23, 59, 59);
        const dueIso = due.toISOString();

        await statementsRef.add({
          residentId: userId,
          month: currentMonthName,
          year: currentYear,
          date: createdAt,
          dueDate: dueIso,
          totalDues: MONTHLY_DUES,
          amountPaid: 0,
          balance: MONTHLY_DUES,
          status: 'Pending',
          createdAt,
          updatedAt: createdAt,
        });
      } else {
        const amountPaid = Number(currentStatement.amountPaid ?? 0);
        const normalizedBalance = Math.max(0, MONTHLY_DUES - amountPaid);
        const normalizedStatus = normalizedBalance === 0 ? 'Paid' : (amountPaid > 0 ? 'Partially Paid' : 'Pending');

        const updates: any = {};
        if (Number(currentStatement.totalDues ?? 0) !== MONTHLY_DUES) updates.totalDues = MONTHLY_DUES;
        if (Number(currentStatement.balance ?? 0) !== normalizedBalance) updates.balance = normalizedBalance;
        if (String(currentStatement.status ?? '') !== normalizedStatus) updates.status = normalizedStatus;
        // ensure dueDate exists and is set to 15th
        if (!currentStatement.dueDate) {
          const monthIndex = new Date(`${currentStatement.month} 1, ${currentStatement.year}`).getMonth();
          const due = new Date(Number(currentStatement.year), monthIndex, 15, 23, 59, 59);
          updates.dueDate = due.toISOString();
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = now.toISOString();
          await statementsRef.doc(currentStatement.id).update(updates);
        }
      }

      const normalizedStatementsSnapshot = await statementsRef
        .where('residentId', '==', userId)
        .get();

      statements = normalizedStatementsSnapshot.docs.map((doc: any) => {
        const data = { id: doc.id, ...doc.data(), totalDues: MONTHLY_DUES } as any;
        // ensure dueDate exists on returned statements
        if (!data.dueDate) {
          try {
            const monthIndex = new Date(`${data.month} 1, ${data.year}`).getMonth();
            const due = new Date(Number(data.year), monthIndex, 15, 23, 59, 59);
            data.dueDate = due.toISOString();
          } catch (e) {
            data.dueDate = data.date || new Date().toISOString();
          }
        }
        return data;
      });
      
      // Fetch submissions
      const submissionsSnapshot = await adminDb
        .collection('payment_submissions')
        .where('residentId', '==', userId)
        .get();
        
      submissions = submissionsSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Attach matching submissions to statements
      statements = statements.map((stmt: any) => {
        const stmtMonth = stmt.month;
        const stmtYear = Number(stmt.year);
        
        const matchingSubmissions = submissions.filter((sub: any) => {
          // submissions collection has a 'month' field like "May 2026"
          // We need to match it with statement's month and year
          if (!sub.month) return false;
          const subMonthStr = String(sub.month).toLowerCase();
          const targetMonthStr = `${stmtMonth} ${stmtYear}`.toLowerCase();
          return subMonthStr.includes(targetMonthStr) || 
                 (subMonthStr.includes(stmtMonth.toLowerCase()) && subMonthStr.includes(String(stmtYear)));
        });
        
        return {
          ...stmt,
          totalDues: MONTHLY_DUES,
          balance: Math.max(0, MONTHLY_DUES - Number(stmt.amountPaid ?? 0)),
          status: Math.max(0, MONTHLY_DUES - Number(stmt.amountPaid ?? 0)) === 0
            ? 'Paid'
            : (Number(stmt.amountPaid ?? 0) > 0 ? 'Partially Paid' : 'Pending'),
          relatedSubmissions: matchingSubmissions
        };
      });

      statements.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        // Create in-app reminders for upcoming due dates if not already created
        try {
          const REMINDER_DAYS = Number(process.env.DUE_REMINDER_DAYS ?? 3);
          const nowMs = Date.now();

          for (const stmt of statements) {
            try {
              const status = (stmt.status || '').toString().toLowerCase();
              if (status === 'paid') continue;
              const dueIso = stmt.dueDate || stmt.date;
              if (!dueIso) continue;

              const dueMs = new Date(dueIso).getTime();
              const daysUntil = Math.ceil((dueMs - nowMs) / (1000 * 60 * 60 * 24));

              if (daysUntil > 0 && daysUntil <= REMINDER_DAYS) {
                // check for existing reminder for this month/year
                const dueMonthStr = `${stmt.month} ${stmt.year}`;
                const existing = await adminDb.collection('notifications')
                  .where('userId', '==', userId)
                  .where('type', '==', 'due-reminder')
                  .where('dueMonth', '==', dueMonthStr)
                  .limit(1)
                  .get();

                if (existing.empty) {
                  await adminDb.collection('notifications').add({
                    userId,
                    type: 'due-reminder',
                    title: 'Upcoming Due Date',
                    message: `Your bill of ₱${Number(stmt.totalDues || 0).toFixed(2)} is due on ${new Date(dueIso).toLocaleDateString()} (${daysUntil} day${daysUntil === 1 ? '' : 's'}). Please settle your payment.`,
                    dueAmount: Number(stmt.totalDues || 0),
                    dueMonth: dueMonthStr,
                    read: false,
                    createdAt: new Date(),
                  });
                }
              }
            } catch (innerErr: unknown) {
              const innerMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
              console.error('[Reminder] Failed to evaluate/create reminder for statement:', innerMessage);
            }
          }
        } catch (remErr) {
          const reminderMessage = remErr instanceof Error ? remErr.message : String(remErr);
          console.error('[Reminder] Reminder generation failed:', reminderMessage);
        }
      console.log('[API] Firestore queries successful, found', statements.length, 'statements');
    } catch (firestoreError: any) {
      console.warn('Firestore query error:', firestoreError.message);
    }

    return NextResponse.json({ statements });
  } catch (error: any) {
    console.error('Error fetching statements:', error.message);
    return NextResponse.json({ statements: [] });
  }
}
