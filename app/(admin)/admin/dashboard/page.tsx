'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';
import ConfirmationModal from '@/app/components/ConfirmationModal';
import UnreadMessagesBadge from '@/app/components/UnreadMessagesBadge';
import { apiCall } from '@/lib/api-client';
import { logoutAndRedirect } from '@/lib/auth-session';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import styles from './admin-dashboard.module.css';

interface StatCard {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  useAuthPageshow('admin');
  const [isLoading, setIsLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [userName, setUserName] = useState('Admin User');

  // Chart data
  const collectionTrendsData = [
    { month: 'Aug', value: 45000 },
    { month: 'Sep', value: 52000 },
    { month: 'Oct', value: 48000 },
    { month: 'Nov', value: 55000 },
    { month: 'Dec', value: 58000 },
    { month: 'Jan', value: 62000 },
  ];

  const fundBreakdownData = [
    { name: 'Maintenance', value: 35 },
    { name: 'Security', value: 25 },
    { name: 'Reserve', value: 20 },
    { name: 'Utilities', value: 20 },
  ];

  const delinquencyData = [
    { phase: 'Phase 1', delinquent: 2 },
    { phase: 'Phase 2', delinquent: 7 },
    { phase: 'Phase 3', delinquent: 3 },
    { phase: 'Phase 4', delinquent: 5 },
  ];

  const [statCards, setStatCards] = useState<StatCard[]>([
    {
      title: "Today's Collections",
      value: '₱8,500',
      change: '+12% vs yesterday',
      changeType: 'positive',
      icon: '💵',
    },
    {
      title: 'Monthly Total',
      value: '₱62,000',
      change: '85% collected',
      changeType: 'positive',
      icon: '📊',
    },
    {
      title: 'Pending Verifications',
      value: '12',
      change: 'Requires action',
      changeType: 'neutral',
      icon: '⏳',
    },
    {
      title: 'Delinquent Accounts',
      value: '17',
      change: '-2 from last month',
      changeType: 'positive',
      icon: '⚠️',
    },
  ]);

  const COLORS = ['#1B2A4A', '#4caf50', '#ff9800', '#9c27b0'];

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [profilePayload, residentsPayload] = await Promise.all([
          apiCall('/api/auth/profile'),
          apiCall('/api/residents'),
        ]);

        setUserName(profilePayload.user?.fullName ?? 'Admin User');

        const residents = (residentsPayload.residents ?? []) as Array<{ balance?: number }>;
        const delinquentCount = residents.filter((resident) => Number(resident.balance ?? 0) > 0).length;

        setStatCards((previousCards) => [
          previousCards[0],
          {
            ...previousCards[1],
            value: `₱${residents.length * 500}`,
          },
          {
            ...previousCards[2],
            value: `${residents.length}`,
            change: residents.length > 0 ? 'Live resident records' : 'No resident records yet',
          },
          {
            ...previousCards[3],
            value: `${delinquentCount}`,
            change: delinquentCount > 0 ? 'Residents with pending balance' : 'No delinquent residents',
          },
        ]);
      } catch (error) {
        console.error('Failed to load admin dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await logoutAndRedirect(router, '/');
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <ConfirmationModal
        isOpen={showLogoutModal}
        title="Logout Confirmation"
        message="Are you sure you want to logout? You will be redirected to the login page."
        confirmText="Logout"
        cancelText="Cancel"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutModal(false)}
        isDangerous={true}
      />

      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <Image
              src="/lhhoa-logo.png"
              alt="LHHOA logo"
              width={44}
              height={44}
              className={styles.logoIcon}
              priority
            />
            <div>
              <div className={styles.logoText}>LH-Connect</div>
              <div className={styles.logoSubtext}>Admin Dashboard</div>
            </div>
          </div>
        </div>

        <nav className={styles.nav}>
          <Link 
            href="/admin/dashboard" 
            className={`${styles.navItem} ${activeNav === 'dashboard' ? styles.active : ''}`}
            onClick={() => setActiveNav('dashboard')}
          >
            <span className={styles.navIcon}>📊</span>
            <span className={styles.navLabel}>Dashboard</span>
          </Link>
          <Link 
            href="/admin/residents" 
            className={`${styles.navItem} ${activeNav === 'residents' ? styles.active : ''}`}
            onClick={() => setActiveNav('residents')}
          >
            <span className={styles.navIcon}>👥</span>
            <span className={styles.navLabel}>Residents</span>
          </Link>
          <Link 
            href="/admin/payments" 
            className={`${styles.navItem} ${activeNav === 'payments' ? styles.active : ''}`}
            onClick={() => setActiveNav('payments')}
          >
            <span className={styles.navIcon}>💳</span>
            <span className={styles.navLabel}>Payments</span>
          </Link>
          <Link 
            href="/admin/qr-scanner" 
            className={`${styles.navItem} ${activeNav === 'qr-scanner' ? styles.active : ''}`}
            onClick={() => setActiveNav('qr-scanner')}
          >
            <span className={styles.navIcon}>📱</span>
            <span className={styles.navLabel}>QR Scanner</span>
          </Link>
          <Link 
            href="/admin/messages" 
            className={`${styles.navItem} ${activeNav === 'messages' ? styles.active : ''}`}
            onClick={() => setActiveNav('messages')}
          >
            <span className={styles.navIcon}>💬</span>
            <span className={styles.navLabel}>Messages</span>
            <UnreadMessagesBadge />
          </Link>
          <Link 
            href="/admin/reports" 
            className={`${styles.navItem} ${activeNav === 'reports' ? styles.active : ''}`}
            onClick={() => setActiveNav('reports')}
          >
            <span className={styles.navIcon}>📑</span>
            <span className={styles.navLabel}>Reports</span>
          </Link>
        </nav>

        <button className={styles.logoutBtn} onClick={handleLogout}>
          <span className={styles.navIcon}>🚪</span>
          <span className={styles.navLabel}>Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.pageTitle}>Real Time Financial Dashboard</h1>
          <div className={styles.headerRight}>
            <span className={styles.userLabel}>{userName}</span>
            <div className={styles.userAvatar}>👤</div>
          </div>
        </header>

        {/* Stat Cards */}
        <section className={styles.statsGrid}>
          {statCards.map((card, index) => (
            <div key={index} className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statIcon}>{card.icon}</span>
                <span className={styles.statTitle}>{card.title}</span>
              </div>
              <div className={styles.statValue}>{card.value}</div>
              <div className={`${styles.statChange} ${styles[card.changeType]}`}>
                {card.changeType === 'positive' && '↑'} {card.change}
              </div>
            </div>
          ))}
        </section>

        {/* Charts Grid */}
        <div className={styles.chartsGrid}>
          {/* Collection Trends */}
          <div className={styles.chartCard}>
            <h2 className={styles.chartTitle}>Collection Trends</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={collectionTrendsData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B2A4A" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#1B2A4A" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(27, 42, 74, 0.05)" />
                <XAxis dataKey="month" stroke="#9E9E9E" />
                <YAxis stroke="#9E9E9E" />
                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(27, 42, 74, 0.1)' }} />
                <Area type="monotone" dataKey="value" stroke="#1B2A4A" fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Fund Breakdown */}
          <div className={styles.chartCard}>
            <h2 className={styles.chartTitle}>Fund Breakdown</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={fundBreakdownData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name} ${entry.value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {fundBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Delinquency Heatmap */}
        <div className={styles.chartCard} style={{ marginTop: '2rem' }}>
          <h2 className={styles.chartTitle}>Heatmap by Phase</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={delinquencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3f2fd" />
              <XAxis dataKey="phase" stroke="#546e7a" />
              <YAxis stroke="#546e7a" />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e3f2fd' }} />
              <Bar dataKey="delinquent" fill="#ff5252" name="Delinquent Accounts" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </main>
    </div>
  );
}
