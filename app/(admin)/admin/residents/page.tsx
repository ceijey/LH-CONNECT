'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
}

export default function AdminResidents() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('residents');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredResidents, setFilteredResidents] = useState<Resident[]>([]);

  const allResidents: Resident[] = [
    { id: 'R001', name: 'Juan Dela Cruz', phase: 'Phase 1', block: '1', lot: '15', email: 'juan@lh-connect.com', phone: '09171234567', status: 'Active', balance: 0 },
    { id: 'R002', name: 'Maria Santos', phase: 'Phase 2', block: '2', lot: '8', email: 'maria@lh-connect.com', phone: '09181234567', status: 'Active', balance: 500 },
    { id: 'R003', name: 'Pedro Garcia', phase: 'Phase 2', block: '3', lot: '12', email: 'pedro@lh-connect.com', phone: '09191234567', status: 'Delinquent', balance: 1500 },
    { id: 'R004', name: 'Rosa Reyes', phase: 'Phase 1', block: '4', lot: '5', email: 'rosa@example.com', phone: '09201234567', status: 'Active', balance: 1000 },
    { id: 'R005', name: 'Luis Lopez', phase: 'Phase 1', block: '1', lot: '22', email: 'luis@example.com', phone: '09211234567', status: 'Active', balance: 0 },
    { id: 'R006', name: 'Ana Gomez', phase: 'Phase 3', block: '2', lot: '3', email: 'ana@example.com', phone: '09221234567', status: 'Active', balance: 0 },
    { id: 'R007', name: 'Carlos Mendoza', phase: 'Phase 3', block: '3', lot: '19', email: 'carlos@example.com', phone: '09231234567', status: 'Active', balance: 1000 },
    { id: 'R008', name: 'Lucia Torres', phase: 'Phase 1', block: '1', lot: '8', email: 'lucia@example.com', phone: '09241234567', status: 'Active', balance: 2000 },
    { id: 'R009', name: 'Miguel Diaz', phase: 'Phase 2', block: '4', lot: '14', email: 'miguel@example.com', phone: '09251234567', status: 'Delinquent', balance: 500 },
    { id: 'R010', name: 'Sofia Ruiz', phase: 'Phase 3', block: '2', lot: '20', email: 'sofia@example.com', phone: '09261234567', status: 'Active', balance: 0 },
  ];

  const totalResidents = 128;
  const activeCount = 111;
  const delinquentCount = 17;
  const newThisMonth = 3;

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const userRole = localStorage.getItem('userRole');

    if (!isAuthenticated || userRole !== 'admin') {
      router.push('/login');
    } else {
      setIsLoading(false);
      setFilteredResidents(allResidents);
    }
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

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userName');
      localStorage.removeItem('userRole');
      router.push('/');
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
