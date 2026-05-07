'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export function useAuthPageshow(expectedRole: 'admin' | 'resident') {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handlePageShow = async () => {
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const userRole = localStorage.getItem('userRole');

      if (!isAuthenticated || userRole !== expectedRole) {
        router.replace('/login');
        return;
      }

      if (expectedRole === 'resident') {
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
      }
    };

    void handlePageShow();
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [router, expectedRole, pathname]);
}
