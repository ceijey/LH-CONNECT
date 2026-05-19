import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { createCsrfToken, setCsrfCookie, clearCsrfCookie, verifyCsrf } from '@/lib/csrf';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function buildCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export async function POST(request: NextRequest) {
  try {
    const requestBody = (await request.json()) as { idToken?: string };
    const idToken = requestBody.idToken;

    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken.' }, { status: 400 });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data() ?? {};
    const role = userData.role === 'admin' ? 'admin' : 'resident';

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });

    // create CSRF token for double-submit verification
    const csrfToken = createCsrfToken();
    const responseBody = { ok: true, role, csrfToken };
    const response = NextResponse.json(responseBody, { status: 200 });
    // set cookies (csrf + session)
    setCsrfCookie(response, csrfToken, SESSION_MAX_AGE_SECONDS);
    response.cookies.set('lh_session', sessionCookie, buildCookieOptions(SESSION_MAX_AGE_SECONDS));
    response.cookies.set('lh_role', role, buildCookieOptions(SESSION_MAX_AGE_SECONDS));

    return response;
  } catch (error) {
    console.error('Failed to create session cookie:', error);
    return NextResponse.json({ error: 'Failed to create session.' }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('lh_session', '', buildCookieOptions(0));
  response.cookies.set('lh_role', '', buildCookieOptions(0));
  // clear csrf cookie on logout
  clearCsrfCookie(response);
  return response;
}
