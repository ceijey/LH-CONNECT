import { clearAuthSession, destroyServerSession } from '@/lib/auth-session';

export async function apiCall(
  endpoint: string,
  options: RequestInit & { method?: string } = {}
) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  });

  console.log(`[API] ${endpoint}: status=${response.status}, ok=${response.ok}`);

  if (response.status === 401 || response.status === 403) {
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
