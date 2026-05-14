'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiCall } from '@/lib/api-client';
import Skeleton, { SkeletonText } from './Skeleton';
import styles from './PaymentHistoryModal.module.css';

interface Statement {
  id: string;
  month: string;
  year: number;
  date: string;
  totalDues: number;
  amountPaid: number;
  balance: number;
  status: 'Paid' | 'Partially Paid' | 'Pending';
  relatedSubmissions?: any[];
}

interface AuditEvent {
  id: string;
  date: string;
  description: string;
  type: 'BILL' | 'PAYMENT';
  amount: number;
  status: string;
}

interface PaymentHistoryModalProps {
  isOpen: boolean;
  residentId: string | null;
  residentName: string | null;
  onClose: () => void;
}

export default function PaymentHistoryModal({
  isOpen,
  residentId,
  residentName,
  onClose,
}: PaymentHistoryModalProps) {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !residentId) return;

    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiCall(`/api/admin/residents/${residentId}/history`);
        setStatements(data.statements ?? []);
      } catch (err: any) {
        console.error('Error fetching history:', err);
        setError(err.message || 'Failed to load payment history');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, residentId]);

  const auditEvents = useMemo(() => {
    const events: AuditEvent[] = [];
    
    statements.forEach(stmt => {
      // Add Bill Event
      events.push({
        id: `bill-${stmt.id}`,
        date: stmt.date,
        description: `Monthly Dues - ${stmt.month} ${stmt.year}`,
        type: 'BILL',
        amount: stmt.totalDues,
        status: stmt.status,
      });

      // Add Payment Events
      if (stmt.relatedSubmissions) {
        stmt.relatedSubmissions.forEach(sub => {
          const subDate = (sub.status === 'Verified' && sub.verifiedDate)
            ? sub.verifiedDate
            : (sub.submittedDate || stmt.date);
            
          events.push({
            id: `pay-${sub.id}`,
            date: subDate,
            description: `Payment for ${stmt.month} ${stmt.year}`,
            type: 'PAYMENT',
            amount: sub.paymentAmount,
            status: sub.status === 'Verified' ? 'Confirmed' : sub.status === 'Rejected' ? 'Rejected' : 'Pending Verification',
          });
        });
      }
    });

    // Sort by date descending
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [statements]);

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <div>
              <h2 className={styles.modalTitle}>Payment History</h2>
              <p className={styles.residentSubtitle}>{residentName}</p>
            </div>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>

          <div className={styles.modalBody}>
            {isLoading ? (
              <div className={styles.skeletonContainer}>
                <Skeleton height="40px" style={{ marginBottom: '1rem' }} />
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ marginBottom: '1rem' }}>
                    <SkeletonText lines={1} />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className={styles.error}>{error}</div>
            ) : auditEvents.length === 0 ? (
              <div className={styles.noData}>No payment history found for this resident.</div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.historyTable}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEvents.map((event) => (
                      <tr key={event.id} className={styles.tableRow}>
                        <td>{new Date(event.date).toLocaleDateString()}</td>
                        <td>{event.description}</td>
                        <td>
                          <span className={`${styles.typeBadge} ${styles[(event.type || 'bill').toLowerCase()]}`}>
                            {event.type}
                          </span>
                        </td>
                        <td className={event.type === 'BILL' ? styles.billAmount : styles.payAmount}>
                          {event.type === 'BILL' ? '+' : '-'} ₱{event.amount.toLocaleString()}
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${styles[(event.status || 'pending').toLowerCase().replace(/\s/g, '')]}`}>
                            {event.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className={styles.modalFooter}>
            <button className={styles.closeActionBtn} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </>
  );
}
