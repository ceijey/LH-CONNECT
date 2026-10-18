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
  relatedSubmissions?: PaymentSubmission[];
}

interface PaymentSubmission {
  id: string;
  status?: string;
  verifiedDate?: string;
  submittedDate?: string;
  paymentAmount?: number;
  referenceNumber?: string;
  paymentMethod?: string;
}

interface AuditEvent {
  id: string;
  date: string;
  description: string;
  type: 'BILL' | 'PAYMENT';
  amount: number;
  status: string;
  referenceNumber?: string;
  paymentMethod?: string;
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
  const [residentAddress, setResidentAddress] = useState({ phase: '', block: '', lot: '' });

  useEffect(() => {
    if (!isOpen || !residentId) return;

    const fetchHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiCall(`/api/admin/residents/${residentId}/history`);
        setStatements(data.statements ?? []);
        setResidentAddress(data.resident ?? { phase: '', block: '', lot: '' });
      } catch (err: unknown) {
        console.error('Error fetching history:', err);
        setError(err instanceof Error ? err.message : 'Failed to load payment history');
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
            amount: Number(sub.paymentAmount ?? 0),
            status: sub.status === 'Verified' ? 'Confirmed' : sub.status === 'Rejected' ? 'Rejected' : 'Pending Verification',
            referenceNumber: sub.referenceNumber,
            paymentMethod: sub.paymentMethod,
          });
        });
      }
    });

    // Sort by date descending
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [statements]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the payment history.');
      return;
    }

    const householdNo = `P${residentAddress.phase ? residentAddress.phase.substring(0, 1) : '1'}B${residentAddress.block}L${residentAddress.lot}`;
    const address = `BLK. ${residentAddress.block || '—'} LOT ${residentAddress.lot || '—'}`;
    const rows = auditEvents.map((event) => `
      <tr>
        <td>${new Date(event.date).toLocaleDateString()}</td>
        <td>${event.description}</td>
        <td>${event.type}</td>
        <td>${event.referenceNumber || '—'}</td>
        <td>${event.paymentMethod || '—'}</td>
        <td class="${event.type === 'BILL' ? 'bill' : 'payment'}">${event.type === 'BILL' ? '+' : '-'} ₱${event.amount.toLocaleString()}</td>
        <td>${event.status}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html><head><title>TRANSACTION HISTORY & AUDIT LOG - ${residentName || 'Resident'}</title>
      <style>
        @page { size: landscape; margin: 12mm; }
        body { font-family: Arial, sans-serif; color: #111827; }
        .brand { text-align: center; margin-bottom: 16px; }
        .brand img { width: 42px; height: 42px; object-fit: contain; }
        h1 { font-size: 20px; margin: 2px 0; }
        h2 { font-size: 18px; margin: 8px 0 2px; }
        p { margin: 2px; color: #64748b; font-size: 10px; }
        .meta { display: flex; justify-content: space-between; margin: 10px 0; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #334155; padding: 6px; font-size: 10px; }
        th { background: #e2e8f0; text-transform: uppercase; }
        .bill { color: #dc2626; font-weight: bold; }
        .payment { color: #16a34a; font-weight: bold; }
        .footer { margin-top: 14px; text-align: right; color: #64748b; font-size: 9px; }
      </style></head><body>
        <div class="brand">
          <img src="/lhhoa-logo.png" alt="LH Logo" />
          <h1>LH-CONNECT</h1>
          <p>LINCOLN HEIGHTS SUBD., SAN PABLO, DINALUPIHAN, BATAAN • TIN: 420-968-199-000</p>
          <h2>TRANSACTION HISTORY & AUDIT LOG</h2>
          <p>${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <div class="meta"><span><strong>Household:</strong> ${householdNo}</span><span><strong>Name:</strong> ${residentName || 'Resident'}</span><span><strong>Address:</strong> ${address}</span></div>
        <table><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>OR No.</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="footer">LINCOLN HEIGHTS HOMEOWNERS ASSOCIATION © ${new Date().getFullYear()}. ALL RIGHTS RESERVED.</div>
        <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };</script>
      </body></html>
    `);
    printWindow.document.close();
  };

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
                    {auditEvents.map((event, index) => (
                      <tr key={`${event.id}-${index}`} className={styles.tableRow}>
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
            <button className={styles.printActionBtn} onClick={handlePrint} disabled={isLoading || auditEvents.length === 0}>
              🖨️ Print / Save PDF
            </button>
            <button className={styles.closeActionBtn} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </>
  );
}
