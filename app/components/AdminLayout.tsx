'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import { logoutAndRedirect } from '@/lib/auth-session';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import UnreadMessagesBadge from './UnreadMessagesBadge';
import styles from './AdminLayout.module.css';

interface AdminLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export default function AdminLayout({ children, pageTitle }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  useAuthPageshow('admin');
  const [userName, setUserName] = useState('Eliza');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const payload = await apiCall('/api/auth/profile');
        // The user specifically requested "Eliza" profile, 
        // so we use it as a primary or fallback.
        setUserName(payload.user?.fullName || 'Eliza');
      } catch (error) {
        console.error('Failed to load profile:', error);
        setUserName('Eliza');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logoutAndRedirect(router, '/');
    }
  };

  const navItems = [
    { href: '/admin/dashboard', icon: '📊', label: 'Dashboard', id: 'dashboard' },
    { href: '/admin/residents', icon: '👥', label: 'Residents', id: 'residents' },
    { href: '/admin/payments', icon: '💳', label: 'Payments', id: 'payments' },
    { href: '/admin/qr-scanner', icon: '📱', label: 'QR Scanner', id: 'qr-scanner' },
    { href: '/admin/messages', icon: '💬', label: 'Messages', id: 'messages', showBadge: true },
    { href: '/admin/reports', icon: '📑', label: 'Reports', id: 'reports' },
  ];

  const getActiveTitle = () => {
    if (pageTitle) return pageTitle;
    const activeItem = navItems.find(item => pathname === item.href);
    return activeItem ? activeItem.label : 'Admin Portal';
  };

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🏠</span>
            <div>
              <div className={styles.logoText}>LH-Connect</div>
              <div className={styles.logoSubtext}>Admin Panel</div>
            </div>
          </div>
        </div>
        
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <Link 
              key={item.href}
              href={item.href} 
              className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
              {item.showBadge && <UnreadMessagesBadge />}
            </Link>
          ))}
        </nav>
        
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <span>🚪</span> <span className={styles.navLabel}>Logout</span>
        </button>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.pageTitle}>{getActiveTitle()}</h1>
          <div className={styles.headerRight}>
            <span className={styles.userLabel}>{userName}</span>
            <div className={styles.userAvatar}>👤</div>
          </div>
        </header>
        
        <div className={styles.content}>
          {children}
        </div>
      </main>
    </div>
  );
}
