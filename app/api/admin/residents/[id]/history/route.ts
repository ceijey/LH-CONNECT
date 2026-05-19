import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const adminId = tokenVerification.decoded!.uid;

  try {
    // 1. Verify that the requester is an admin
    const adminDoc = await adminDb.collection('users').doc(adminId).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

    // 2. Fetch resident's statements and submissions from Firestore
    let statements: any[] = [];
    let submissions: any[] = [];
    
    // Fetch statements
    const statementsSnapshot = await adminDb
      .collection('statements')
      .where('residentId', '==', id)
      .get();

    statements = statementsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Fetch submissions
    const submissionsSnapshot = await adminDb
      .collection('payment_submissions')
      .where('residentId', '==', id)
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

    return NextResponse.json({ statements });
  } catch (error: any) {
    console.error('Error fetching resident history:', error.message);
    return NextResponse.json({ statements: [] });
  }
}
