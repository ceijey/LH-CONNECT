'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import Skeleton from '@/app/components/Skeleton';
import ConfirmationModal from '@/app/components/ConfirmationModal';
import ResidentDetailModal from '@/app/components/ResidentDetailModal';
import ResidentEditModal from '@/app/components/ResidentEditModal';
import PaymentHistoryModal from '@/app/components/PaymentHistoryModal';
import BulkImportModal from '@/app/components/BulkImportModal';
import styles from './admin-page.module.css';

function formatResidentId(id: string): string {
  if (!id) return '';
  if (id.startsWith('R-')) return id;

  const numbers = id.replace(/[^0-9]/g, '');
  const letters = id.replace(/[^a-zA-Z]/g, '');

  const numPart = (numbers.substring(0, 4) || '0000').padEnd(4, '0');
  const letterPart = (letters.substring(0, 2) || 'XX').toUpperCase().padEnd(2, 'X');

  return `R-${numPart}-${letterPart}`;
}

interface Resident {
  id: string;
  name: string;
  phase: string;
  block: string;
  lot: string;
  email: string;
  phone: string;
  status: 'Good Standing' | 'Inactive' | 'Delinquent';
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
  balance: number;
  createdAt?: string;
  statements?: any[];
}

export default function AdminResidents() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [allResidents, setAllResidents] = useState<Resident[]>([]);
  const [filteredResidents, setFilteredResidents] = useState<Resident[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: ''
  });
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const totalResidents = allResidents.length;
  const activeCount = allResidents.filter((resident) => resident.status === 'Good Standing').length;
  const delinquentCount = allResidents.filter((resident) => resident.status === 'Delinquent').length;
  const pendingApprovalCount = allResidents.filter((resident) => resident.approvalStatus === 'Pending').length;
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

  const loadResidents = async () => {
    try {
      setIsLoading(true);
      const payload = await apiCall('/api/residents');
      const residents = (payload.residents ?? []).map((resident: any, index: number) => {
        const balance = Number(resident.balance ?? 0);
        const status: Resident['status'] =
          resident.status === 'Inactive'
            ? 'Inactive'
            : balance > 0
              ? 'Delinquent'
              : 'Good Standing';

        return {
          id: resident.id ?? `R${String(index + 1).padStart(3, '0')}`,
          name: resident.fullName ?? resident.name ?? 'Unknown Resident',
          phase: resident.phase ?? 'Phase N/A',
          block: resident.block ?? '-',
          lot: resident.lot ?? '-',
          email: resident.email ?? '-',
          phone: resident.phone ?? '-',
          status,
          approvalStatus: resident.approvalStatus === 'Approved'
            ? 'Approved'
            : resident.approvalStatus === 'Rejected'
              ? 'Rejected'
              : 'Pending',
          balance,
          createdAt: resident.createdAt,
          statements: resident.statements || [],
        } as Resident;
      });

      setAllResidents(residents);
      applyFiltersAndSorting(searchTerm, sortConfig, paymentFilter, residents);
    } catch (error) {
      console.error('Failed to load residents:', error);
      setAllResidents([]);
      setFilteredResidents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadResidents();
  }, []);

  const [sortConfig, setSortConfig] = useState<{ key: keyof Resident; direction: 'asc' | 'desc' } | null>({
    key: 'name',
    direction: 'asc'
  });

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
    applyFiltersAndSorting(term, sortConfig, paymentFilter, allResidents);
  };

  const handleSort = (key: keyof Resident) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    const newSortConfig = { key, direction };
    setSortConfig(newSortConfig);
    setCurrentPage(1);
    applyFiltersAndSorting(searchTerm, newSortConfig, paymentFilter, allResidents);
  };

  const handlePaymentFilter = (filter: 'all' | 'paid' | 'unpaid') => {
    setPaymentFilter(filter);
    setCurrentPage(1);
    applyFiltersAndSorting(searchTerm, sortConfig, filter, allResidents);
  };

  const applyFiltersAndSorting = (term: string, config: typeof sortConfig, payFilter: typeof paymentFilter, source: Resident[]) => {
    const normalizedTerm = term.toLowerCase().trim();
    let result = [...source];

    // Filter
    if (normalizedTerm) {
      result = result.filter(resident => {
        const name = (resident.name || '').toLowerCase();
        const id = (resident.id || '').toLowerCase();
        const address = `${resident.phase || ''} Block ${resident.block || ''}`.toLowerCase();
        const phone = (resident.phone || '');

        return (
          name.includes(normalizedTerm) ||
          id.includes(normalizedTerm) ||
          address.includes(normalizedTerm) ||
          phone.includes(normalizedTerm)
        );
      });
    }

    // Payment Filter
    if (payFilter === 'paid') {
      result = result.filter(resident => resident.balance === 0);
    } else if (payFilter === 'unpaid') {
      result = result.filter(resident => resident.balance > 0);
    }

    // Sort
    if (config) {
      result.sort((a, b) => {
        const aValue = a[config.key];
        const bValue = b[config.key];

        if (aValue === undefined || bValue === undefined) return 0;

        if (aValue < bValue) {
          return config.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return config.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    setFilteredResidents(result);
  };

  const handleConfirmDelete = async () => {
    const { id } = deleteModal;
    setDeleteModal(prev => ({ ...prev, isOpen: false }));
    try {
      await apiCall(`/api/residents/${id}`, { method: 'DELETE' });
      loadResidents();
    } catch (error: any) {
      alert(`Delete failed: ${error.message}`);
    }
  };

  const handleViewDetails = (resident: Resident) => {
    setSelectedResident(resident);
    setSelectedResidentId(resident.id);
    setDetailModalOpen(true);
  };

  const handleEditResident = (resident: Resident) => {
    setSelectedResident(resident);
    setSelectedResidentId(resident.id);
    setEditModalOpen(true);
  };

  const handleEditModalSuccess = () => {
    loadResidents();
  };

  const handleViewHistory = (resident: Resident) => {
    setSelectedResident(resident);
    setSelectedResidentId(resident.id);
    setHistoryModalOpen(true);
  };

  if (isLoading) {
    return (
      <div>
        {/* Stats Grid Skeleton */}
        <div className={styles.statsGrid}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.registryStat}>
              <Skeleton height="0.875rem" width="70%" style={{ marginBottom: '0.75rem' }} />
              <Skeleton height="2rem" width="60%" />
            </div>
          ))}
        </div>

        {/* Search and Table Skeleton */}
        <div className={styles.content}>
          <div className={styles.searchSection}>
            <Skeleton height="40px" style={{ flex: 1 }} />
            <Skeleton height="40px" width="150px" />
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Block/Lot</th>
                  <th>Status</th>
                  <th>Verification</th>
                  <th>Balance</th>
                  <th>Contact</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td>
                      <Skeleton height="1.5rem" width="110px" borderRadius="4px" />
                    </td>
                    <td>
                      <Skeleton height="0.9rem" width="150px" />
                    </td>
                    <td>
                      <div className={styles.blockLot}>
                        <Skeleton height="1rem" width="78px" borderRadius="4px" />
                        <Skeleton height="0.875rem" width="130px" />
                      </div>
                    </td>
                    <td>
                      <Skeleton height="1.5rem" width="86px" borderRadius="20px" />
                    </td>
                    <td>
                      <Skeleton height="1.5rem" width="92px" borderRadius="20px" />
                    </td>
                    <td>
                      <Skeleton height="0.9rem" width="95px" />
                    </td>
                    <td>
                      <Skeleton height="0.9rem" width="120px" />
                    </td>
                    <td className={styles.actionsTd}>
                      <Skeleton height="2rem" width="2rem" borderRadius="4px" />
                      <Skeleton height="2rem" width="2rem" borderRadius="4px" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  const renderSortHeader = (label: string, key: keyof Resident) => {
    const isActive = sortConfig?.key === key;
    return (
      <th onClick={() => handleSort(key)} className={styles.sortableHeader}>
        <div className={styles.headerContent}>
          {label}
          <span className={`${styles.sortIcon} ${isActive ? styles.activeSort : ''}`}>
            {isActive ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
          </span>
        </div>
      </th>
    );
  };

  return (
    <>
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title="Delete Resident"
        message={`Are you sure you want to permanently delete ${deleteModal.name}? This will also remove their login access.`}
        confirmText="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
        isDangerous={true}
      />

      <div className={styles.statsGrid}>
        <div className={styles.registryStat}>
          <div className={styles.registryStatIcon}>👥</div>
          <div className={styles.registryStatInfo}>
            <div className={styles.registryStatLabel}>Total Residents</div>
            <div className={styles.registryStatValue}>{totalResidents}</div>
          </div>
        </div>
        <div className={styles.registryStat}>
          <div className={styles.registryStatIcon} style={{ background: '#dcfce7', color: '#16a34a' }}>✓</div>
          <div className={styles.registryStatInfo}>
            <div className={styles.registryStatLabel}>Good Standing</div>
            <div className={styles.registryStatValue}>{activeCount}</div>
          </div>
        </div>
        <div className={styles.registryStat}>
          <div className={styles.registryStatIcon} style={{ background: '#fee2e2', color: '#dc2626' }}>⚠</div>
          <div className={styles.registryStatInfo}>
            <div className={styles.registryStatLabel}>Delinquent</div>
            <div className={styles.registryStatValue}>{delinquentCount}</div>
          </div>
        </div>
        <div className={styles.registryStat}>
          <div className={styles.registryStatIcon} style={{ background: '#ffedd5', color: '#ea580c' }}>⏳</div>
          <div className={styles.registryStatInfo}>
            <div className={styles.registryStatLabel}>Pending Approval</div>
            <div className={styles.registryStatValue}>{pendingApprovalCount}</div>
          </div>
        </div>
        <div className={styles.registryStat}>
          <div className={styles.registryStatIcon} style={{ background: '#dbeafe', color: '#2563eb' }}>🆕</div>
          <div className={styles.registryStatInfo}>
            <div className={styles.registryStatLabel}>New This Month</div>
            <div className={styles.registryStatValue}>{newThisMonth}</div>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.searchSection}>
          <div style={{ display: 'flex', gap: '0.75rem', flex: 1, maxWidth: '600px' }}>
            <div className={styles.searchWrapper}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search by name, block/lot, or ID..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <select
              className={styles.searchInput}
              style={{ width: 'auto', paddingLeft: '16px', fontWeight: 600, color: '#0f172a' }}
              value={paymentFilter}
              onChange={(e) => handlePaymentFilter(e.target.value as 'all' | 'paid' | 'unpaid')}
            >
              <option value="all">All Payments</option>
              <option value="paid">Fully Paid</option>
              <option value="unpaid">With Balance</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className={styles.outlineBtn}
              onClick={() => setImportModalOpen(true)}
            >
              📥 Import CSV
            </button>
            <button className={styles.addBtn} onClick={() => router.push('/admin/residents/new')}>
              <span>+</span> Add Resident
            </button>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Monthly Dues - Table View</h2>
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '4px 0 0 0' }}>Overview of all monthly dues payments for {new Date().getFullYear()}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#dcfce7', border: '1px solid #bbf7d0' }}></span>
                  <span style={{ color: '#166534' }}>Paid</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#fee2e2', border: '1px solid #fecaca' }}></span>
                  <span style={{ color: '#991b1b' }}>Unpaid</span>
                </div>
              </div>
            </div>
            <table className={styles.table} style={{ minWidth: '1000px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 14px', background: '#f8fafc' }}>Phase</th>
                  <th style={{ padding: '12px 14px', background: '#f8fafc' }}>Block</th>
                  <th style={{ padding: '12px 14px', background: '#f8fafc' }}>Lot</th>
                  <th style={{ padding: '12px 14px', background: '#f8fafc' }}>Owner</th>
                  <th style={{ padding: '12px 14px', background: '#f8fafc', cursor: 'pointer' }} onClick={() => handleSort('balance')}>
                    Past Due {sortConfig?.key === 'balance' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                    <th key={m} style={{ padding: '12px 14px', background: '#f8fafc' }}>{m.substring(0, 3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredResidents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((resident) => {
                  const pastDue = resident.balance;
                  return (
                    <tr key={resident.id}>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{resident.phase}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{resident.block}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{resident.lot}</td>
                      <td style={{ fontWeight: 500, color: '#334155' }}>{resident.name}</td>
                      <td style={{
                        background: pastDue > 0 ? '#fee2e2' : '#dcfce7',
                        color: pastDue > 0 ? '#991b1b' : '#166534',
                        fontWeight: 600,
                        padding: '10px 14px'
                      }}>
                        ₱{pastDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(month => {
                        const stmt = resident.statements?.find(s => s.month === month);
                        if (!stmt) {
                          return <td key={month} style={{ background: '#f8fafc', color: '#cbd5e1', textAlign: 'center' }}>-</td>;
                        }

                        const isPaid = stmt.status === 'Paid' || stmt.balance === 0;
                        const displayAmount = stmt.totalDues || 400;

                        return (
                          <td key={month} style={{
                            background: isPaid ? '#dcfce7' : '#fee2e2',
                            color: isPaid ? '#166534' : '#991b1b',
                            fontWeight: 600,
                            padding: '10px 14px',
                            whiteSpace: 'nowrap'
                          }}>
                            ₱{Number(displayAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls */}
        {filteredResidents.length > ITEMS_PER_PAGE && (
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredResidents.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredResidents.length)} of {filteredResidents.length} residents
            </span>
            <div className={styles.paginationControls}>
              <button
                className={styles.pageBtn}
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="First page"
              >
                «
              </button>
              <button
                className={styles.pageBtn}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ‹ Prev
              </button>
              {Array.from({ length: Math.ceil(filteredResidents.length / ITEMS_PER_PAGE) }, (_, i) => i + 1)
                .filter(page => page === 1 || page === Math.ceil(filteredResidents.length / ITEMS_PER_PAGE) || Math.abs(page - currentPage) <= 1)
                .reduce((acc: (number | string)[], page, idx, arr) => {
                  if (idx > 0 && (page as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(page);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === '...' ? (
                    <span key={`ellipsis-${idx}`} className={styles.pageEllipsis}>…</span>
                  ) : (
                    <button
                      key={item}
                      className={`${styles.pageBtn} ${currentPage === item ? styles.pageBtnActive : ''}`}
                      onClick={() => setCurrentPage(item as number)}
                    >
                      {item}
                    </button>
                  )
                )
              }
              <button
                className={styles.pageBtn}
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredResidents.length / ITEMS_PER_PAGE), p + 1))}
                disabled={currentPage === Math.ceil(filteredResidents.length / ITEMS_PER_PAGE)}
              >
                Next ›
              </button>
              <button
                className={styles.pageBtn}
                onClick={() => setCurrentPage(Math.ceil(filteredResidents.length / ITEMS_PER_PAGE))}
                disabled={currentPage === Math.ceil(filteredResidents.length / ITEMS_PER_PAGE)}
                title="Last page"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      <ResidentDetailModal
        isOpen={detailModalOpen}
        residentId={selectedResidentId}
        residentData={selectedResident ? {
          id: selectedResident.id,
          fullName: selectedResident.name,
          email: selectedResident.email,
          phone: selectedResident.phone,
          phase: selectedResident.phase,
          block: selectedResident.block,
          lot: selectedResident.lot,
          status: selectedResident.status,
          approvalStatus: selectedResident.approvalStatus,
          balance: selectedResident.balance,
        } : null}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedResidentId(null);
          setSelectedResident(null);
        }}
        onEdit={(id) => {
          setDetailModalOpen(false);
          const resident = allResidents.find(r => r.id === id);
          if (resident) {
            handleEditResident(resident);
          }
        }}
      />

      <ResidentEditModal
        isOpen={editModalOpen}
        residentId={selectedResidentId}
        residentData={selectedResident ? {
          id: selectedResident.id,
          fullName: selectedResident.name,
          phone: selectedResident.phone,
          phase: selectedResident.phase,
          block: selectedResident.block,
          lot: selectedResident.lot,
          status: selectedResident.status,
          approvalStatus: selectedResident.approvalStatus,
          balance: selectedResident.balance,
        } : null}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedResidentId(null);
          setSelectedResident(null);
        }}
        onSuccess={handleEditModalSuccess}
      />

      <PaymentHistoryModal
        isOpen={historyModalOpen}
        residentId={selectedResidentId}
        residentName={selectedResident?.name || null}
        onClose={() => {
          setHistoryModalOpen(false);
          setSelectedResidentId(null);
          setSelectedResident(null);
        }}
      />

      <BulkImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={loadResidents}
      />
    </>
  );
}
