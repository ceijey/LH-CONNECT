'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export function useAuthPageshow(expectedRole: 'admin' | 'resident') {
  const router = useRouter();
  const pathname = usePathname();
  const initialCheckDoneRef = useRef(false);

  // Initial auth check - runs once on mount
  useEffect(() => {
    if (initialCheckDoneRef.current) return;
    initialCheckDoneRef.current = true;

    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const userRole = localStorage.getItem('userRole');

    if (!isAuthenticated || userRole !== expectedRole) {
      router.replace('/login');
    }
  }, [router, expectedRole]);

  // Separate effect for resident approval status (runs on pathname changes)
  useEffect(() => {
    if (expectedRole !== 'resident') return;

    const checkApprovalStatus = async () => {
      try {
        const response = await fetch('/api/auth/profile', { credentials: 'include' });

        if (!response.ok) {
          router.replace('/login');
          return;
        }

        const payload = await response.json();
        const accountStatus = payload.user?.approvalStatus === 'Pending' ? 'Pending' : 'Approved';
        localStorage.setItem('accountStatus', accountStatus);

        if (accountStatus === 'Pending' && pathname !== '/pending-approval') {
          router.replace('/pending-approval');
        }
      } catch {
        router.replace('/login');
      }
    };

    checkApprovalStatus();
    window.addEventListener('pageshow', checkApprovalStatus);
    return () => window.removeEventListener('pageshow', checkApprovalStatus);
  }, [router, expectedRole, pathname]);
}
