import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from './firebase-admin';

export async function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: 'Missing or invalid authorization header',
      status: 401,
      decoded: null,
    };
  }

  const token = authHeader.substring(7);

  try {
    const decoded = await adminAuth.verifyIdToken(token);
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
