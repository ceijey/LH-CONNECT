'use client';

import { useRouter } from 'next/navigation';
import styles from './DueBillPopup.module.css';

interface DueBillPopupProps {
  isOpen: boolean;
  dueAmount: number;
  dueMonth: string;
  onDismiss: () => void;
}

export default function DueBillPopup({
  isOpen,
  dueAmount,
  dueMonth,
  onDismiss,
}: DueBillPopupProps) {
  const router = useRouter();

  const handleViewDetails = () => {
    router.push('/dashboard/payment-details');
    onDismiss();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onDismiss}>
      <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.icon}>📋</div>
          <h2 className={styles.title}>Payment Due</h2>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <div className={styles.amountSection}>
            <div className={styles.label}>Amount Due</div>
            <div className={styles.amount}>₱{dueAmount.toLocaleString()}</div>
            <div className={styles.month}>For {dueMonth}</div>
          </div>

          <p className={styles.message}>
            You have an outstanding payment due for this month. Please submit your payment as soon as possible to avoid penalties.
          </p>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.buttonGroup}>
            <button className={`${styles.button} ${styles.dismissBtn}`} onClick={onDismiss}>
              Dismiss
            </button>
            <button className={`${styles.button} ${styles.viewDetailsBtn}`} onClick={handleViewDetails}>
              View Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
