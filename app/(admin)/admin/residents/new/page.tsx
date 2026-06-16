'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import styles from '../resident-form.module.css';

export default function NewResidentPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    phase: '',
    block: '',
    lot: '',
    status: 'Active',
    balance: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // For now, we'll assume the API supports POST for new residents
      // Note: In a real app, this would also handle user account creation
      await apiCall('/api/residents', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      router.push('/admin/residents');
    } catch (err: any) {
      console.error('Error creating resident:', err);
      setError(err.message || 'Failed to create resident. Please check if email already exists.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.container}>

      <form className={styles.formCard} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Account Information</h2>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Full Name</label>
              <input
                type="text"
                name="fullName"
                className={styles.input}
                value={formData.fullName}
                onChange={handleChange}
                placeholder="John Doe"
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Email Address</label>
              <input
                type="email"
                name="email"
                className={styles.input}
                value={formData.email}
                onChange={handleChange}
                placeholder="john@example.com"
                required
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
                onChange={handleChange}
                placeholder="09123456789"
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
                onChange={handleChange}
                placeholder="Phase 1"
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
                onChange={handleChange}
                placeholder="1"
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
                placeholder="1"
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
            {isSaving ? 'Creating...' : 'Create Resident Record'}
          </button>
        </div>
      </form>
    </div>
  );
}
