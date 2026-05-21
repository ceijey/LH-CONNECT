import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const tokenVerification = await requireApprovedUser(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const userData = (tokenVerification as any).userData;
  
  if (!userData || userData.role !== 'admin') {
    return createErrorResponse('Forbidden', 403);
  }

  try {
    const logsSnapshot = await adminDb
      .collection('audit_logs')
      .orderBy('timestamp', 'desc')
      .limit(200)
      .get();

    const logs = logsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
