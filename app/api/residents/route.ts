import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  // Verify token
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;
  const userId = decoded.uid;

  try {
    // Get user role from Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      return createErrorResponse('User not found', 404);
    }

    const userRole = userData.role;

    // If admin, return all residents; otherwise return only current user
    if (userRole === 'admin') {
      const residentsSnapshot = await adminDb
        .collection('users')
        .where('role', '==', 'resident')
        .get();

      const residents = residentsSnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return NextResponse.json({ residents, user: decoded });
    } else if (userRole === 'resident') {
      // Return current resident's profile from users collection.
      const residentDoc = await adminDb.collection('users').doc(userId).get();
      const residentData = residentDoc.data();
      return NextResponse.json({ resident: residentData, user: decoded });
    } else {
      return createErrorResponse('Unauthorized role', 403);
    }
  } catch (error: any) {
    console.error('Error fetching residents:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
