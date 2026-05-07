'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import styles from '../../resident-form.module.css';

export default function EditResidentPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    phase: '',
    block: '',
    lot: '',
    status: 'Active',
    balance: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResident = async () => {
      try {
        const data = await apiCall(`/api/residents/${id}`);
        setFormData({
          fullName: data.fullName || '',
          phone: data.phone || '',
          phase: data.phase || '',
          block: data.block || '',
          lot: data.lot || '',
          status: data.status || 'Active',
          balance: Number(data.balance ?? 0),
        });
      } catch (err: any) {
        console.error('Error fetching resident:', err);
        setError(err.message || 'Failed to load resident data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResident();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'balance' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      await apiCall(`/api/residents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(formData),
      });
      router.push(`/admin/residents/${id}`);
    } catch (err: any) {
      console.error('Error updating resident:', err);
      setError(err.message || 'Failed to update resident');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className={styles.loading}>Loading resident data...</div>;

  return (
      <form className={styles.formCard} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Personal Information</h2>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Full Name</label>
              <input
                type="text"
                name="fullName"
                className={styles.input}
                value={formData.fullName}
                onChange={handleChange}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Phone Number</label>
              <input
                type="text"
                name="phone"
                className={styles.input}
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Address (Phase/Block/Lot)</h2>
          <div className={styles.grid} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className={styles.field}>
              <label className={styles.label}>Phase</label>
              <input
                type="text"
                name="phase"
                className={styles.input}
                value={formData.phase}
                onChange={handleChange}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Block</label>
              <input
                type="text"
                name="block"
                className={styles.input}
                value={formData.block}
                onChange={handleChange}
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
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>

        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Account Status</h2>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Status</label>
              <select
                name="status"
                className={styles.select}
                value={formData.status}
                onChange={handleChange}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Delinquent">Delinquent</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Current Balance (₱)</label>
              <input
                type="number"
                name="balance"
                className={styles.input}
                value={formData.balance}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button 
            type="button" 
            className={styles.cancelBtn} 
            onClick={() => router.back()}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className={styles.submitBtn}
            disabled={isSaving}
          >
            {isSaving ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      </form>
  );
}
