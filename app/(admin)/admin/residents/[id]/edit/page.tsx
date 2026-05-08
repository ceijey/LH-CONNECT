'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import styles from '../../resident-form.module.css';

interface ResidentFormData {
  name: string;
  phase: string;
  block: string;
  lot: string;
  email: string;
  phone: string;
}

export default function EditResidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [resident, setResident] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<ResidentFormData>({
    name: '',
    phase: '',
    block: '',
    lot: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    const fetchResident = async () => {
      try {
        setIsLoading(true);
        const data = await apiCall(`/api/residents/${id}`);
        setResident(data);
        setFormData({
          name: data.fullName || data.name || '',
          phase: data.phase || '',
          block: data.block || '',
          lot: data.lot || '',
          email: data.email || '',
          phone: data.phone || '',
        });
      } catch (err) {
        setError('Error loading resident');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResident();
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiCall(`/api/residents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: formData.name,
          phase: formData.phase,
          block: formData.block,
          lot: formData.lot,
          phone: formData.phone,
        }),
      });

      router.push('/admin/residents');
    } catch (err) {
      setError('Error updating resident');
      console.error(err);
    }
  };

  if (isLoading) {
    return <div className={styles.container}>Loading edit form...</div>;
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
        <button onClick={() => router.back()} className={styles.cancelBtn}>Go Back</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          ← Back
        </button>
        <h1 className={styles.title}>Edit Resident Profile</h1>
      </div>

      <form className={styles.formCard} onSubmit={handleSubmit}>
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Account Information</h2>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Full Name</label>
              <input
                type="text"
                name="name"
                className={styles.input}
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Email Address (Read Only)</label>
              <input
                type="email"
                name="email"
                className={styles.input}
                value={formData.email}
                disabled
                style={{ background: '#f5f5f5', cursor: 'not-allowed' }}
              />
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Contact & Location</h2>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Phone Number</label>
              <input
                type="text"
                name="phone"
                className={styles.input}
                value={formData.phone}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Phase</label>
              <input
                type="text"
                name="phase"
                className={styles.input}
                value={formData.phase}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          <div className={styles.grid} style={{ marginTop: '1.5rem' }}>
            <div className={styles.field}>
              <label className={styles.label}>Block</label>
              <input
                type="text"
                name="block"
                className={styles.input}
                value={formData.block}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Lot</label>
              <input
                type="text"
                name="lot"
                className={styles.input}
                value={formData.lot}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button 
            type="button" 
            className={styles.cancelBtn} 
            onClick={() => router.push(`/admin/residents/${id}`)}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className={styles.submitBtn}
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
