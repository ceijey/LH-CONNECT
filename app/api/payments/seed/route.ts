import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { verifyCsrf } from '@/lib/csrf';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;
  const requesterId = decoded.uid;

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const body = await request.json().catch(() => ({}));
    const count = Math.max(1, Number(body.count) || 5);
    const residentIdArg = typeof body.residentId === 'string' ? body.residentId : undefined;

    // Check requester role
    const userDoc = await adminDb.collection('users').doc(requesterId).get();
    const userData = userDoc.data() || {};
    const isAdmin = userData.role === 'admin';

    const targetResidentId = isAdmin && residentIdArg ? residentIdArg : requesterId;

    const created: string[] = [];

    for (let i = 0; i < count; i++) {
      const daysAgo = i * 30; // monthly samples
      const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      const amount = 500 + (i % 3) * 250;
      const status = i % 2 === 0 ? 'Paid' : 'Pending';
      const doc = {
        residentId: targetResidentId,
        amount,
        status,
        method: 'GCash',
        reference: `TEST-${Date.now()}-${i}`,
        createdAt,
      };

      const ref = await adminDb.collection('payments').add(doc as any);
      created.push(ref.id);
    }

    return NextResponse.json({ created, seededFor: targetResidentId });
  } catch (error: any) {
    console.error('Error seeding payments:', error.message || error);
    return createErrorResponse('Failed to seed payments', 500);
  }
}
