'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import UnreadMessagesBadge from '@/app/components/UnreadMessagesBadge';
import { logoutAndRedirect } from '@/lib/auth-session';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import styles from './admin-page.module.css';

interface Resident {
  id: string;
  name: string;
  phase: string;
  block: string;
  lot: string;
  email: string;
  phone: string;
  status: 'Active' | 'Inactive' | 'Delinquent';
  balance: number;
  createdAt?: string;
}

export default function AdminResidents() {
  const router = useRouter();
  useAuthPageshow('admin');
  const [isLoading, setIsLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('residents');
  const [searchTerm, setSearchTerm] = useState('');
  const [allResidents, setAllResidents] = useState<Resident[]>([]);
  const [filteredResidents, setFilteredResidents] = useState<Resident[]>([]);

  const totalResidents = allResidents.length;
  const activeCount = allResidents.filter((resident) => resident.status === 'Active').length;
  const delinquentCount = allResidents.filter((resident) => resident.status === 'Delinquent').length;
  const newThisMonth = allResidents.filter((resident) => {
    if (!resident.createdAt) {
      return false;
    }

    const createdDate = new Date(resident.createdAt);
    const now = new Date();
    return (
      createdDate.getMonth() === now.getMonth() &&
      createdDate.getFullYear() === now.getFullYear()
    );
  }).length;

  useEffect(() => {
    const loadResidents = async () => {
      try {
        const payload = await apiCall('/api/residents');
        const residents = (payload.residents ?? []).map((resident: any, index: number) => {
          const balance = Number(resident.balance ?? 0);
          const status: Resident['status'] =
            resident.status === 'Inactive'
              ? 'Inactive'
              : balance > 0
                ? 'Delinquent'
                : 'Active';

          return {
            id: resident.id ?? `R${String(index + 1).padStart(3, '0')}`,
            name: resident.fullName ?? resident.name ?? 'Unknown Resident',
            phase: resident.phase ?? 'Phase N/A',
            block: resident.block ?? '-',
            lot: resident.lot ?? '-',
            email: resident.email ?? '-',
            phone: resident.phone ?? '-',
            status,
            balance,
            createdAt: resident.createdAt,
          } as Resident;
        });

        setAllResidents(residents);
        setFilteredResidents(residents);
      } catch (error) {
        console.error('Failed to load residents:', error);
        setAllResidents([]);
        setFilteredResidents([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadResidents();
  }, [router]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term) {
      setFilteredResidents(allResidents);
    } else {
      const filtered = allResidents.filter(resident =>
        resident.name.toLowerCase().includes(term.toLowerCase()) ||
        resident.id.toLowerCase().includes(term.toLowerCase()) ||
        `${resident.phase} Block ${resident.block}`.toLowerCase().includes(term.toLowerCase()) ||
        resident.phone.includes(term)
      );
      setFilteredResidents(filtered);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logoutAndRedirect(router, '/');
    }
  };

  if (isLoading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🏠</span>
            <div>
              <div className={styles.logoText}>LH-Connect</div>
              <div className={styles.logoSubtext}>Admin</div>
            </div>
          </div>
        </div>
        <nav className={styles.nav}>
          <Link href="/admin/dashboard" className={styles.navItem} onClick={() => setActiveNav('dashboard')}>
            <span>📊</span> Dashboard
          </Link>
          <Link href="/admin/residents" className={`${styles.navItem} ${activeNav === 'residents' ? styles.active : ''}`} onClick={() => setActiveNav('residents')}>
            <span>👥</span> Residents
          </Link>
          <Link href="/admin/payments" className={styles.navItem} onClick={() => setActiveNav('payments')}>
            <span>💳</span> Payments
          </Link>
          <Link href="/admin/qr-scanner" className={styles.navItem} onClick={() => setActiveNav('qr-scanner')}>
            <span>📱</span> QR Scanner
          </Link>
          <Link href="/admin/messages" className={styles.navItem} onClick={() => setActiveNav('messages')}>
            <span>💬</span> Messages
            <UnreadMessagesBadge />
          </Link>
          <Link href="/admin/reports" className={styles.navItem} onClick={() => setActiveNav('reports')}>
            <span>📑</span> Reports
          </Link>
        </nav>
        <button className={styles.logoutBtn} onClick={handleLogout}>🚪 Logout</button>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.pageTitle}>Digital Resident Registry</h1>
          <div className={styles.headerRight}>
            <span className={styles.userLabel}>Admin User</span>
            <div className={styles.userAvatar}>👤</div>
          </div>
        </header>

        {/* Stat Cards */}
        <div className={styles.statsGrid}>
          <div className={styles.registryStat}>
            <div className={styles.registryStatLabel}>Total Residents</div>
            <div className={styles.registryStatValue}>{totalResidents}</div>
          </div>
          <div className={styles.registryStat}>
            <div className={styles.registryStatLabel}>Active</div>
            <div className={styles.registryStatValue} style={{ color: '#4caf50' }}>{activeCount}</div>
          </div>
          <div className={styles.registryStat}>
            <div className={styles.registryStatLabel}>Delinquent</div>
            <div className={styles.registryStatValue} style={{ color: '#f44336' }}>{delinquentCount}</div>
          </div>
          <div className={styles.registryStat}>
            <div className={styles.registryStatLabel}>New This Month</div>
            <div className={styles.registryStatValue} style={{ color: '#2196f3' }}>{newThisMonth}</div>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.searchSection}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by name, block/lot, or ID..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <button className={styles.addBtn}>+ Add Resident</button>
          </div>
          
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Block/Lot</th>
                  <th>Status</th>
                  <th>Balance</th>
                  <th>Contact</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredResidents.map((resident) => (
                  <tr key={resident.id}>
                    <td>
                      <span className={styles.idBadge}>{resident.id}</span>
                    </td>
                    <td className={styles.nameTd}>{resident.name}</td>
                    <td><span className={styles.phaseBadge}>{resident.phase}</span> Blk {resident.block} Lot {resident.lot}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[resident.status.toLowerCase()]}`}>
                        {resident.status}
                      </span>
                    </td>
                    <td className={`${styles.balanceTd} ${resident.balance > 0 ? styles.debit : ''}`}>
                      ₱{resident.balance}
                    </td>
                    <td>{resident.phone}</td>
                    <td className={styles.actionsTd}>
                      <button className={styles.iconBtn} title="View">📋</button>
                      <button className={styles.iconBtn} title="Edit">✏️</button>
                      <button className={styles.iconBtn} title="Delete">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
