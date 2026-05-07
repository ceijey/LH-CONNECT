'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import styles from './resident-detail.module.css';

interface Resident {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  phase: string;
  block: string;
  lot: string;
  status: 'Active' | 'Inactive' | 'Delinquent';
  balance: number;
  createdAt?: string;
  updatedAt?: string;
}

export default function ResidentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  const [resident, setResident] = useState<Resident | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResident = async () => {
      try {
        const data = await apiCall(`/api/residents/${id}`);
        setResident(data);
      } catch (err: any) {
        console.error('Error fetching resident:', err);
        setError(err.message || 'Failed to load resident details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResident();
  }, [id]);

  if (isLoading) return <div className={styles.loading}>Loading resident details...</div>;
  if (error || !resident) return <div className={styles.error}>{error || 'Resident not found'}</div>;

  return (
    <>
      <div className={styles.headerActions}>
        <button 
          className={styles.backBtn} 
          onClick={() => router.push('/admin/residents')}
        >
          ← Back to Residents Registry
        </button>
        <button 
          className={styles.editBtn}
          onClick={() => router.push(`/admin/residents/${id}/edit`)}
        >
          ✏️ Edit Profile
        </button>
      </div>

      <div className={styles.balanceCard}>
        <div>
          <div className={styles.balanceLabel}>Current Outstanding Balance</div>
          <div className={styles.balanceValue}>₱{(resident.balance ?? 0).toLocaleString()}</div>
        </div>
        <div className={`${styles.statusBadge} ${styles[(resident.status || 'Active').toLowerCase()]}`}>
          {resident.status || 'Active'}
        </div>
      </div>

      <div className={styles.profileGrid}>
        <div className={styles.card}>
          <div className={styles.avatarContainer}>
            <div className={styles.largeAvatar}>
              {(resident.fullName || 'U').charAt(0).toUpperCase()}
            </div>
            <h1 className={styles.residentName}>{resident.fullName || 'Unknown Resident'}</h1>
            <span className={styles.residentId}>ID: {resident.id}</span>
          </div>
          
          <div style={{ marginTop: '2rem' }} className={styles.infoList}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Member Since</span>
              <span className={styles.infoValue}>
                {resident.createdAt ? new Date(resident.createdAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Last Updated</span>
              <span className={styles.infoValue}>
                {resident.updatedAt ? new Date(resident.updatedAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Contact & Address Information</h2>
          <div className={styles.infoList}>
            <div className={styles.contactGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Email Address</span>
                <span className={styles.infoValue}>{resident.email || 'N/A'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Phone Number</span>
                <span className={styles.infoValue}>{resident.phone || 'N/A'}</span>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <span className={styles.infoLabel}>Full Address</span>
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
          </div>
        </div>
      </div>
    </>
  );
}
