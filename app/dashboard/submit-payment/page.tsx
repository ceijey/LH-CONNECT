'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import styles from './submit-payment.module.css';

interface FormData {
  referenceNumber: string;
  notes: string;
  file: File | null;
  residentName: string;
  blockLot: string;
  paymentAmount: string;
}

interface Submission {
  month: string;
  amount: number;
  status: 'Verified' | 'Pending';
  submittedDate: string;
  verifiedDate?: string;
}

export default function SubmitPaymentPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    referenceNumber: '',
    notes: '',
    file: null,
    residentName: 'Juan dela Cruz',
    blockLot: 'Phase 1 Blk 2 Lot 10',
    paymentAmount: '500',
  });
  const [fileName, setFileName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const paymentMethod = 'GCash';

  const recentSubmissions: Submission[] = [
    {
      month: 'February 2026',
      amount: 500,
      status: 'Verified',
      submittedDate: 'Feb 22, 2026 10:30 AM',
      verifiedDate: 'Feb 22, 2026 11:00 AM',
    },
    {
      month: 'January 2026',
      amount: 500,
      status: 'Verified',
      submittedDate: 'Jan 20, 2026 09:15 AM',
      verifiedDate: 'Jan 20, 2026 02:30 PM',
    },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setFormData({ ...formData, file });
      setFileName(file.name);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.file) {
      alert('Please upload a payment proof');
      return;
    }

    if (!formData.referenceNumber.trim()) {
      alert('Please enter an OR number');
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      alert('Payment proof submitted successfully!');
      setFormData({ referenceNumber: '', notes: '', file: null, residentName: 'Juan dela Cruz', blockLot: 'Phase 1 Blk 2 Lot 10', paymentAmount: '500' });
      setFileName('');
      setIsSubmitting(false);
    }, 1500);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLefty}>
            <Link href="/dashboard" className={styles.backBtn}>
              ← Back
            </Link>
            <div className={styles.headerBrand}>
              <span className={styles.headerIcon}>🏠</span>
              <div>
                <h1 className={styles.headerTitle}>LH-Connect</h1>
                <p className={styles.headerSubtitle}>Submit Payment</p>
              </div>
            </div>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={() => {
              localStorage.removeItem('isAuthenticated');
              localStorage.removeItem('userEmail');
              router.push('/');
            }}
          >
            ⬅ Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.contentWrapper}>
          {/* Left Column - Form */}
          <section className={styles.formSection}>
            <div className={styles.formCard}>
              <h2 className={styles.formTitle}>60-Second Proof-of-Payment</h2>
              <p className={styles.formDescription}>
                Upload your GCash, Maya, Bank Transfer, or Cash payment screenshot for instant verification
              </p>

              <form onSubmit={handleSubmit} className={styles.form}>
                {/* Resident Name */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Resident Name</label>
                  <input
                    type="text"
                    name="residentName"
                    value={formData.residentName}
                    onChange={handleInputChange}
                    className={styles.input}
                  />
                </div>

                {/* Block/Lot */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Block/Lot</label>
                  <input
                    type="text"
                    name="blockLot"
                    value={formData.blockLot}
                    onChange={handleInputChange}
                    className={styles.input}
                  />
                </div>

                {/* Payment Amount */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Payment Amount</label>
                  <input
                    type="text"
                    name="paymentAmount"
                    value={`₱${formData.paymentAmount}`}
                    onChange={(e) => {
                      const value = e.target.value.replace('₱', '');
                      setFormData({ ...formData, paymentAmount: value });
                    }}
                    className={styles.input}
                  />
                </div>

                {/* Payment Method */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Payment Method</label>
                  <select className={styles.select}>
                    <option value="gcash">GCash</option>
                    <option value="maya">Maya</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>

                {/* OR Number */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>OR Number</label>
                  <input
                    type="text"
                    name="referenceNumber"
                    value={formData.referenceNumber}
                    onChange={handleInputChange}
                    placeholder="Enter Official Receipt number"
                    className={styles.input}
                  />
                </div>

                {/* Upload Payment Proof */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Upload Payment Proof</label>
                  <div className={styles.uploadBox}>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className={styles.fileInput}
                      id="fileInput"
                    />
                    <label htmlFor="fileInput" className={styles.uploadLabel}>
                      <div className={styles.uploadIcon}>📁</div>
                      {fileName ? (
                        <div>
                          <p className={styles.uploadText}>✓ {fileName}</p>
                          <p className={styles.uploadSmall}>Click to change</p>
                        </div>
                      ) : (
                        <div>
                          <p className={styles.uploadText}>Click to upload screenshot</p>
                          <p className={styles.uploadSmall}>PNG, JPG up to 10MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Notes */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Notes (Optional)</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Add any additional information..."
                    className={styles.textarea}
                    rows={3}
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={styles.submitBtn}
                >
                  ⬇ {isSubmitting ? 'Submitting...' : 'Submit Payment Proof'}
                </button>
              </form>
            </div>
          </section>

          {/* Right Column - Instructions & Recent */}
          <aside className={styles.rightColumn}>
            {/* Payment Instructions */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Payment Instructions</h3>
              <ol className={styles.instructionsList}>
                <li className={styles.instructionItem}>
                  <span className={styles.stepNumber}>1</span>
                  <div>
                    <strong>Send Payment</strong>
                    <p>Transfer your monthly dues via GCash, Maya, Bank Transfer, or Cash to the HOA account</p>
                  </div>
                </li>
                <li className={styles.instructionItem}>
                  <span className={styles.stepNumber}>2</span>
                  <div>
                    <strong>Take Screenshot</strong>
                    <p>Capture the confirmation screen showing the transaction details</p>
                  </div>
                </li>
                <li className={styles.instructionItem}>
                  <span className={styles.stepNumber}>3</span>
                  <div>
                    <strong>Upload & Submit</strong>
                    <p>Fill in the form and upload your screenshot for instant verification</p>
                  </div>
                </li>
              </ol>

              {/* HOA Payment Details */}
              <div className={styles.hoaDetails}>
                <h4 className={styles.hoaTitle}>HOA Payment Details:</h4>
                <ul className={styles.detailsList}>
                  <li>
                    <strong>GCash:</strong> 0917-123-4567
                  </li>
                  <li>
                    <strong>Maya:</strong> 0918-765-4321
                  </li>
                  <li>
                    <strong>Bank Transfer:</strong> BDO Account 12345-6789
                  </li>
                  <li>
                    <strong>Cash:</strong> Pay directly at HOA office
                  </li>
                  <li>
                    <strong>HOA Name:</strong> Lincoln Heights HOA
                  </li>
                </ul>
              </div>
            </div>

            {/* Recent Submissions */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Recent Submissions</h3>
              <div className={styles.submissionsList}>
                {recentSubmissions.map((submission, index) => (
                  <div key={index} className={styles.submissionItem}>
                    <div className={styles.submissionHeader}>
                      <div>
                        <h4 className={styles.submissionMonth}>{submission.month}</h4>
                        <p className={styles.submissionAmount}>₱{submission.amount}</p>
                      </div>
                      <span className={`${styles.badge} ${styles[submission.status.toLowerCase()]}`}>
                        ✓ {submission.status}
                      </span>
                    </div>
                    <p className={styles.submissionDate}>
                      Submitted: {submission.submittedDate}
                    </p>
                    {submission.verifiedDate && (
                      <p className={styles.verifiedDate}>
                        Verified: {submission.verifiedDate}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
