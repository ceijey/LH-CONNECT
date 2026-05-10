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
  } | null;
}

export default function ReceiptModal({ isOpen, onClose, payment }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen || !payment) return null;

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
      link.download = `Receipt-${payment.id}.png`;
      link.href = image;
      link.click();
    } catch (error) {
      console.error('Failed to export receipt:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Payment Receipt</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.scrollArea}>
          <div className={styles.receiptContainer} ref={receiptRef}>
            {/* Receipt Header */}
            <div className={styles.receiptHeader}>
              <div className={styles.brandInfo}>
                <span className={styles.brandIcon}>🏠</span>
                <div>
                  <h1 className={styles.brandName}>LH-Connect</h1>
                  <p className={styles.brandTagline}>Lincoln Heights HOA Official Receipt</p>
                </div>
              </div>
              <div className={styles.receiptMeta}>
                <div className={styles.receiptId}># {payment.id.substring(0, 12)}</div>
                <div className={styles.receiptDate}>
                  {payment.verifiedDate || payment.submittedDate}
                </div>
              </div>
            </div>

            {/* Status Watermark */}
            <div className={`${styles.watermark} ${styles[payment.status.toLowerCase()]}`}>
              {payment.status.toUpperCase()}
            </div>

            {/* Transaction Body */}
            <div className={styles.receiptBody}>
              <div className={styles.detailsGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Resident Name</span>
                  <span className={styles.detailValue}>{payment.residentName}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Address</span>
                  <span className={styles.detailValue}>{payment.blockLot}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Payment Method</span>
                  <span className={styles.detailValue}>{payment.paymentMethod}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Reference No.</span>
                  <span className={styles.detailValue}>{payment.referenceNumber || 'N/A'}</span>
                </div>
              </div>

              <div className={styles.amountSection}>
                <div className={styles.amountLabel}>Total Amount Paid</div>
                <div className={styles.amountValue}>₱{payment.paymentAmount.toLocaleString()}</div>
              </div>

              {payment.notes && (
                <div className={styles.notesSection}>
                  <span className={styles.detailLabel}>Notes</span>
                  <p className={styles.notesText}>{payment.notes}</p>
                </div>
              )}

              {/* Proof of Payment Section */}
              <div className={styles.proofSection}>
                <span className={styles.detailLabel}>Proof of Payment</span>
                <div className={styles.proofImageWrapper}>
                  {payment.fileUrl ? (
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

            {/* Receipt Footer */}
            <div className={styles.receiptFooter}>
              <p>This is an electronically generated receipt.</p>
              <p>© {new Date().getFullYear()} Lincoln Heights Homeowners Association</p>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.secondaryBtn} onClick={onClose}>
            Close
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
