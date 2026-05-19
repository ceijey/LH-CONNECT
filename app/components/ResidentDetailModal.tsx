'use client';

import { useEffect, useState } from 'react';
import { apiCall } from '@/lib/api-client';
import Skeleton, { SkeletonText, SkeletonAvatar } from './Skeleton';
import styles from './ResidentDetailModal.module.css';

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
  fullName: string;
  email: string;
  phone: string;
  phase: string;
  block: string;
  lot: string;
  status: 'Active' | 'Inactive' | 'Delinquent';
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
  balance: number;
  createdAt?: string;
  updatedAt?: string;
  profileImage?: string;
}

interface ResidentDetailModalProps {
  isOpen: boolean;
  residentId: string | null;
  residentData?: Resident | null;
  onClose: () => void;
  onEdit: (id: string) => void;
}

export default function ResidentDetailModal({
  isOpen,
  residentId,
  residentData,
  onClose,
  onEdit,
}: ResidentDetailModalProps) {
  const [resident, setResident] = useState<Resident | null>(residentData || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !residentId) {
      setResident(residentData || null);
      setError(null);
      return;
    }

    // If we have resident data passed in, use it
    if (residentData) {
      setResident(residentData);
      return;
    }

    // Otherwise, fetch it
    const fetchResident = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiCall(`/api/residents/${residentId}`);
        setResident(data);
      } catch (err: any) {
        console.error('Error fetching resident:', err);
        setError(err.message || 'Failed to load resident details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResident();
  }, [isOpen, residentId, residentData]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Modal */}
      <div className={styles.modal}>
        <div className={styles.modalContent}>
          {/* Header */}
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Resident Details</h2>
            <button
              className={styles.closeBtn}
              onClick={onClose}
              title="Close modal"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className={styles.modalBody}>
            {isLoading && (
              <div className={styles.skeletonContainer}>
                <Skeleton height="120px" className={styles.skeletonBalance} />
                
                <div className={styles.skeletonProfile}>
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <SkeletonAvatar size={80} />
                    <Skeleton height="1.5rem" width="80%" style={{ margin: '1rem auto 0.5rem' }} />
                    <Skeleton height="1rem" width="60%" style={{ margin: '0 auto' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <SkeletonText lines={3} />
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                  <Skeleton height="1rem" width="40%" style={{ marginBottom: '1rem' }} />
                  <SkeletonText lines={2} />
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                  <Skeleton height="1rem" width="50%" style={{ marginBottom: '1rem' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i}>
                        <Skeleton height="0.875rem" width="80%" style={{ marginBottom: '0.5rem' }} />
                        <Skeleton height="1rem" width="90%" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {error && <div className={styles.error}>{error}</div>}

            {resident && (
              <>
                {/* Balance Card */}
                <div className={styles.balanceCard}>
                  <div>
                    <div className={styles.balanceLabel}>Current Outstanding Balance</div>
                    <div className={styles.balanceValue}>
                      ₱{(resident.balance ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div className={styles.badgesContainer}>
                    <div
                      className={`${styles.badge} ${styles[resident.status.toLowerCase()]}`}
                    >
                      {resident.status}
                    </div>
                    <div
                      className={`${styles.badge} ${styles[(resident.approvalStatus || 'pending').toLowerCase()]}`}
                    >
                      {resident.approvalStatus === 'Rejected' ? 'Declined' : (resident.approvalStatus || 'Pending')}
                    </div>
                  </div>
                </div>

                {/* Profile Section */}
                <div className={styles.profileSection}>
                  <div className={styles.avatarContainer}>
                    {resident.profileImage ? (
                      <img 
                        src={resident.profileImage} 
                        alt={resident.fullName} 
                        className={styles.avatarImage} 
                        style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #4caf50', margin: '0 auto 0.75rem', display: 'block', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
                      />
                    ) : (
                      <div className={styles.avatar}>
                        {(resident.fullName || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <h3 className={styles.residentName}>{resident.fullName}</h3>
                    <span className={styles.residentId}>ID: {formatResidentId(resident.id)}</span>
                  </div>

                  <div className={styles.datesInfo}>
                    <div className={styles.dateItem}>
                      <span className={styles.dateLabel}>Member Since</span>
                      <span className={styles.dateValue}>
                        {resident.createdAt
                          ? new Date(resident.createdAt).toLocaleDateString()
                          : 'N/A'}
                      </span>
                    </div>
                    <div className={styles.dateItem}>
                      <span className={styles.dateLabel}>Last Updated</span>
                      <span className={styles.dateValue}>
                        {resident.updatedAt
                          ? new Date(resident.updatedAt).toLocaleDateString()
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact & Address Section */}
                <div className={styles.infoSection}>
                  <h3 className={styles.sectionTitle}>Contact & Address</h3>

                  <div className={styles.contactGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Email</span>
                      <span className={styles.infoValue}>{resident.email || 'N/A'}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Phone</span>
                      <span className={styles.infoValue}>{resident.phone || 'N/A'}</span>
                    </div>
                  </div>

                  <div className={styles.addressGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Phase</span>
                      <span className={styles.infoValue}>{resident.phase || 'N/A'}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Block</span>
                      <span className={styles.infoValue}>{resident.block || 'N/A'}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Lot</span>
                      <span className={styles.infoValue}>{resident.lot || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {resident && !error && (
            <div className={styles.modalFooter}>
              <button className={styles.secondaryBtn} onClick={onClose}>
                Close
              </button>
              <button
                className={styles.primaryBtn}
                onClick={() => {
                  onEdit(residentId!);
                  onClose();
                }}
              >
                ✏️ Edit Profile
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
