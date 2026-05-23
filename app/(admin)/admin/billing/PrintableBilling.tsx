'use client';

import { forwardRef } from 'react';
import styles from '@/app/components/ReceiptModal.module.css';

interface BillData {
  residentName: string;
  blockLot: string;
  periodCovered: string;
  monthlyDueBill: number;
  arrears: number;
  totalAmountDue: number;
  dueDate: string;
  isPaid: boolean;
}

interface PrintableBillingProps {
  bills: BillData[];
}

export const PrintableBilling = forwardRef<HTMLDivElement, PrintableBillingProps>(
  ({ bills }, ref) => {
    const renderReceipt = (bill: BillData, index: number) => (
      <div key={index} className={styles.receiptContainer}>
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
              <td className={styles.fieldValue}>{bill.residentName || '—'}</td>
            </tr>
            <tr>
              <td className={styles.fieldLabel}>Address</td>
              <td className={styles.fieldColon}>:</td>
              <td className={styles.fieldValue}>{bill.blockLot || '—'}</td>
            </tr>
            <tr>
              <td className={styles.fieldLabel}>Period Covered</td>
              <td className={styles.fieldColon}>:</td>
              <td className={styles.fieldValue}>{bill.periodCovered || '—'}</td>
            </tr>
            <tr>
              <td className={styles.fieldLabel}>Monthly Due Bill</td>
              <td className={styles.fieldColon}>:</td>
              <td className={styles.fieldValue}>{bill.monthlyDueBill.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td className={styles.fieldLabel}>Arrears</td>
              <td className={styles.fieldColon}>:</td>
              <td className={styles.fieldValue}>{bill.arrears > 0 ? bill.arrears.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '—'}</td>
            </tr>
            <tr className={styles.totalRow}>
              <td className={styles.totalLabel}>Total Amount Due</td>
              <td className={styles.totalColon}>:</td>
              <td className={styles.totalValue}>
                {bill.isPaid ? (
                  <span className={styles.paidBadge}>PAID</span>
                ) : (
                  <span style={{ fontWeight: 'bold' }}>{bill.totalAmountDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                )}
              </td>
            </tr>
            <tr>
              <td className={styles.fieldLabel}>Due Date</td>
              <td className={styles.fieldColon}>:</td>
              <td className={styles.fieldValue}>{bill.dueDate || '—'}</td>
            </tr>
          </tbody>
        </table>

        {/* Notes Section */}
        <div className={styles.notesSection}>
          <p className={styles.notesTitle}>Note:</p>
          <ul className={styles.notesList}>
            <li>Please pay your monthly dues on/or before due date to avoid sanctions.</li>
            <li>If payment has been made, please disregard this bill.</li>
            <li>If you cannot pay your monthly due bill on time, please visit LHHOA Office.</li>
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
    );

    return (
      <div className={styles.printGrid} ref={ref}>
        {bills.map((bill, i) => renderReceipt(bill, i))}
      </div>
    );
  }
);

PrintableBilling.displayName = 'PrintableBilling';
