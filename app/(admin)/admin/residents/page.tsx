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
  status: 'Active' | 'Inactive' | 'Delinquent';
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
  balance: number;
  createdAt?: string;
}

export default function AdminResidents() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [allResidents, setAllResidents] = useState<Resident[]>([]);
  const [filteredResidents, setFilteredResidents] = useState<Resident[]>([]);
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
  const activeCount = allResidents.filter((resident) => resident.status === 'Active').length;
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
          approvalStatus: resident.approvalStatus === 'Approved'
            ? 'Approved'
            : resident.approvalStatus === 'Rejected'
              ? 'Rejected'
              : 'Pending',
          balance,
          createdAt: resident.createdAt,
        } as Resident;
      });

      setAllResidents(residents);
      applyFiltersAndSorting(searchTerm, sortConfig, residents);
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
    applyFiltersAndSorting(term, sortConfig, allResidents);
  };

  const handleSort = (key: keyof Resident) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    const newSortConfig = { key, direction };
    setSortConfig(newSortConfig);
    applyFiltersAndSorting(searchTerm, newSortConfig, allResidents);
  };

  const applyFiltersAndSorting = (term: string, config: typeof sortConfig, source: Resident[]) => {
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
            <div className={styles.registryStatIcon} style={{ background: '#e8f5e9', color: '#4caf50' }}>✓</div>
            <div className={styles.registryStatInfo}>
              <div className={styles.registryStatLabel}>Active</div>
              <div className={styles.registryStatValue} style={{ color: '#4caf50' }}>{activeCount}</div>
            </div>
          </div>
          <div className={styles.registryStat}>
            <div className={styles.registryStatIcon} style={{ background: '#ffebee', color: '#f44336' }}>⚠</div>
            <div className={styles.registryStatInfo}>
              <div className={styles.registryStatLabel}>Delinquent</div>
              <div className={styles.registryStatValue} style={{ color: '#f44336' }}>{delinquentCount}</div>
            </div>
          </div>
          <div className={styles.registryStat}>
            <div className={styles.registryStatIcon} style={{ background: '#fff3e0', color: '#e65100' }}>⏳</div>
            <div className={styles.registryStatInfo}>
              <div className={styles.registryStatLabel}>Pending Approval</div>
              <div className={styles.registryStatValue} style={{ color: '#e65100' }}>{pendingApprovalCount}</div>
            </div>
          </div>
          <div className={styles.registryStat}>
            <div className={styles.registryStatIcon} style={{ background: '#e3f2fd', color: '#2196f3' }}>🆕</div>
            <div className={styles.registryStatInfo}>
              <div className={styles.registryStatLabel}>New This Month</div>
              <div className={styles.registryStatValue} style={{ color: '#2196f3' }}>{newThisMonth}</div>
            </div>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.searchSection}>
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
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                className={styles.addBtn} 
                style={{ background: 'transparent', border: '1.5px solid #1B2A4A', color: '#1B2A4A' }}
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
            <table className={styles.table}>
              <thead>
                <tr>
                  {renderSortHeader('ID', 'id')}
                  {renderSortHeader('Name', 'name')}
                  {renderSortHeader('Block/Lot', 'phase')}
                  {renderSortHeader('Status', 'status')}
                  {renderSortHeader('Verification', 'approvalStatus')}
                  {renderSortHeader('Balance', 'balance')}
                  <th>Contact</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredResidents.map((resident) => (
                  <tr key={resident.id}>
                    <td>
                      <span className={styles.idBadge} title={resident.id}>
                        {formatResidentId(resident.id)}
                      </span>
                    </td>
                    <td className={styles.nameTd}>{resident.name}</td>
                    <td>
                      <div className={styles.blockLot}>
                        <span className={styles.phaseBadge}>{resident.phase}</span>
                        <span className={styles.blockLotText}>Blk {resident.block} Lot {resident.lot}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles[resident.status.toLowerCase()]}`}>
                        {resident.status}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles[resident.approvalStatus.toLowerCase()]}`}>
                        {resident.approvalStatus === 'Rejected' ? 'Declined' : resident.approvalStatus}
                      </span>
                    </td>
                    <td className={`${styles.balanceTd} ${resident.balance > 0 ? styles.debit : ''}`}>
                      ₱{resident.balance.toLocaleString()}
                    </td>
                    <td>{resident.phone}</td>
                    <td className={styles.actionsTd}>
                      <button 
                        className={styles.iconBtn} 
                        title="View Details"
                        onClick={() => handleViewDetails(resident)}
                      >
                        📋
                      </button>
                      <button 
                        className={styles.iconBtn} 
                        title="Edit Resident"
                        onClick={() => handleEditResident(resident)}
                      >
                        ✏️
                      </button>
                      <button 
                        className={styles.iconBtn} 
                        title="Payment History"
                        onClick={() => handleViewHistory(resident)}
                      >
                        📈
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
