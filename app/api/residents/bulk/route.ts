import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { verifyCsrf } from '@/lib/csrf';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // 1. Verify Authentication & Role
  const tokenVerification = await requireApprovedUser(request);
  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const userId = tokenVerification.decoded!.uid;

  // Verify Admin Access
  try {
    const adminDoc = await adminDb.collection('users').doc(userId).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return createErrorResponse('Forbidden: Admin access required', 403);
    }
  } catch (err: any) {
    return createErrorResponse('Internal authentication error', 500);
  }

  // 2. Verify CSRF Protection
  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const body = await request.json();
    const { residents, defaultPhase } = body;

    if (!residents || !Array.isArray(residents)) {
      return createErrorResponse('Invalid payload: residents must be an array', 400);
    }

    const results = [];
    const now = new Date().toISOString();

    for (let index = 0; index < residents.length; index++) {
      const row = residents[index];
      const name = String(row.NAME || row.fullName || '').trim();
      const block = String(row.BLK || row.block || '').trim();
      const lot = String(row.LOT || row.lot || '').trim();
      const email = String(row.email || '').trim();
      const phone = String(row.phone || '').trim();

      // Basic row validation
      if (!name) {
        results.push({
          rowNumber: index + 1,
          name: name || `Row ${index + 1}`,
          email: email || 'N/A',
          status: 'failed',
          error: 'Missing name',
        });
        continue;
      }

      // Automatically generate formatted email: lastnameblknumberlotnumber@gmail.com
      const cleanName = name.toLowerCase();
      const nameParts = cleanName.split(/\s+/);
      const lastName = nameParts[nameParts.length - 1] || 'resident';
      const cleanLastName = lastName.replace(/[^a-z]/g, '');
      const blkNum = block.replace(/\D/g, '') || '0';
      const lotNum = lot.replace(/\D/g, '') || '0';
      const finalEmail = `${cleanLastName}blk${blkNum}lot${lotNum}@gmail.com`;

      // Normalize phone format for Firebase Auth if provided
      let finalPhone: string | undefined = undefined;
      if (phone) {
        finalPhone = phone.startsWith('+') ? phone : `+63${phone.replace(/^0/, '')}`;
      }

      try {
        // A. Register User in Firebase Auth
        const authUser = await adminAuth.createUser({
          email: finalEmail,
          password: 'lhconnect2026', // Secure default temporary password
          displayName: name,
          phoneNumber: finalPhone || undefined,
        });

        // B. Persist User Profile Schema in Firestore
        const newUser = {
          email: finalEmail,
          fullName: name,
          phone: phone || '',
          phase: defaultPhase || 'NEW AREA & SOCIALIZED',
          block: block || '',
          lot: lot || '',
          role: 'resident',
          approvalStatus: 'Approved',
          status: 'Active',
          balance: 0,
          createdAt: now,
          updatedAt: now,
        };

        await adminDb.collection('users').doc(authUser.uid).set(newUser);

        results.push({
          rowNumber: index + 1,
          name,
          email: finalEmail,
          status: 'success',
        });
      } catch (rowError: any) {
        console.error(`[Bulk Import] Error at row ${index + 1} (${name}):`, rowError.message);
        
        let displayError = rowError.message;
        if (rowError.code === 'auth/email-already-exists') {
          displayError = 'Email address already exists in authentication.';
        } else if (rowError.code === 'auth/invalid-phone-number') {
          displayError = 'Invalid Philippine mobile number format.';
        } else if (rowError.code === 'auth/phone-number-already-exists') {
          displayError = 'Mobile number already registered to another account.';
        }

        results.push({
          rowNumber: index + 1,
          name,
          email: finalEmail,
          status: 'failed',
          error: displayError,
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      message: `Bulk import completed: ${successCount} succeeded, ${failedCount} failed.`,
      results,
      successCount,
      failedCount,
    });
  } catch (error: any) {
    console.error('[Bulk Import Route Error]:', error.message || error);
    return createErrorResponse(`Import route failure: ${error.message}`, 500);
  }
}
