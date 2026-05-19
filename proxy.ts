import { NextRequest, NextResponse } from 'next/server';

function redirectTo(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = '';
  return NextResponse.redirect(url);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const force = request.nextUrl.searchParams.get('force') === 'true';
  
  const sessionCookie = request.cookies.get('lh_session')?.value;
  const roleCookie = request.cookies.get('lh_role')?.value;

  const isAuthenticated = !!sessionCookie;
  const role = roleCookie as 'admin' | 'resident' | undefined;

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

  if (isAuthPage && isAuthenticated && !force) {
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
