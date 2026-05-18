'use client';

import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { CSRF_COOKIE_NAME, CSRF_HEADER } from '@/lib/csrf';

type RouterLike = {
  push: (path: string) => void;
  replace: (path: string) => void;
};

const AUTH_STORAGE_KEYS = [
  'isAuthenticated',
  'userEmail',
  'userName',
  'userRole',
  'userId',
  'accountStatus',
];

function getCookieValue(name: string) {
  if (typeof document === 'undefined') {
    return '';
  }

  const cookieParts = document.cookie.split(';').map((part) => part.trim());
  const match = cookieParts.find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

export function clearAuthSession() {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

export async function destroyServerSession() {
  try {
    const csrfToken = getCookieValue(CSRF_COOKIE_NAME);

    await fetch('/api/auth/session', {
      method: 'DELETE',
      credentials: 'include',
      headers: csrfToken ? { [CSRF_HEADER]: csrfToken } : undefined,
    });
  } catch {
    // Ignore network issues and still clear local client session.
  }
}

export async function logoutAndRedirect(router: RouterLike, targetPath = '/login') {
  await destroyServerSession();

  try {
    await signOut(auth);
  } catch {
    // Still clear local session even if Firebase sign out fails.
  }

  clearAuthSession();
  router.replace(targetPath);
}