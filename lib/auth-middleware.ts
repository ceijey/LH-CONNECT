import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from './firebase-admin';

export async function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const sessionCookie = request.cookies.get('lh_session')?.value;

  if ((!authHeader || !authHeader.startsWith('Bearer ')) && !sessionCookie) {
    return {
      error: 'Missing authentication credentials',
      status: 401,
      decoded: null,
    };
  }

  try {
    const decoded = authHeader?.startsWith('Bearer ')
      ? await adminAuth.verifyIdToken(authHeader.substring(7))
      : await adminAuth.verifySessionCookie(sessionCookie as string, true);

    return {
      error: null,
      status: 200,
      decoded,
    };
  } catch (error: any) {
    console.error('Token verification failed:', error.message);
    return {
      error: 'Invalid or expired token',
      status: 403,
      decoded: null,
    };
  }
}

export function createErrorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
