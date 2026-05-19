import { clearAuthSession, destroyServerSession } from '@/lib/auth-session';

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
  const method = (options.method || 'GET').toUpperCase();
  const csrfToken = getCookieValue('lh_csrf');

  const headers = {
    'Content-Type': 'application/json',
    ...(method !== 'GET' && csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    ...options.headers,
  };

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

  if (response.status === 401 || response.status === 403) {
    const errorText = await response.text();
    let errorMessage = errorText;

    try {
      const parsed = JSON.parse(errorText);
      errorMessage = parsed.error || errorText;
    } catch {
      // keep raw text
    }

    if (response.status === 403 && /pending.*approval|hoa approval/i.test(errorMessage)) {
      window.location.href = '/pending-approval';
      throw new Error(errorMessage);
    }

    clearAuthSession();
    await destroyServerSession();
    window.location.href = '/login';
    throw new Error('Authentication failed. Redirecting to login...');
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[API Error] Response text:`, errorText);
    try {
      const error = JSON.parse(errorText);
      throw new Error(error.error || `API error: ${response.statusText}`);
    } catch (e: any) {
      throw new Error(`API error: ${response.statusText} - ${errorText}`);
    }
  }

  const jsonText = await response.text();
  console.log(`[API Response] ${endpoint}:`, jsonText);
  return JSON.parse(jsonText);
}
