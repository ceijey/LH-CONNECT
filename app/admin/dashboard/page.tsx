'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';
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
  const [isLoading, setIsLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('dashboard');

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
    { block: 'Block A', delinquent: 2 },
    { block: 'Block B', delinquent: 7 },
    { block: 'Block C', delinquent: 3 },
    { block: 'Block D', delinquent: 5 },
  ];

  const statCards: StatCard[] = [
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
  ];

  const COLORS = ['#1976d2', '#4caf50', '#ff9800', '#9c27b0'];

  useEffect(() => {
    // Check if user is authenticated and is admin
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const userRole = localStorage.getItem('userRole');

    if (!isAuthenticated) {
      router.push('/login');
    } else if (userRole !== 'admin') {
      router.push('/dashboard');
    } else {
      setIsLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userName');
      localStorage.removeItem('userRole');
      router.push('/');
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🏠</span>
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
            <span className={styles.userLabel}>Admin User</span>
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
                    <stop offset="5%" stopColor="#1976d2" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#1976d2" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3f2fd" />
                <XAxis dataKey="month" stroke="#546e7a" />
                <YAxis stroke="#546e7a" />
                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e3f2fd' }} />
                <Area type="monotone" dataKey="value" stroke="#1976d2" fillOpacity={1} fill="url(#colorValue)" />
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
          <h2 className={styles.chartTitle}>Delinquency Heatmap by Block</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={delinquencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3f2fd" />
              <XAxis dataKey="block" stroke="#546e7a" />
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
