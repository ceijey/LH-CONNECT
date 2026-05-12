'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './manual-payment.module.css';
import { apiCall } from '@/lib/api-client';

interface Resident {
  id: string;
  fullName: string;
  phase?: string;
  block?: string;
  lot?: string;
  email?: string;
}

export default function ManualPaymentPage() {
  const router = useRouter();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [amount] = useState('400');
  const [month, setMonth] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchResidents = async () => {
      try {
        const data = await apiCall('/api/residents');
        setResidents(data.residents || []);
      } catch (err) {
        console.error('Failed to fetch residents:', err);
      }
    };
    fetchResidents();

    // Default month to current (format: YYYY-MM for input type="month")
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setMonth(currentMonth);
  }, []);

  const filteredResidents = residents.filter(r => 
    r.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedResident = residents.find(r => r.id === selectedResidentId);

  const handleSelectResident = (resident: Resident) => {
    setSelectedResidentId(resident.id);
    setSearchQuery(resident.fullName);
    setShowResults(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!selectedResidentId || !amount || !month) {
      setError('Please select a resident and billing period.');
      setIsSubmitting(false);
      return;
    }

    // Format month for display/database (e.g. "May 2026")
    const [year, monthNum] = month.split('-');
    const dateObj = new Date(Number(year), Number(monthNum) - 1);
    const formattedMonth = dateObj.toLocaleString(undefined, { month: 'long', year: 'numeric' });

    try {
      await apiCall('/api/admin/manual-payment', {
        method: 'POST',
        body: JSON.stringify({
          residentId: selectedResidentId,
          paymentAmount: Number(amount),
          month: formattedMonth,
          notes,
          paymentMethod: 'Cash',
        }),
      });

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/payments');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      {success && (
        <div className={styles.successOverlay}>
          <div className={styles.successIcon}>🎉</div>
          <h2 className={styles.successTitle}>Payment Recorded!</h2>
          <p className={styles.successMsg}>The resident has been notified and the receipt is ready.</p>
        </div>
      )}

      <div className={styles.header}>
        <h1 className={styles.title}>Manual Payment</h1>
        <p className={styles.subtitle}>Record a cash payment from a resident and generate an instant receipt.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className={styles.card}>
          {error && (
            <div className={styles.error}>
              <span>⚠️</span> {error}
            </div>
          )}

          <div className={styles.formGrid}>
            <div className={styles.fullWidth}>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  <span className={styles.labelIcon}>🔍</span> Search Resident Name
                </label>
                <div className={styles.searchContainer}>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Type resident name..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowResults(true);
                      if (selectedResidentId) setSelectedResidentId('');
                    }}
                    onFocus={() => setShowResults(true)}
                  />
                  {showResults && searchQuery.length > 0 && (
                    <div className={styles.resultsList}>
                      {filteredResidents.length > 0 ? (
                        filteredResidents.map(r => (
                          <div 
                            key={r.id} 
                            className={styles.resultItem}
                            onClick={() => handleSelectResident(r)}
                          >
                            <span className={styles.resultName}>{r.fullName}</span>
                            <span className={styles.resultAddr}>Ph{r.phase} B{r.block} L{r.lot}</span>
                          </div>
                        ))
                      ) : (
                        <div className={styles.noResults}>No residents found</div>
                      )}
                    </div>
                  )}
                </div>

                {selectedResident && (
                  <div className={styles.residentSummary}>
                    <div className={styles.avatar}>
                      {selectedResident.fullName.charAt(0)}
                    </div>
                    <div className={styles.summaryDetails}>
                      <span className={styles.summaryName}>{selectedResident.fullName}</span>
                      <span className={styles.summaryAddr}>
                        Ph{selectedResident.phase} Blk{selectedResident.block} Lot{selectedResident.lot}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                <span className={styles.labelIcon}>💰</span> Fixed Amount (PHP)
              </label>
              <div className={styles.amountWrapper}>
                <span className={styles.currency}>₱</span>
                <input
                  type="text"
                  className={`${styles.input} ${styles.amountInput}`}
                  value={amount}
                  readOnly
                  style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                />
              </div>
              <span className={styles.infoText}>Standard monthly dues of ₱400.</span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                <span className={styles.labelIcon}>📅</span> Select Billing Month
              </label>
              <input
                type="month"
                className={styles.input}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
              />
            </div>

            <div className={styles.fullWidth}>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  <span className={styles.labelIcon}>📝</span> Additional Notes (Optional)
                </label>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  placeholder="e.g. Paid in cash at the office, reference memo #123..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>Processing...</>
            ) : (
              <>💵 Record Cash Payment</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
