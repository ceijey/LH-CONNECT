'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import { logoutAndRedirect } from '@/lib/auth-session';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import ConfirmationModal from './ConfirmationModal';
import AdminNotifications from './AdminNotifications';
import styles from './AdminLayout.module.css';

interface AdminLayoutProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export default function AdminLayout({ children, pageTitle }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  useAuthPageshow('admin');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('Admin');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const payload = await apiCall('/api/auth/profile');
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

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    // show modal instead of native confirm
    setIsLogoutModalOpen(true);
  };

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const confirmLogout = async () => {
    setIsLogoutModalOpen(false);
    await logoutAndRedirect(router, '/login');
  };

  const cancelLogout = () => {
    setIsLogoutModalOpen(false);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const navItems = [
    { href: '/admin/dashboard', icon: '📊', label: 'Dashboard', id: 'dashboard' },
    { href: '/admin/residents', icon: '👥', label: 'Residents', id: 'residents' },
    { href: '/admin/payments', icon: '💳', label: 'Payments', id: 'payments' },
    { href: '/admin/qr-scanner', icon: '📱', label: 'QR Scanner', id: 'qr-scanner' },
    { href: '/admin/messages', icon: '💬', label: 'Messages', id: 'messages' },
    { href: '/admin/announcements', icon: '📢', label: 'Announcements', id: 'announcements' },
    { href: '/admin/reports', icon: '📑', label: 'Reports', id: 'reports' },
    { href: '/admin/payments/manual', icon: '💵', label: 'Manual Payment', id: 'manual-payment' },
  ];

  const getActiveTitle = () => {
    if (pageTitle) return pageTitle;
    const activeItem = navItems.find(item => pathname === item.href);
    return activeItem ? activeItem.label : 'Admin Portal';
  };

  return (
    <div className={styles.container}>
      {/* Sidebar Backdrop for Mobile */}
      {isSidebarOpen && (
        <div className={styles.backdrop} onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''} no-print`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🏠</span>
            <div>
              <div className={styles.logoText}>LH-Connect</div>
              <div className={styles.logoSubtext}>Admin Panel</div>
            </div>
          </div>
          <button className={styles.closeMobileSidebar} onClick={() => setIsSidebarOpen(false)}>
            ✕
          </button>
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
            </Link>
          ))}
        </nav>
        
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <span>🚪</span> <span className={styles.navLabel}>Logout</span>
        </button>
        <ConfirmationModal
          isOpen={isLogoutModalOpen}
          title="Logout Confirmation"
          message="Are you sure you want to logout?"
          confirmText="Logout"
          cancelText="Cancel"
          isDangerous={true}
          onConfirm={confirmLogout}
          onCancel={cancelLogout}
        />
      </aside>

      <main className={styles.main}>
        <header className={`${styles.header} no-print`}>
          <div className={styles.headerLeft}>
            <button className={styles.hamburger} onClick={toggleSidebar}>
              ☰
            </button>
            <h1 className={styles.pageTitle}>{getActiveTitle()}</h1>
          </div>
          <div className={styles.headerRight}>
            <AdminNotifications />
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
