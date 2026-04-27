'use client';

import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

type RouterLike = {
  push: (href: string) => void;
};

type UserRole = 'admin' | 'resident';

const AUTH_STORAGE_KEYS = [
  'isAuthenticated',
  'userEmail',
  'userName',
  'userRole',
  'idToken',
  'userId',
];

const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

export function setAuthSessionCookies(role: UserRole) {
  setCookie('lh_auth', '1', AUTH_COOKIE_MAX_AGE_SECONDS);
  setCookie('lh_role', role, AUTH_COOKIE_MAX_AGE_SECONDS);
}

export function clearAuthSessionCookies() {
  clearCookie('lh_auth');
  clearCookie('lh_role');
}

export function clearAuthSession() {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  clearAuthSessionCookies();
}

export function guardResidentRoute(router: RouterLike) {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const userRole = localStorage.getItem('userRole');
  const idToken = localStorage.getItem('idToken');

  if (!isAuthenticated || !idToken) {
    clearAuthSession();
    router.push('/login');
    return false;
  }

  if (userRole === 'admin') {
    router.push('/admin/dashboard');
    return false;
  }

  if (userRole !== 'resident') {
    clearAuthSession();
    router.push('/login');
    return false;
  }

  return true;
}

export async function logoutAndRedirect(router: RouterLike, targetPath = '/') {
  try {
    await signOut(auth);
  } catch {
    // Still clear local session even if Firebase sign out fails.
  }

  clearAuthSession();
  router.push(targetPath);
}