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

  const navItemsWorkspace = [
    { href: '/admin/dashboard', icon: '📊', label: 'Dashboard', id: 'dashboard' },
    { href: '/admin/residents', icon: '👥', label: 'Residents', id: 'residents' },
    { href: '/admin/payments', icon: '💳', label: 'Payments', id: 'payments' },
    { href: '/admin/messages', icon: '💬', label: 'Messages', id: 'messages' },
    { href: '/admin/announcements', icon: '📢', label: 'Announcements', id: 'announcements' },
  ];

  const navItemsUtilities = [
    { href: '/admin/qr-scanner', icon: '📱', label: 'QR Scanner', id: 'qr-scanner' },
    { href: '/admin/reports', icon: '📑', label: 'Reports', id: 'reports' },
    { href: '/admin/billing', icon: '🧾', label: 'Billing', id: 'billing' },
    { href: '/admin/payments/manual', icon: '💵', label: 'Manual Payment', id: 'manual-payment' },
    { href: '/admin/audit-logs', icon: '📝', label: 'Audit Log', id: 'audit-logs' },
  ];

  const navItems = [...navItemsWorkspace, ...navItemsUtilities];

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
            <img src="/lhhoa-logo.png" alt="LH-Connect Logo" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '50%', backgroundColor: '#ffffff' }} />
            <div>
              <div className={styles.logoText}>LH-Connect</div>
              <div className={styles.logoSubtext}>Admin Panel</div>
            </div>
          </div>
          <button className={styles.closeMobileSidebar} onClick={() => setIsSidebarOpen(false)}>
            ✕
          </button>
        </div>

        <div className={styles.scrollableNav}>
          <nav className={styles.nav}>
            <div className={styles.sectionHeader}>WORKSPACE</div>
            {navItemsWorkspace.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
              >
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            ))}

            <div className={styles.sectionHeader} style={{ marginTop: '16px' }}>SYSTEM UTILITIES</div>
            {navItemsUtilities.map((item) => (
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
        </div>

        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatarSidebar}>A</div>
            <div className={styles.userNameBlock}>
              <span className={styles.userName}>Administrator Account</span>
              <span className={styles.userRole}>System Operator</span>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <span></span> <span className={styles.navLabel}>Log Out</span>
          </button>
        </div>
        <ConfirmationModal
          isOpen={isLogoutModalOpen}
          title="Logout Confirmation"
          message="Are you sure you want to logout?"
          confirmText="Logout"
          cancelText="Cancel"
          isDangerous={false}
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
          </div>
        </header>

        <div className={styles.content}>
          {children}
        </div>
      </main>
    </div>
  );
}
