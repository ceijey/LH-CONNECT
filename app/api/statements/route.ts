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

    console.log('[API] User is a resident, fetching statements...');

    // Fetch resident's statements from Firestore
    let statements: any[] = [];
    try {
      const statementsSnapshot = await adminDb
        .collection('statements')
        .where('residentId', '==', userId)
        .get();

      statements = statementsSnapshot.docs
        .map((doc: any) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      console.log('[API] Firestore query successful, found', statements.length, 'statements');
    } catch (firestoreError: any) {
      console.warn('Firestore query error (returning sample data):', firestoreError.message);
      // Continue with sample data if collection doesn't exist
    }

    console.log('[API] Returning', statements.length, 'statements from database');
    return NextResponse.json({ statements });
  } catch (error: any) {
    console.error('Error fetching statements:', error.message);
    console.error('Full error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
