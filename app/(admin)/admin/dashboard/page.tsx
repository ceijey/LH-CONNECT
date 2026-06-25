'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import ConfirmationModal from '@/app/components/ConfirmationModal';
import { apiCall } from '@/lib/api-client';
import { logoutAndRedirect } from '@/lib/auth-session';
import styles from './admin-dashboard.module.css';
import Skeleton from '@/app/components/Skeleton';

interface StatCard {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: string;
  accentColor: string;
  bgColor: string;
}

const COLORS = ['#1B2A4A', '#4caf50', '#ff9800', '#9c27b0'];

const ALLOCATION_DATA = [
  { name: 'Maintenance', value: 35 },
  { name: 'Security', value: 25 },
  { name: 'Reserve', value: 20 },
  { name: 'Utilities', value: 20 },
];

const QUICK_ACTIONS = [
  { href: '/admin/residents', icon: '👥', label: 'Residents' },
  { href: '/admin/payments', icon: '💳', label: 'Payments' },
  { href: '/admin/billing', icon: '🧾', label: 'Billing' },
  { href: '/admin/reports', icon: '📑', label: 'Reports' },
  { href: '/admin/messages', icon: '💬', label: 'Messages' },
  { href: '/admin/audit-logs', icon: '📝', label: 'Audit Log' },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [userName, setUserName] = useState('Admin');
  const [collectionTrendsData, setCollectionTrendsData] = useState<{ month: string; value: number }[]>([]);
  const [delinquencyData, setDelinquencyData] = useState<{ phase: string; delinquent: number }[]>([]);

  const [statCards, setStatCards] = useState<StatCard[]>([
    { title: "Today's Collections", value: '₱0', change: 'Live from system', changeType: 'positive', icon: '💵', accentColor: '#4caf50', bgColor: '#e8f5e9' },
    { title: 'Monthly Total', value: '₱0', change: '0% collected', changeType: 'positive', icon: '📊', accentColor: '#2196f3', bgColor: '#e3f2fd' },
    { title: 'Pending Verifications', value: '0', change: 'No action needed', changeType: 'neutral', icon: '⏳', accentColor: '#ff9800', bgColor: '#fff3e0' },
    { title: 'Delinquent Accounts', value: '0', change: 'All clear', changeType: 'positive', icon: '⚠️', accentColor: '#f44336', bgColor: '#ffebee' },
  ]);

  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [profilePayload, dashboardPayload] = await Promise.all([
          apiCall('/api/auth/profile'),
          apiCall('/api/dashboard'),
        ]);

        setUserName(profilePayload.user?.fullName ?? 'Admin');

        const { stats, trends, delinquencyByPhase } = dashboardPayload;
        setCollectionTrendsData(trends);
        setDelinquencyData(delinquencyByPhase);

        setStatCards([
          {
            title: "Today's Collections",
            value: `₱${stats.todayCollections.toLocaleString()}`,
            change: 'Live from system',
            changeType: 'positive',
            icon: '💵',
            accentColor: '#4caf50',
            bgColor: '#e8f5e9',
          },
          {
            title: 'Monthly Total',
            value: `₱${stats.monthlyTotal.toLocaleString()}`,
            change: `${stats.totalResidents > 0 ? ((stats.monthlyTotal / (stats.totalResidents * 400)) * 100).toFixed(0) : 0}% collected`,
            changeType: 'positive',
            icon: '📊',
            accentColor: '#2196f3',
            bgColor: '#e3f2fd',
          },
          {
            title: 'Pending Verifications',
            value: `${stats.pendingVerifications}`,
            change: stats.pendingVerifications > 0 ? 'Requires action' : 'No action needed',
            changeType: stats.pendingVerifications > 0 ? 'negative' : 'neutral',
            icon: '⏳',
            accentColor: '#ff9800',
            bgColor: '#fff3e0',
          },
          {
            title: 'Delinquent Accounts',
            value: `${stats.delinquentCount}`,
            change: stats.delinquentCount > 0 ? 'Pending payments' : 'All clear',
            changeType: stats.delinquentCount > 0 ? 'negative' : 'positive',
            icon: '⚠️',
            accentColor: '#f44336',
            bgColor: '#ffebee',
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

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await logoutAndRedirect(router, '/login');
  };

  if (isLoading) {
    return (
      <div className={styles.dashboardWrapper}>
        <Skeleton height="100px" width="100%" borderRadius="16px" />
        <section className={styles.statsGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.statCard}>
              <Skeleton height="44px" width="44px" variant="circle" />
              <Skeleton height="1rem" width="60%" style={{ marginTop: '1rem' }} />
              <Skeleton height="2rem" width="70%" style={{ margin: '0.5rem 0' }} />
              <Skeleton height="1.5rem" width="60%" borderRadius="20px" />
            </div>
          ))}
        </section>
        <div className={styles.chartsGrid}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={styles.chartCard}>
              <Skeleton height="1.5rem" width="140px" style={{ marginBottom: '1rem' }} />
              <Skeleton height="280px" width="100%" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <ConfirmationModal
        isOpen={showLogoutModal}
        title="Logout Confirmation"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutModal(false)}
        isDangerous={true}
      />

      <div className={styles.dashboardWrapper}>

        {/* ── Welcome Banner ── */}
        <div className={styles.welcomeBanner}>
          <div className={styles.welcomeText}>
            <h2>Welcome back, {userName} 👋</h2>
            <p>Here's what's happening in Lincoln Heights today.</p>
          </div>
          <span className={styles.welcomeDate}>{today}</span>
        </div>

        {/* ── Stat Cards ── */}
        <section className={styles.statsGrid}>
          {statCards.map((card, index) => (
            <div key={index} className={styles.statCard}>
              <div className={styles.statCardAccent} style={{ background: card.accentColor }} />
              <div className={styles.statHeader}>
                <div className={styles.statIconWrapper} style={{ background: card.bgColor }}>
                  {card.icon}
                </div>
              </div>
              <div className={styles.statTitle}>{card.title}</div>
              <div className={styles.statValue}>{card.value}</div>
              <span className={`${styles.statChange} ${styles[card.changeType]}`}>
                {card.changeType === 'positive' ? '↑' : card.changeType === 'negative' ? '↓' : '•'} {card.change}
              </span>
            </div>
          ))}
        </section>

        {/* ── Charts Row ── */}
        <div className={styles.chartsGrid}>
          {/* Collection Trends */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div>
                <h2 className={styles.chartTitle}>Collection Trends</h2>
                <p className={styles.chartSubtitle}>Monthly fee collection overview</p>
              </div>
              <span className={styles.chartBadge}>Live Data</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={collectionTrendsData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1B2A4A" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1B2A4A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
                <XAxis dataKey="month" stroke="#a0aec0" tick={{ fontSize: 12 }} />
                <YAxis stroke="#a0aec0" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '13px' }}
                  formatter={(value) => [`₱${Number(value ?? 0).toLocaleString()}`, 'Collected']}
                />
                <Area type="monotone" dataKey="value" stroke="#1B2A4A" strokeWidth={2.5} fillOpacity={1} fill="url(#colorValue)" dot={{ r: 4, fill: '#1B2A4A' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Allocation Pie */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div>
                <h2 className={styles.chartTitle}>Fund Allocation</h2>
                <p className={styles.chartSubtitle}>Budget breakdown</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={ALLOCATION_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {ALLOCATION_DATA.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} contentStyle={{ borderRadius: '10px', fontSize: '13px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.allocationList}>
              {ALLOCATION_DATA.map((item, i) => (
                <div key={i} className={styles.allocationItem}>
                  <span className={styles.allocationDot} style={{ background: COLORS[i] }} />
                  <span className={styles.allocationLabel}>{item.name}</span>
                  <span className={styles.allocationValue}>{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom Row ── */}
        <div className={styles.bottomRow}>
          {/* Delinquency Bar Chart */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div>
                <h2 className={styles.chartTitle}>Delinquency by Phase</h2>
                <p className={styles.chartSubtitle}>Overdue accounts per area</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={delinquencyData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
                <XAxis dataKey="phase" stroke="#a0aec0" tick={{ fontSize: 12 }} />
                <YAxis stroke="#a0aec0" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '13px' }}
                />
                <Bar dataKey="delinquent" fill="#f44336" name="Delinquent" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Actions */}
          <div className={styles.quickActions}>
            <h2 className={styles.quickActionsTitle}>Quick Actions</h2>
            <div className={styles.quickActionsGrid}>
              {QUICK_ACTIONS.map((action) => (
                <Link key={action.href} href={action.href} className={styles.quickActionBtn}>
                  <span className={styles.quickActionIcon}>{action.icon}</span>
                  <span className={styles.quickActionLabel}>{action.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
