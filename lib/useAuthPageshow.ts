'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useAuthPageshow(expectedRole: 'admin' | 'resident') {
  const router = useRouter();

  useEffect(() => {
    const handlePageShow = () => {
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const userRole = localStorage.getItem('userRole');

      if (!isAuthenticated || userRole !== expectedRole) {
        router.replace('/login');
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [router, expectedRole]);
}
