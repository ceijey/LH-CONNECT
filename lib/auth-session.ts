'use client';

import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

type RouterLike = {
  push: (path: string) => void;
};

const AUTH_STORAGE_KEYS = [
  'isAuthenticated',
  'userEmail',
  'userName',
  'userRole',
  'userId',
];

export function clearAuthSession() {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

export async function destroyServerSession() {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' });
  } catch {
    // Ignore network issues and still clear local client session.
  }
}

export async function logoutAndRedirect(router: RouterLike, targetPath = '/') {
  await destroyServerSession();

  try {
    await signOut(auth);
  } catch {
    // Still clear local session even if Firebase sign out fails.
  }

  clearAuthSession();
  router.push(targetPath);
}