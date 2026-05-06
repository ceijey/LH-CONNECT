import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  console.log('[API] /api/statements called');
  // Verify token
  const tokenVerification = await verifyToken(request);

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

    // Fetch resident's statements and submissions from Firestore
    let statements: any[] = [];
    let submissions: any[] = [];
    
    try {
      // Fetch statements
      const statementsSnapshot = await adminDb
        .collection('statements')
        .where('residentId', '==', userId)
        .get();

      statements = statementsSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
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
      statements = statements.map(stmt => {
        const stmtMonth = stmt.month;
        const stmtYear = Number(stmt.year);
        
        const matchingSubmissions = submissions.filter(sub => {
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
