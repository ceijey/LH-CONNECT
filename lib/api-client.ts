import { clearAuthSession, destroyServerSession } from '@/lib/auth-session';
import { CSRF_COOKIE_NAME, CSRF_HEADER } from '@/lib/csrf';
import { auth } from '@/lib/firebase-client';

function extractErrorMessage(rawText: string): string {
  try {
    const parsed = JSON.parse(rawText);
    return String(parsed.error ?? rawText).trim();
  } catch {
    return String(rawText).trim();
  }
}

function isAuthRelated403(message: string): boolean {
  return /invalid or expired token|invalid token|expired token|unauthorized|missing authentication credentials|authentication failed|session/i.test(message);
}

async function getBearerToken(): Promise<string> {
  try {
    const user = auth?.currentUser;
    if (!user?.getIdToken) {
      return '';
    }

    return await user.getIdToken();
  } catch {
    return '';
  }
}

function getCookieValue(name: string) {
  if (typeof document === 'undefined') {
    return '';
  }

  const cookieParts = document.cookie.split(';').map((part) => part.trim());
  const match = cookieParts.find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

export async function apiCall(
  endpoint: string,
  options: RequestInit & { method?: string } = {}
) {
  const headers = new Headers(options.headers);

  const body = options.body;
  const hasJsonContentType = headers.has('Content-Type');
  if (!hasJsonContentType && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const method = (options.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    const csrfToken = getCookieValue(CSRF_COOKIE_NAME);
    if (csrfToken) {
      headers.set(CSRF_HEADER, csrfToken);
    }
  }

  if (!headers.has('Authorization')) {
    const bearerToken = await getBearerToken();
    if (bearerToken) {
      headers.set('Authorization', `Bearer ${bearerToken}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (networkError: any) {
    console.error(`[API Fetch Failed] ${endpoint}`, networkError);
    throw new Error(`Network error while calling ${endpoint}: ${networkError.message || 'Failed to fetch'}`);
  }

  console.log(`[API] ${endpoint}: status=${response.status}, ok=${response.ok}`);

  if (!response.ok) {
    const errorText = await response.text();
    const errorMessage = extractErrorMessage(errorText) || response.statusText;

    if (response.status === 403 && /pending.*approval|hoa approval/i.test(errorMessage)) {
      window.location.href = '/pending-approval';
      throw new Error(errorMessage);
    }

    if (response.status === 401 || (response.status === 403 && isAuthRelated403(errorMessage))) {
      clearAuthSession();
      await destroyServerSession();
      window.location.href = '/login';
      throw new Error('Authentication failed. Redirecting to login...');
    }

    if (response.status === 403 && /csrf/i.test(errorMessage)) {
      throw new Error('Security check failed (CSRF). Please refresh the page and try again.');
    }

    console.error(`[API Error] Response text:`, errorText);
    throw new Error(errorMessage || `API error: ${response.statusText}`);
  }

  const jsonText = await response.text();
  console.log(`[API Response] ${endpoint}:`, jsonText);
  return JSON.parse(jsonText);
}
