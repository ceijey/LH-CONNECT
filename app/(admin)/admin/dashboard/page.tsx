'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
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
}

export default function AdminDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [userName, setUserName] = useState('Admin User');

  const [collectionTrendsData, setCollectionTrendsData] = useState<{ month: string; value: number }[]>([]);
  const [delinquencyData, setDelinquencyData] = useState<{ phase: string; delinquent: number }[]>([]);

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
        const [profilePayload, dashboardPayload] = await Promise.all([
          apiCall('/api/auth/profile'),
          apiCall('/api/dashboard'),
        ]);

        setUserName(profilePayload.user?.fullName ?? 'Admin User');
        
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
          },
          {
            title: 'Monthly Total',
            value: `₱${stats.monthlyTotal.toLocaleString()}`,
            change: `${stats.totalResidents > 0 ? ((stats.monthlyTotal / (stats.totalResidents * 400)) * 100).toFixed(0) : 0}% collected`,
            changeType: 'positive',
            icon: '📊',
          },
          {
            title: 'Pending Verifications',
            value: `${stats.pendingVerifications}`,
            change: 'Requires action',
            changeType: stats.pendingVerifications > 0 ? 'negative' : 'neutral',
            icon: '⏳',
          },
          {
            title: 'Delinquent Accounts',
            value: `${stats.delinquentCount}`,
            change: stats.delinquentCount > 0 ? 'Pending payments' : 'All clear',
            changeType: stats.delinquentCount > 0 ? 'negative' : 'positive',
            icon: '⚠️',
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
    await logoutAndRedirect(router, '/login');
  };

  if (isLoading) {
    return (
      <div>
        {/* Stat Cards Skeleton */}
        <section className={styles.statsGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.statCard}>
              <div className={styles.statHeader}>
                <Skeleton height="1.75rem" width="1.75rem" variant="circle" />
                <Skeleton height="1rem" width="60%" />
              </div>
              <Skeleton height="2rem" width="70%" style={{ margin: '0.75rem 0' }} />
              <Skeleton height="1.875rem" width="65%" borderRadius="6px" />
            </div>
          ))}
        </section>

        {/* Charts Grid Skeleton */}
        <div className={styles.chartsGrid}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={styles.chartCard}>
              <Skeleton height="1.5rem" width="120px" style={{ marginBottom: '1rem' }} />
              <Skeleton height="300px" width="100%" />
            </div>
          ))}
        </div>

        {/* Delinquency Chart Skeleton */}
        <div className={styles.chartCard} style={{ marginTop: '2rem' }}>
          <Skeleton height="1.5rem" width="140px" style={{ marginBottom: '1rem' }} />
          <Skeleton height="300px" width="100%" />
        </div>
      </div>
    );
  }

  return (
    <>
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

          {/* Fund Breakdown (Static for now as no category data) */}
          <div className={styles.chartCard}>
            <h2 className={styles.chartTitle}>Monthly Allocation</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Maintenance', value: 35 },
                    { name: 'Security', value: 25 },
                    { name: 'Reserve', value: 20 },
                    { name: 'Utilities', value: 20 },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name} ${entry.value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[0,1,2,3].map((_, index) => (
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
    </>
  );
}
