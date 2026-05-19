import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const CSRF_COOKIE_NAME = 'lh_csrf';
export const CSRF_HEADER = 'x-csrf-token';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export function createCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function setCsrfCookie(response: NextResponse, token: string, maxAge = SESSION_MAX_AGE_SECONDS) {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

export function clearCsrfCookie(response: NextResponse) {
  response.cookies.set(CSRF_COOKIE_NAME, '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function verifyCsrf(request: NextRequest): NextResponse | null {
  const cookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const header = request.headers.get(CSRF_HEADER);

  if (!cookie || !header || cookie !== header) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[CSRF Warning] Token verification failed in development. Cookie: "${cookie}", Header: "${header}". Bypassed in development mode.`);
      return null;
    }
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  return null;
}
