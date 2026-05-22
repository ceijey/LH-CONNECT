'use client';

import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import styles from './ReceiptModal.module.css';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
    payment: {
      id: string;
      residentName: string;
      blockLot: string;
      paymentAmount: number;
      paymentMethod: string;
      referenceNumber: string;
      submittedDate: string;
      verifiedDate?: string;
      status: string;
      notes?: string;
      fileUrl?: string;
      paymentDateTime?: string;
    } | null;
}

export default function ReceiptModal({ isOpen, onClose, payment }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen || !payment) return null;

  // Derive period covered from paymentDateTime or submittedDate
  const derivePeriodCovered = (): string => {
    const dateStr = payment.paymentDateTime || payment.submittedDate;
    if (!dateStr) return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
      }
    } catch {
      // fallback
    }
    return dateStr;
  };

  const periodCovered = derivePeriodCovered();
  const isPaid = payment.status === 'Verified';
  const monthlyDueBill = payment.paymentAmount ?? 400;

  const handleDownloadImage = async () => {
    if (!receiptRef.current) return;
    
    try {
      setIsExporting(true);
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2, // Higher quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `LHHOA-Receipt-${payment.id?.substring(0, 8) || 'billing'}.png`;
      link.href = image;
      link.click();
    } catch (error) {
      console.error('Failed to export receipt:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Monthly Dues Billing</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.scrollArea}>
          <div className={styles.receiptContainer} ref={receiptRef}>
            {/* Receipt Header - Logo + Org Info */}
            <div className={styles.receiptHeader}>
              <img
                src="/lhhoa-logo.png"
                alt="LHHOA Logo"
                className={styles.receiptLogo}
                crossOrigin="anonymous"
              />
              <div className={styles.orgInfo}>
                <h1 className={styles.orgName}>Lincoln Heights Homeowners Association</h1>
                <p className={styles.orgSub}>Lincoln Heights Subdivision</p>
                <p className={styles.orgSub}>San Pablo, Dinalupihan Bataan</p>
                <p className={styles.orgSub}>TIN 480-266-103-000</p>
              </div>
            </div>

            {/* Title */}
            <div className={styles.billingTitle}>MONTHLY DUES BILLING</div>

            {/* Billing Details */}
            <table className={styles.billingTable}>
              <tbody>
                <tr>
                  <td className={styles.fieldLabel}>Name</td>
                  <td className={styles.fieldColon}>:</td>
                  <td className={styles.fieldValue}>{payment.residentName || '—'}</td>
                </tr>
                <tr>
                  <td className={styles.fieldLabel}>Address</td>
                  <td className={styles.fieldColon}>:</td>
                  <td className={styles.fieldValue}>{payment.blockLot || '—'}</td>
                </tr>
                <tr>
                  <td className={styles.fieldLabel}>Period Covered</td>
                  <td className={styles.fieldColon}>:</td>
                  <td className={styles.fieldValue}>{periodCovered}</td>
                </tr>
                <tr>
                  <td className={styles.fieldLabel}>Monthly Due Bill</td>
                  <td className={styles.fieldColon}>:</td>
                  <td className={styles.fieldValue}>{monthlyDueBill.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td className={styles.fieldLabel}>Arrears</td>
                  <td className={styles.fieldColon}>:</td>
                  <td className={styles.fieldValue}>—</td>
                </tr>
                <tr className={styles.totalRow}>
                  <td className={styles.totalLabel}>Total Amount Due</td>
                  <td className={styles.totalColon}>:</td>
                  <td className={styles.totalValue}>
                    {isPaid ? (
                      <span className={styles.paidBadge}>PAID</span>
                    ) : (
                      <span className={styles.pendingBadge}>PENDING</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className={styles.fieldLabel}>Due Date</td>
                  <td className={styles.fieldColon}>:</td>
                  <td className={styles.fieldValue}>—</td>
                </tr>
                {payment.referenceNumber && (
                  <tr>
                    <td className={styles.fieldLabel}>Reference No.</td>
                    <td className={styles.fieldColon}>:</td>
                    <td className={styles.fieldValue}>{payment.referenceNumber}</td>
                  </tr>
                )}
                {payment.paymentMethod && (
                  <tr>
                    <td className={styles.fieldLabel}>Payment Method</td>
                    <td className={styles.fieldColon}>:</td>
                    <td className={styles.fieldValue}>{payment.paymentMethod}</td>
                  </tr>
                )}
                {payment.paymentDateTime && (
                  <tr>
                    <td className={styles.fieldLabel}>Payment Date/Time</td>
                    <td className={styles.fieldColon}>:</td>
                    <td className={styles.fieldValue}>
                      {new Date(payment.paymentDateTime).toLocaleString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Notes Section */}
            <div className={styles.notesSection}>
              <p className={styles.notesTitle}>Note:</p>
              <ul className={styles.notesList}>
                <li>Please pay your monthly dues on/or before due date to avoid sanctions.</li>
                <li>If payment has been made, please disregard this bill.</li>
                <li>If you cannot pay your monthly due bill on time, please visit LHHOA Office.</li>
                {payment.notes && <li>{payment.notes}</li>}
              </ul>
            </div>

            {/* Thank You */}
            <div className={styles.thankYou}>Thank You</div>

            {/* Receipt Footer */}
            <div className={styles.receiptFooter}>
              <p>This is an electronically generated receipt.</p>
              <p>© {new Date().getFullYear()} Lincoln Heights Homeowners Association</p>
            </div>
          </div>

          {/* Proof of Payment - Outside printable area */}
          <div className={styles.proofSection}>
            <p className={styles.proofTitle}>Attached Proof of Payment</p>
            <div className={styles.proofImageWrapper}>
              {payment.id ? (
                <img 
                  src={`/api/payment-submissions/${payment.id}/proof`} 
                  alt="Proof of Payment" 
                  className={styles.proofImage}
                  crossOrigin="anonymous"
                  onError={(e) => {
                    if (payment.fileUrl && e.currentTarget.src !== payment.fileUrl) {
                      e.currentTarget.src = payment.fileUrl;
                    }
                  }}
                />
              ) : payment.fileUrl ? (
                <img 
                  src={payment.fileUrl} 
                  alt="Proof of Payment" 
                  className={styles.proofImage}
                  crossOrigin="anonymous"
                />
              ) : (
                <div className={styles.noProof}>No image attached</div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.secondaryBtn} onClick={onClose}>
            Close
          </button>
          <button 
            className={styles.printBtn} 
            onClick={handlePrint}
          >
            🖨️ Print Receipt
          </button>
          <button 
            className={styles.primaryBtn} 
            onClick={handleDownloadImage}
            disabled={isExporting}
          >
            {isExporting ? '⏳ Exporting...' : '📥 Download as PNG'}
          </button>
        </div>
      </div>
    </div>
  );
}
