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

type PaymentRecord = {
  amount?: number;
  paymentAmount?: number;
  method?: string;
  status?: string;
  createdAt?: string | number | { toMillis?: () => number; toDate?: () => Date };
};

type ResidentRecord = {
  id: string;
  balance?: number;
  phase?: string;
};

type SubmissionRecord = {
  status?: string;
};

type ChartPoint = {
  month: string;
  value: number;
};

type PiePoint = {
  name: string;
  value: number;
};

type BarPoint = {
  phase: string;
  delinquent: number;
};

const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AdminDashboard() {
  const router = useRouter();
  useAuthPageshow('admin');
  const [isLoading, setIsLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [userName, setUserName] = useState('Admin User');

  const [statCards, setStatCards] = useState<StatCard[]>([
    {
      title: "Today's Collections",
      value: '₱0',
      change: 'Loading live data',
      changeType: 'neutral',
      icon: '💵',
    },
    {
      title: 'Monthly Total',
      value: '₱0',
      change: 'Loading live data',
      changeType: 'neutral',
      icon: '📊',
    },
    {
      title: 'Pending Verifications',
      value: '0',
      change: 'Loading live data',
      changeType: 'neutral',
      icon: '⏳',
    },
    {
      title: 'Delinquent Accounts',
      value: '0',
      change: 'Loading live data',
      changeType: 'neutral',
      icon: '⚠️',
    },
  ]);

  const [collectionTrendsData, setCollectionTrendsData] = useState<ChartPoint[]>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<PiePoint[]>([]);
  const [delinquencyData, setDelinquencyData] = useState<BarPoint[]>([]);

  const COLORS = ['#1B2A4A', '#4caf50', '#ff9800', '#9c27b0'];

  const formatAmount = (amount: number) => `₱${amount.toLocaleString()}`;

  const toMillis = (value: PaymentRecord['createdAt']) => {
    if (!value) return 0;
    if (typeof value === 'object') {
      if (typeof value.toMillis === 'function') return value.toMillis();
      if (typeof value.toDate === 'function') return value.toDate().getTime();
      return 0;
    }
    if (typeof value === 'number') return value;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [profilePayload, residentsPayload, paymentsPayload, submissionsPayload] = await Promise.all([
          apiCall('/api/auth/profile'),
          apiCall('/api/residents'),
          apiCall('/api/payments'),
          apiCall('/api/payment-submissions'),
        ]);

        setUserName(profilePayload.user?.fullName ?? 'Admin User');

        const residents = (residentsPayload.residents ?? []) as ResidentRecord[];
        const payments = (paymentsPayload.payments ?? []) as PaymentRecord[];
        const submissions = (submissionsPayload.submissions ?? []) as SubmissionRecord[];

        const delinquentCount = residents.filter((resident) => Number(resident.balance ?? 0) > 0).length;
        const pendingVerifications = submissions.filter((submission) => submission.status === 'Pending').length;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const todayCollections = payments.reduce((sum, payment) => {
          const amount = Number(payment.amount ?? payment.paymentAmount ?? 0);
          if (!Number.isFinite(amount)) return sum;
          if (toMillis(payment.createdAt) >= todayStart) return sum + amount;
          return sum;
        }, 0);

        const monthlyTotal = payments.reduce((sum, payment) => {
          const amount = Number(payment.amount ?? payment.paymentAmount ?? 0);
          const createdAt = toMillis(payment.createdAt);
          if (!Number.isFinite(amount) || !createdAt) return sum;
          const createdDate = new Date(createdAt);
          if (createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear) {
            return sum + amount;
          }
          return sum;
        }, 0);

        const previousMonth = (currentMonth + 11) % 12;
        const previousMonthCollections = payments.reduce((sum, payment) => {
          const amount = Number(payment.amount ?? payment.paymentAmount ?? 0);
          const createdAt = toMillis(payment.createdAt);
          if (!Number.isFinite(amount) || !createdAt) return sum;
          const createdDate = new Date(createdAt);
          if (createdDate.getMonth() === previousMonth && createdDate.getFullYear() === (currentMonth === 0 ? currentYear - 1 : currentYear)) {
            return sum + amount;
          }
          return sum;
        }, 0);

        const collectionTrendMap = new Map<string, number>();
        payments.forEach((payment) => {
          const amount = Number(payment.amount ?? payment.paymentAmount ?? 0);
          const createdAt = toMillis(payment.createdAt);
          if (!Number.isFinite(amount) || !createdAt) return;
          const createdDate = new Date(createdAt);
          const label = MONTH_ORDER[createdDate.getMonth()];
          collectionTrendMap.set(label, (collectionTrendMap.get(label) ?? 0) + amount);
        });

        const trendData = MONTH_ORDER
          .map((month) => ({ month, value: collectionTrendMap.get(month) ?? 0 }))
          .filter((entry) => entry.value > 0);

        const paymentMethodMap = new Map<string, number>();
        payments.forEach((payment) => {
          const amount = Number(payment.amount ?? payment.paymentAmount ?? 0);
          const method = payment.method?.trim() || 'Unknown';
          if (!Number.isFinite(amount)) return;
          paymentMethodMap.set(method, (paymentMethodMap.get(method) ?? 0) + amount);
        });

        const methodData = Array.from(paymentMethodMap.entries()).map(([name, value]) => ({ name, value }));

        const phaseMap = new Map<string, number>();
        residents.forEach((resident) => {
          if (Number(resident.balance ?? 0) <= 0) return;
          const phase = resident.phase || 'Unknown';
          phaseMap.set(phase, (phaseMap.get(phase) ?? 0) + 1);
        });

        const phaseData = Array.from(phaseMap.entries())
          .map(([phase, delinquent]) => ({ phase, delinquent }))
          .sort((left, right) => left.phase.localeCompare(right.phase));

        setCollectionTrendsData(trendData);
        setPaymentMethodData(methodData.length > 0 ? methodData : [{ name: 'No payments yet', value: 1 }]);
        setDelinquencyData(phaseData.length > 0 ? phaseData : [{ phase: 'No data', delinquent: 0 }]);

        setStatCards((previousCards) => [
          {
            ...previousCards[0],
            value: formatAmount(todayCollections),
            change: todayCollections > 0 ? 'Live collections today' : 'No collections today',
            changeType: todayCollections > 0 ? 'positive' : 'neutral',
          },
          {
            ...previousCards[1],
            value: formatAmount(monthlyTotal),
            change: previousMonthCollections > 0
              ? `${(((monthlyTotal - previousMonthCollections) / previousMonthCollections) * 100).toFixed(1)}% vs last month`
              : 'Compared with last month',
            changeType: monthlyTotal >= previousMonthCollections ? 'positive' : 'negative',
          },
          {
            ...previousCards[2],
            value: `${pendingVerifications}`,
            change: pendingVerifications > 0 ? 'Requires action' : 'No pending verifications',
            changeType: pendingVerifications > 0 ? 'neutral' : 'positive',
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
            onClick={(e) => { e.preventDefault(); setActiveNav('dashboard'); router.push('/admin/dashboard'); }}
          >
            <span className={styles.navIcon}>📊</span>
            <span className={styles.navLabel}>Dashboard</span>
          </Link>
          <Link 
            href="/admin/residents" 
            className={`${styles.navItem} ${activeNav === 'residents' ? styles.active : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveNav('residents'); router.push('/admin/residents'); }}
          >
            <span className={styles.navIcon}>👥</span>
            <span className={styles.navLabel}>Residents</span>
          </Link>
          <Link 
            href="/admin/payments" 
            className={`${styles.navItem} ${activeNav === 'payments' ? styles.active : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveNav('payments'); router.push('/admin/payments'); }}
          >
            <span className={styles.navIcon}>💳</span>
            <span className={styles.navLabel}>Payments</span>
          </Link>
          <Link 
            href="/admin/qr-scanner" 
            className={`${styles.navItem} ${activeNav === 'qr-scanner' ? styles.active : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveNav('qr-scanner'); router.push('/admin/qr-scanner'); }}
          >
            <span className={styles.navIcon}>📱</span>
            <span className={styles.navLabel}>QR Scanner</span>
          </Link>
          <Link 
            href="/admin/messages" 
            className={`${styles.navItem} ${activeNav === 'messages' ? styles.active : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveNav('messages'); router.push('/admin/messages'); }}
          >
            <span className={styles.navIcon}>💬</span>
            <span className={styles.navLabel}>Messages</span>
            <UnreadMessagesBadge />
          </Link>
          <Link 
            href="/admin/reports" 
            className={`${styles.navItem} ${activeNav === 'reports' ? styles.active : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveNav('reports'); router.push('/admin/reports'); }}
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
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.name} ₱${Number(entry.value).toLocaleString()}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₱${Number(value).toLocaleString()}`} />
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
