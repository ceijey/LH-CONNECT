import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

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

export async function POST(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const userId = tokenVerification.decoded!.uid;

  try {
    const adminDoc = await adminDb.collection('users').doc(userId).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

    const body = await request.json();
    const { email, fullName, phone, phase, block, lot } = body;

    if (!email || !fullName) {
      return createErrorResponse('Email and full name are required', 400);
    }

    // 1. Create the Auth User
    let authUser;
    try {
      authUser = await adminAuth.createUser({
        email,
        password: 'lhconnect2026', // Default password
        displayName: fullName,
        phoneNumber: phone ? (phone.startsWith('+') ? phone : `+63${phone.replace(/^0/, '')}`) : undefined,
      });
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-exists') {
        return createErrorResponse('A user with this email already exists in authentication.', 400);
      }
      throw authError;
    }

    const now = new Date().toISOString();
    const newUser = {
      email,
      fullName,
      phone: phone || '',
      phase: phase || '',
      block: block || '',
      lot: lot || '',
      role: 'resident',
      approvalStatus: 'Approved',
      status: 'Active',
      balance: 0,
      createdAt: now,
      updatedAt: now,
    };

    // 2. Create the Firestore record using the Auth UID
    await adminDb.collection('users').doc(authUser.uid).set(newUser);

    return NextResponse.json({ 
      id: authUser.uid, 
      message: 'Resident created successfully. Temporary password is: lhconnect2026' 
    });
  } catch (error: any) {
    console.error('Error creating resident:', error.message);
    return createErrorResponse(`Failed to create resident: ${error.message}`, 500);
  }
}
