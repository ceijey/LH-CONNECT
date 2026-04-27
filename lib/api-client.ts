import { clearAuthSession, destroyServerSession } from '@/lib/auth-session';

export async function apiCall(
  endpoint: string,
  options: RequestInit & { method?: string } = {}
) {
  const idToken = localStorage.getItem('idToken');

  if (!idToken) {
    throw new Error('Not authenticated. Please log in.');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    Authorization: `Bearer ${idToken}`,
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    clearAuthSession();
    await destroyServerSession();
    window.location.href = '/login';
    throw new Error('Authentication failed. Redirecting to login...');
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `API error: ${response.statusText}`);
  }

  return response.json();
}
