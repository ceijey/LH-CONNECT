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
        await statementsRef.add({
          residentId: userId,
          month: currentMonthName,
          year: currentYear,
          date: createdAt,
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

        if (Number(currentStatement.totalDues ?? 0) !== MONTHLY_DUES || Number(currentStatement.balance ?? 0) !== normalizedBalance || String(currentStatement.status ?? '') !== normalizedStatus) {
          await statementsRef.doc(currentStatement.id).update({
            totalDues: MONTHLY_DUES,
            balance: normalizedBalance,
            status: normalizedStatus,
            updatedAt: now.toISOString(),
          });
        }
      }

      const normalizedStatementsSnapshot = await statementsRef
        .where('residentId', '==', userId)
        .get();

      statements = normalizedStatementsSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        totalDues: MONTHLY_DUES,
      }));
      
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
      
      console.log('[API] Firestore queries successful, found', statements.length, 'statements');
    } catch (firestoreError: any) {
      console.warn('Firestore query error:', firestoreError.message);
    }

    return NextResponse.json({ statements });
  } catch (error: any) {
    console.error('Error fetching statements:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
