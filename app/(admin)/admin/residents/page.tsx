'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import ConfirmationModal from '@/app/components/ConfirmationModal';
import ResidentDetailModal from '@/app/components/ResidentDetailModal';
import ResidentEditModal from '@/app/components/ResidentEditModal';
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
      setFilteredResidents(residents);
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

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    const normalizedTerm = term.toLowerCase().trim();
    
    if (!normalizedTerm) {
      setFilteredResidents(allResidents);
    } else {
      const filtered = allResidents.filter(resident => {
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
      setFilteredResidents(filtered);
    }
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

  if (isLoading) return <div className={styles.loading}>Loading residents...</div>;

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
            <div className={styles.registryStatLabel}>Pending Approval</div>
            <div className={styles.registryStatValue} style={{ color: '#e65100' }}>{pendingApprovalCount}</div>
          </div>
          <div className={styles.registryStat}>
            <div className={styles.registryStatLabel}>New This Month</div>
            <div className={styles.registryStatValue} style={{ color: '#2196f3' }}>{newThisMonth}</div>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.searchSection}>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search by name, block/lot, or ID..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <button className={styles.addBtn} onClick={() => router.push('/admin/residents/new')}>
              + Add Resident
            </button>
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
                {filteredResidents.map((resident) => (
                  <tr key={resident.id}>
                    <td>
                      <span className={styles.idBadge} title={resident.id}>
                        {resident.id}
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
                        {resident.approvalStatus}
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
    </>
  );
}
