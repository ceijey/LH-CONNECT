import { NextRequest, NextResponse } from 'next/server';

function redirectTo(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = '';
  return NextResponse.redirect(url);
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sessionCookie = request.cookies.get('lh_session')?.value;
  const isAuthenticated = Boolean(sessionCookie);
  const role = request.cookies.get('lh_role')?.value;

  const isAdminRoute = pathname.startsWith('/admin');
  const isResidentRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const isAuthPage = pathname === '/login' || pathname === '/forgot-password';

  if (isAdminRoute) {
    if (!isAuthenticated) {
      return redirectTo(request, '/login');
    }

    if (role !== 'admin') {
      return redirectTo(request, role === 'resident' ? '/dashboard' : '/login');
    }
  }

  if (isResidentRoute) {
    if (!isAuthenticated) {
      return redirectTo(request, '/login');
    }

    if (role !== 'resident') {
      return redirectTo(request, role === 'admin' ? '/admin/dashboard' : '/login');
    }
  }

  if (isAuthPage && isAuthenticated) {
    if (role === 'admin') {
      return redirectTo(request, '/admin/dashboard');
    }

    if (role === 'resident') {
      return redirectTo(request, '/dashboard');
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/dashboard', '/dashboard/:path*', '/login', '/forgot-password'],
};