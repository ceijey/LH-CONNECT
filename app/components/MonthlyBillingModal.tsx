'use client';

import styles from './MonthlyBillingModal.module.css';
import Image from 'next/image';

interface BillingStatement {
  month: string;
  year: number;
  totalDues: number;
  amountPaid: number;
  balance: number;
  dueDate?: string;
  status: string;
}

interface ResidentProfile {
  fullName?: string;
  phase?: string;
  block?: string;
  lot?: string;
}

interface MonthlyBillingModalProps {
  isOpen: boolean;
  statement: BillingStatement | null;
  profile: ResidentProfile | null;
  onClose: () => void;
}

const formatAmount = (amount: number) => (
  `₱${Number(amount || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
);

export default function MonthlyBillingModal({
  isOpen,
  statement,
  profile,
  onClose,
}: MonthlyBillingModalProps) {
  if (!isOpen || !statement) return null;

  const handlePrint = () => {
    document.body.classList.add('billingPrintMode');
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => document.body.classList.remove('billingPrintMode'), 500);
    }, 0);
  };

  const monthlyDue = Number(statement.totalDues || 400);
  const balance = Math.max(0, Number(statement.balance || 0));
  const arrears = Math.max(0, balance - monthlyDue);
  const totalAmountDue = balance;
  const dueDate = statement.dueDate
    ? new Date(statement.dueDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Not specified';
  const address = [
    profile?.phase,
    profile?.block ? `Blk. ${profile.block}` : '',
    profile?.lot ? `Lot ${profile.lot}` : '',
  ].filter(Boolean).join(' ');
  const isPaid = statement.status === 'Paid' || totalAmountDue === 0;

  return (
    <div className={styles.overlay} data-billing-print="true" onClick={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-notice-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <div>
            <span className={styles.eyebrow}>Resident billing notice</span>
            <h2 id="billing-notice-title">Monthly Dues Billing</h2>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close billing notice">
            ×
          </button>
        </header>

        <div className={styles.scrollArea}>
          <article className={styles.notice}>
            <div className={styles.brandRow}>
              <Image
                src="/lhhoa-logo.png"
                alt="Lincoln Heights Homeowners Association"
                width={44}
                height={44}
              />
              <div>
                <h3>Lincoln Heights Homeowners Association</h3>
                <p>Lincoln Heights Subdivision</p>
                <p>San Pablo, Dinalupihan, Bataan</p>
                <p>TIN 480-266-103-000</p>
              </div>
            </div>

            <div className={styles.noticeTitle}>MONTHLY DUES BILLING</div>

            <dl className={styles.details}>
              <div><dt>Name</dt><dd>{profile?.fullName || 'Resident'}</dd></div>
              <div><dt>Address</dt><dd>{address || 'Not specified'}</dd></div>
              <div><dt>Period Covered</dt><dd>{statement.month} {statement.year}</dd></div>
              <div><dt>Monthly Due Bill</dt><dd>{formatAmount(monthlyDue)}</dd></div>
              <div><dt>Arrears</dt><dd className={arrears > 0 ? styles.arrears : ''}>{formatAmount(arrears)}</dd></div>
              <div className={styles.totalRow}><dt>Total Amount Due</dt><dd>{isPaid ? 'PAID' : formatAmount(totalAmountDue)}</dd></div>
              <div><dt>Due Date</dt><dd>{dueDate}</dd></div>
            </dl>

            <div className={styles.notes}>
              <strong>NOTE:</strong>
              <ul>
                <li>Please pay your monthly dues on or before the due date to avoid sanctions.</li>
                <li>If payment has been made, please disregard this bill.</li>
                <li>If you cannot pay on time, please visit the LHHOA Office.</li>
              </ul>
            </div>

            <p className={styles.thankYou}>Thank You</p>
            <footer className={styles.noticeFooter}>
              This is an electronically generated billing notice.<br />
              © {new Date().getFullYear()} Lincoln Heights Homeowners Association
            </footer>
          </article>
        </div>

        <footer className={styles.modalFooter}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>Close</button>
          <button type="button" className={styles.printButton} onClick={handlePrint}>
            🖨️ Print / Save PDF
          </button>
        </footer>
      </section>
    </div>
  );
}
