import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { verifyCsrf } from '@/lib/csrf';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

async function ensureMonthlyStatementsForResidents(residents: any[]) {
  const now = new Date();
  const currentMonthName = now.toLocaleString('en-US', { month: 'long' });
  const currentYear = now.getFullYear();
  const MONTHLY_DUES = 400;

  const monthIndex = new Date(`${currentMonthName} 1, ${currentYear}`).getMonth();
  const due = new Date(currentYear, monthIndex, 15, 23, 59, 59);
  const dueIso = due.toISOString();
  const createdAt = now.toISOString();

  const statementsRef = adminDb.collection('statements');

  try {
    // Optimization: Query all statements for current month/year in EXACTLY ONE query
    const stmtQuery = await statementsRef
      .where('month', '==', currentMonthName)
      .where('year', '==', currentYear)
      .get();
    
    const existingResidentIds = new Set(stmtQuery.docs.map((doc: any) => doc.data().residentId));

    for (const resident of residents) {
      if (!existingResidentIds.has(resident.id)) {
        console.log(`[Automation] Automatically creating statement for resident ${resident.id} (${resident.fullName})`);
        
        await statementsRef.add({
          residentId: resident.id,
          month: currentMonthName,
          year: currentYear,
          date: createdAt.split('T')[0],
          dueDate: dueIso,
          totalDues: MONTHLY_DUES,
          amountPaid: 0,
          balance: MONTHLY_DUES,
          status: 'Pending',
          createdAt,
          updatedAt: createdAt,
        });

        const currentBalance = Number(resident.balance ?? 0);
        const newBalance = currentBalance + MONTHLY_DUES;
        await adminDb.collection('users').doc(resident.id).update({
          balance: newBalance,
          updatedAt: createdAt,
        });
        // Update in-memory so callers don't need to re-fetch
        resident.balance = newBalance;
        resident.updatedAt = createdAt;
      }
    }
  } catch (err: any) {
    console.error(`[Automation] Error generating statement:`, err.message);
  }
}

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

      // Automatically generate monthly statements & sync balances (updates array in-place)
      await ensureMonthlyStatementsForResidents(residents);

      // Fetch all statements for the current year
      const currentYear = new Date().getFullYear();
      const allStatementsQuery = await adminDb.collection('statements')
        .where('year', '==', currentYear)
        .get();
      
      const statementsByResident: Record<string, any[]> = {};
      allStatementsQuery.docs.forEach((doc: any) => {
        const data = doc.data();
        if (!statementsByResident[data.residentId]) {
          statementsByResident[data.residentId] = [];
        }
        statementsByResident[data.residentId].push({
          id: doc.id,
          month: data.month,
          status: data.status,
          balance: data.balance,
          totalDues: data.totalDues,
          amountPaid: data.amountPaid
        });
      });

      // Attach to residents
      const residentsWithStatements = residents.map((r: any) => ({
        ...r,
        statements: statementsByResident[r.id] || []
      }));

      return NextResponse.json({ residents: residentsWithStatements, user: decoded });
    } else if (userRole === 'resident') {
      // Return current resident's profile from users collection.
      return NextResponse.json({ resident: userData, user: decoded });
    } else {
      return createErrorResponse('Unauthorized role', 403);
    }
  } catch (error: any) {
    console.error('Error fetching residents:', error.message);
    const mockResidents = Array.from({ length: 10 }, (_, i) => ({
      id: `mock-resident-${i}`,
      fullName: `Mock Resident ${i + 1}`,
      email: `resident${i + 1}@example.com`,
      phone: `0912345678${i % 10}`,
      phase: 'Phase 1',
      block: `${(i % 5) + 1}`,
      lot: `${(i % 10) + 1}`,
      role: 'resident',
      approvalStatus: 'Approved',
      status: 'Good Standing',
      balance: i % 3 === 0 ? 400 : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    return NextResponse.json({ residents: mockResidents, user: decoded });
  }
}

export async function POST(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const userId = tokenVerification.decoded!.uid;

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const adminDoc = await adminDb.collection('users').doc(userId).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

    const body = await request.json();
    const { fullName, phone, phase, block, lot } = body;

    if (!fullName) {
      return createErrorResponse('Full name is required', 400);
    }

    // Generate formatted email: lastnameblknumberlotnumber@gmail.com
    const cleanName = fullName.trim().toLowerCase();
    const nameParts = cleanName.split(/\s+/);
    const lastName = nameParts[nameParts.length - 1] || 'resident';
    const cleanLastName = lastName.replace(/[^a-z]/g, '');
    const blkNum = (block || '').replace(/\D/g, '') || '0';
    const lotNum = (lot || '').replace(/\D/g, '') || '0';
    const finalEmail = `${cleanLastName}blk${blkNum}lot${lotNum}@gmail.com`;

    // 1. Create the Auth User
    let authUser;
    try {
      authUser = await adminAuth.createUser({
        email: finalEmail,
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
      email: finalEmail,
      fullName,
      phone: phone || '',
      phase: phase || '',
      block: block || '',
      lot: lot || '',
      role: 'resident',
      approvalStatus: 'Approved',
      status: 'Good Standing',
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
