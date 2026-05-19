'use client';

import { useEffect, useState } from 'react';
import { apiCall } from '@/lib/api-client';
import Skeleton, { SkeletonText } from './Skeleton';
import styles from './ResidentEditModal.module.css';

interface FormData {
  fullName: string;
  phone: string;
  phase: string;
  block: string;
  lot: string;
  status: 'Active' | 'Inactive' | 'Delinquent';
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
  balance: number;
}

interface ResidentData {
  id: string;
  fullName: string;
  phone: string;
  phase: string;
  block: string;
  lot: string;
  status: 'Active' | 'Inactive' | 'Delinquent';
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
  balance: number;
}

interface ResidentEditModalProps {
  isOpen: boolean;
  residentId: string | null;
  residentData?: ResidentData | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ResidentEditModal({
  isOpen,
  residentId,
  residentData,
  onClose,
  onSuccess,
}: ResidentEditModalProps) {
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    phone: '',
    phase: '',
    block: '',
    lot: '',
    status: 'Active',
    approvalStatus: 'Pending',
    balance: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !residentId) {
      setError(null);
      return;
    }

    // If we have resident data passed in, use it
    if (residentData) {
      setFormData({
        fullName: residentData.fullName || '',
        phone: residentData.phone || '',
        phase: residentData.phase || '',
        block: residentData.block || '',
        lot: residentData.lot || '',
        status: residentData.status || 'Active',
        approvalStatus: residentData.approvalStatus || 'Pending',
        balance: Number(residentData.balance ?? 0),
      });
      return;
    }

    // Otherwise, fetch it
    const fetchResident = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiCall(`/api/residents/${residentId}`);
        setFormData({
          fullName: data.fullName || '',
          phone: data.phone || '',
          phase: data.phase || '',
          block: data.block || '',
          lot: data.lot || '',
          status: data.status || 'Active',
          approvalStatus: data.approvalStatus || 'Pending',
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
  }, [isOpen, residentId, residentData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Phone number: only allow 11 digits
    if (name === 'phone') {
      const phoneDigitsOnly = value.replace(/\D/g, '');
      if (phoneDigitsOnly.length <= 11) {
        setFormData(prev => ({
          ...prev,
          [name]: phoneDigitsOnly
        }));
      }
      return;
    }

    // Balance: only allow multiples of 400
    if (name === 'balance') {
      const numValue = Number(value);
      if (numValue >= 0 && numValue % 400 === 0) {
        setFormData(prev => ({
          ...prev,
          [name]: numValue
        }));
      }
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residentId) return;

    setIsSaving(true);
    setError(null);

    try {
      await apiCall(`/api/residents/${residentId}`, {
        method: 'PATCH',
        body: JSON.stringify(formData),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating resident:', err);
      setError(err.message || 'Failed to update resident');
    } finally {
      setIsSaving(false);
    }
  };

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
            <h2 className={styles.modalTitle}>Edit Resident</h2>
            <button
              className={styles.closeBtn}
              onClick={onClose}
              title="Close modal"
              disabled={isSaving}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className={styles.modalBody}>
            {isLoading && (
              <div className={styles.skeletonContainer}>
                {/* Personal Information Section */}
                <div className={styles.skeletonSection}>
                  <Skeleton height="1rem" width="40%" style={{ marginBottom: '1rem' }} />
                  <div className={styles.grid}>
                    <div>
                      <Skeleton height="0.875rem" width="80%" style={{ marginBottom: '0.5rem' }} />
                      <Skeleton height="40px" />
                    </div>
                    <div>
                      <Skeleton height="0.875rem" width="80%" style={{ marginBottom: '0.5rem' }} />
                      <Skeleton height="40px" />
                    </div>
                  </div>
                </div>

                {/* Address Section */}
                <div className={styles.skeletonSection}>
                  <Skeleton height="1rem" width="45%" style={{ marginBottom: '1rem' }} />
                  <div className={styles.gridThreeCols}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i}>
                        <Skeleton height="0.875rem" width="80%" style={{ marginBottom: '0.5rem' }} />
                        <Skeleton height="40px" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Account Status Section */}
                <div className={styles.skeletonSection}>
                  <Skeleton height="1rem" width="35%" style={{ marginBottom: '1rem' }} />
                  <div className={styles.gridThreeCols}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i}>
                        <Skeleton height="0.875rem" width="80%" style={{ marginBottom: '0.5rem' }} />
                        <Skeleton height="40px" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {error && <div className={styles.error}>{error}</div>}

            {!isLoading && (
              <form onSubmit={handleSubmit} className={styles.form}>
                {/* Personal Information */}
                <div className={styles.formSection}>
                  <h3 className={styles.sectionTitle}>Personal Information</h3>
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
                        disabled={isSaving}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Phone Number</label>
                      <input
                        type="tel"
                        name="phone"
                        className={styles.input}
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="11 digits"
                        maxLength={11}
                        required
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className={styles.formSection}>
                  <h3 className={styles.sectionTitle}>Address (Phase/Block/Lot)</h3>
                  <div className={styles.gridThreeCols}>
                    <div className={styles.field}>
                      <label className={styles.label}>Phase</label>
                      <select
                        name="phase"
                        className={styles.select}
                        value={formData.phase}
                        onChange={handleChange}
                        required
                        disabled={isSaving}
                      >
                        <option value="">Select Phase</option>
                        <option value="Phase 1">Phase 1</option>
                        <option value="Phase 2">Phase 2</option>
                        <option value="Phase 3">Phase 3</option>
                        <option value="Phase 4">Phase 4</option>
                        <option value="Phase 5">Phase 5</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Block</label>
                      <select
                        name="block"
                        className={styles.select}
                        value={formData.block}
                        onChange={handleChange}
                        required
                        disabled={isSaving}
                      >
                        <option value="">Select Block</option>
                        {Array.from({ length: 26 }, (_, i) => (
                          <option key={i + 1} value={String(i + 1)}>
                            {i + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Lot</label>
                      <select
                        name="lot"
                        className={styles.select}
                        value={formData.lot}
                        onChange={handleChange}
                        required
                        disabled={isSaving}
                      >
                        <option value="">Select Lot</option>
                        {Array.from({ length: 26 }, (_, i) => (
                          <option key={i + 1} value={String(i + 1)}>
                            {i + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Account Status */}
                <div className={styles.formSection}>
                  <h3 className={styles.sectionTitle}>Account Status</h3>
                  <div className={styles.gridThreeCols}>
                    <div className={styles.field}>
                      <label className={styles.label}>Status</label>
                      <select
                        name="status"
                        className={styles.select}
                        value={formData.status}
                        onChange={handleChange}
                        disabled={isSaving}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Delinquent">Delinquent</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>HOA Verification</label>
                      <select
                        name="approvalStatus"
                        className={styles.select}
                        value={formData.approvalStatus}
                        onChange={handleChange}
                        disabled={isSaving}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Declined</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Current Balance (₱)</label>
                      <select
                        name="balance"
                        className={styles.select}
                        value={formData.balance}
                        onChange={handleChange}
                        required
                        disabled={isSaving}
                      >
                        <option value="0">₱0</option>
                        {Array.from({ length: 25 }, (_, i) => {
                          const amount = (i + 1) * 400;
                          return (
                            <option key={amount} value={String(amount)}>
                              ₱{amount.toLocaleString()}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          {!isLoading && (
            <div className={styles.modalFooter}>
              <button
                className={styles.secondaryBtn}
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className={styles.primaryBtn}
                onClick={handleSubmit}
                disabled={isSaving}
              >
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
