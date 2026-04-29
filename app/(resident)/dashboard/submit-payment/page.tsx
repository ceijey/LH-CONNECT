'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { logoutAndRedirect } from '@/lib/auth-session';
import { apiCall } from '@/lib/api-client';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import Toast from '@/app/components/Toast';
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
  id?: string;
  month: string;
  amount: number;
  status: 'Verified' | 'Pending';
  submittedDate: string;
  verifiedDate?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  fileName?: string;
  fileUrl?: string;
}

interface UserProfile {
  fullName?: string;
  phase?: string;
  block?: string;
  lot?: string;
  balance?: number;
}

export default function SubmitPaymentPage() {
  const router = useRouter();
  useAuthPageshow('resident');
  const [formData, setFormData] = useState<FormData>({
    referenceNumber: '',
    notes: '',
    file: null,
    residentName: '',
    blockLot: '',
    paymentAmount: '',
  });
  const [fileName, setFileName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
      const loadResidentProfile = async () => {
        try {
          const profilePayload = await apiCall('/api/auth/profile');
          const userProfile = (profilePayload.user ?? {}) as UserProfile;
        
          // Prefill form with resident information
          setFormData(prev => ({
            ...prev,
            residentName: userProfile.fullName ?? '',
            blockLot: userProfile.block && userProfile.lot 
              ? `${userProfile.phase ? userProfile.phase + ' ' : ''}Blk ${userProfile.block} Lot ${userProfile.lot}`
              : '',
          }));
        } catch (error) {
          console.error('Failed to load resident profile:', error);
        } finally {
          setIsLoading(false);
        }
      };

      loadResidentProfile();
    }, [router]);

  useEffect(() => {
    const loadRecentSubmissions = async () => {
      try {
        setRecentLoading(true);
        const payload = await apiCall('/api/payment-submissions');
        setRecentSubmissions((payload.submissions ?? []).map((submission: any) => ({
          ...submission,
          month: submission.month ?? new Date(submission.submittedAt ?? Date.now()).toLocaleString(undefined, { month: 'long', year: 'numeric' }),
          amount: Number(submission.paymentAmount ?? 0),
          status: submission.status === 'Verified' ? 'Verified' : 'Pending',
          submittedDate: submission.submittedDate ?? new Date(submission.submittedAt ?? Date.now()).toLocaleString(),
        })));
      } catch (error) {
        console.error('Failed to load recent submissions:', error);
        setRecentSubmissions([]);
      } finally {
        setRecentLoading(false);
      }
    };

    loadRecentSubmissions();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setToast({ message: 'File size must be less than 10MB', type: 'error' });
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
      setToast({ message: 'Please upload a payment proof', type: 'error' });
      return;
    }

    if (!formData.referenceNumber.trim()) {
      setToast({ message: 'Please enter an OR number', type: 'error' });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = new FormData();
      payload.append('residentName', formData.residentName);
      payload.append('blockLot', formData.blockLot);
      payload.append('paymentAmount', formData.paymentAmount);
      payload.append('paymentMethod', paymentMethod);
      payload.append('referenceNumber', formData.referenceNumber);
      payload.append('notes', formData.notes);
      payload.append('file', formData.file);

      const response = await fetch('/api/payment-submissions', {
        method: 'POST',
        body: payload,
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to submit payment proof');
      }

      const submission = data.submission as Submission;

      setRecentSubmissions((current) => [
        {
          ...submission,
          month: submission.month ?? new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' }),
          amount: Number(submission.amount ?? (Number(formData.paymentAmount) || 0)),
          status: submission.status ?? 'Pending',
          submittedDate: submission.submittedDate ?? new Date().toLocaleString(),
        },
        ...current,
      ]);

      setToast({ message: 'Payment proof submitted successfully!', type: 'success' });
      setFormData({ referenceNumber: '', notes: '', file: null, residentName: formData.residentName, blockLot: formData.blockLot, paymentAmount: '' });
      setFileName('');
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to submit payment proof', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <Toast
        isVisible={toast !== null}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'info'}
        onClose={() => setToast(null)}
      />
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLefty}>
            <Link href="/dashboard" className={styles.backBtn}>
              ← Back
            </Link>
            <div className={styles.headerBrand}>
              <Image
                src="/lhhoa-logo.png"
                alt="LHHOA Logo"
                width={50}
                height={50}
                className={styles.headerIcon}
                priority
              />
              <div>
                <h1 className={styles.headerTitle}>LH-Connect</h1>
                <p className={styles.headerSubtitle}>Submit Payment</p>
              </div>
            </div>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={async () => {
              await logoutAndRedirect(router, '/');
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
                  <select
                    className={styles.select}
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
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
                {recentLoading ? (
                  <p className={styles.uploadSmall}>Loading recent submissions...</p>
                ) : recentSubmissions.length === 0 ? (
                  <p className={styles.uploadSmall}>No recent submissions yet.</p>
                ) : (
                  recentSubmissions.map((submission) => (
                    <div key={submission.id ?? `${submission.submittedDate}-${submission.referenceNumber ?? ''}`} className={styles.submissionItem}>
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
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
