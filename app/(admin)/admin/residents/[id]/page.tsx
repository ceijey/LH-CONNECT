'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import LoadingScreen from '@/app/components/LoadingScreen';
import styles from './resident-detail.module.css';

export default function ResidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [resident, setResident] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResident = async () => {
      try {
        setIsLoading(true);
        const data = await apiCall(`/api/residents/${id}`);
        setResident(data);
      } catch (err) {
        setError('Error loading resident');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResident();
  }, [id]);

  if (isLoading) {
    return <LoadingScreen message="Loading resident details..." />;
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.card} style={{ borderColor: '#ffcdd2', background: '#ffebee' }}>
          <p style={{ color: '#c62828', margin: 0 }}>{error}</p>
          <button onClick={() => router.back()} className={styles.backBtn} style={{ marginTop: '1rem' }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!resident) {
    return <div className={styles.container}>Resident not found</div>;
  }

  const getStatusClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return styles.statusActive;
      case 'delinquent': return styles.statusDelinquent;
      default: return styles.statusInactive;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Resident Information</h1>
        <button onClick={() => router.push('/admin/residents')} className={styles.backBtn}>
          ← Back to List
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.label}>Full Name</span>
            <span className={styles.value}>{resident.fullName || resident.name}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Status</span>
            <div>
              <span className={`${styles.statusBadge} ${getStatusClass(resident.status)}`}>
                {resident.status}
              </span>
            </div>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Phase / Block / Lot</span>
            <span className={styles.value}>
              {resident.phase} - Block {resident.block}, Lot {resident.lot}
            </span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Contact Number</span>
            <span className={styles.value}>{resident.phone || 'N/A'}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Email Address</span>
            <span className={styles.value}>{resident.email}</span>
          </div>

          <div className={styles.infoItem}>
            <span className={styles.label}>Outstanding Balance</span>
            <span className={styles.balanceValue}>₱{(Number(resident.balance) || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            onClick={() => router.push(`/admin/residents/${id}/edit`)}
            className={styles.editBtn}
          >
            Edit Profile
          </button>
        </div>
      </div>
    </div>
  );
}
