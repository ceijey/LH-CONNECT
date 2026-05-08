'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { logoutAndRedirect } from '@/lib/auth-session';
import { apiCall } from '@/lib/api-client';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import Toast from '@/app/components/Toast';
import LoadingScreen from '@/app/components/LoadingScreen';
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

const ESTABLISHED_PAYMENT_AMOUNT = '400';

export default function SubmitPaymentPage() {
  const router = useRouter();
  useAuthPageshow('resident');
  const [formData, setFormData] = useState<FormData>({
    referenceNumber: '',
    notes: '',
    file: null,
    residentName: '',
    blockLot: '',
    paymentAmount: ESTABLISHED_PAYMENT_AMOUNT,
  });
  const [fileName, setFileName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
      const loadResidentProfile = async () => {
        try {
          const profilePayload = await apiCall('/api/auth/profile');
          const userProfile = (profilePayload.user ?? {}) as UserProfile;
        
          // Prefill form with resident information
          if (isMounted) {
            setFormData(prev => ({
              ...prev,
              residentName: userProfile.fullName ?? '',
              blockLot: userProfile.block && userProfile.lot 
                ? `${userProfile.phase ? userProfile.phase + ' ' : ''}Blk ${userProfile.block} Lot ${userProfile.lot}`
                : '',
              paymentAmount: ESTABLISHED_PAYMENT_AMOUNT,
            }));
          }
        } catch (error) {
          console.error('Failed to load resident profile:', error);
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      };

      loadResidentProfile();
    }, [router, isMounted]);

  useEffect(() => {
    const loadRecentSubmissions = async () => {
      try {
        if (isMounted) setRecentLoading(true);
        const payload = await apiCall('/api/payment-submissions');
        if (isMounted) {
          setRecentSubmissions((payload.submissions ?? []).map((submission: any) => {
            // Parse the submitted date from the string provided by the API
            let month = submission.month;
            if (!month || month === 'Invalid Date') {
              // If month is missing or invalid, try to extract from submittedDate string
              try {
                if (submission.submittedDate && submission.submittedDate !== 'Invalid Date') {
                  const dateObj = new Date(submission.submittedDate);
                  if (!isNaN(dateObj.getTime())) {
                    month = dateObj.toLocaleString(undefined, { month: 'long', year: 'numeric' });
                  }
                }
              } catch (e) {
                console.error('Failed to parse submission date:', submission.submittedDate);
              }
            }
            
            return {
              ...submission,
              month: month || 'Unknown Date',
              amount: Number(submission.paymentAmount ?? 0),
              status: submission.status === 'Verified' ? 'Verified' : 'Pending',
              submittedDate: submission.submittedDate || new Date().toLocaleString(),
            };
          }));
        }
      } catch (error) {
        console.error('Failed to load recent submissions:', error);
        if (isMounted) setRecentSubmissions([]);
      } finally {
        if (isMounted) setRecentLoading(false);
      }
    };

    if (isMounted) {
      loadRecentSubmissions();
    }
  }, [isMounted]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setToast({ message: 'File size must be less than 10MB', type: 'error' });
        return;
      }
      if (isMounted) {
        setFormData({ ...formData, file });
        setFileName(file.name);
      }
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isMounted) {
          setPreview(reader.result as string);
        }
      };
      reader.onerror = () => {
        console.error('Failed to read file');
        if (isMounted) {
          setPreview(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handlePaymentMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const method = e.target.value;
    setPaymentMethod(method);
    
    if (method === 'gcash') {
      window.open('https://www.gcash.com/', '_blank');
    } else if (method === 'maya') {
      window.open('https://www.maya.ph/', '_blank');
    } else if (method === 'bank') {
      window.open('https://www.bdo.com.ph/', '_blank');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.residentName.trim()) {
      setToast({ message: 'Please enter your resident name', type: 'error' });
      return;
    }

    if (!formData.blockLot.trim()) {
      setToast({ message: 'Please enter your block/lot information', type: 'error' });
      return;
    }

    if (!formData.paymentAmount.trim()) {
      setToast({ message: 'Please enter the payment amount', type: 'error' });
      return;
    }

    if (!formData.file) {
      setToast({ message: 'Please upload a payment proof', type: 'error' });
      return;
    }

    if (!formData.referenceNumber.trim()) {
      setToast({ message: 'Please enter a reference number', type: 'error' });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = new FormData();
      payload.append('residentName', formData.residentName.trim());
      payload.append('blockLot', formData.blockLot.trim());
      payload.append('paymentAmount', formData.paymentAmount.trim());
      payload.append('paymentMethod', paymentMethod);
      payload.append('referenceNumber', formData.referenceNumber.trim());
      payload.append('notes', formData.notes.trim());
      payload.append('file', formData.file);

      const response = await fetch('/api/payment-submissions', {
        method: 'POST',
        body: payload,
        credentials: 'include',
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers));

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        const text = await response.text();
        console.error('Response text:', text);
        data = {};
      }

      if (!response.ok) {
        console.error('Payment submission error:', {
          status: response.status,
          statusText: response.statusText,
          data,
        });
        throw new Error(data?.error || `Server error: ${response.status} ${response.statusText}`);
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
      setFormData({ referenceNumber: '', notes: '', file: null, residentName: formData.residentName, blockLot: formData.blockLot, paymentAmount: ESTABLISHED_PAYMENT_AMOUNT });
      setFileName('');
      setPreview(null);
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to submit payment proof', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading payment portal..." />;
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
                    readOnly
                    className={styles.input}
                  />
                </div>

                {/* Payment Method */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Payment Method</label>
                  <select
                    className={styles.select}
                    value={paymentMethod}
                    onChange={handlePaymentMethodChange}
                  >
                    <option value="gcash">GCash</option>
                    <option value="maya">Maya</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>

                {/* Reference Number */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Reference Number</label>
                  <input
                    type="text"
                    name="referenceNumber"
                    value={formData.referenceNumber}
                    onChange={handleInputChange}
                    placeholder="Enter payment reference number"
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
                  {preview && (
                    <div className={styles.previewContainer}>
                      <img 
                        src={preview} 
                        alt="Preview" 
                        className={styles.previewImage}
                        onError={(e) => {
                          console.error('Preview image failed to load:', e);
                          setPreview(null);
                        }}
                      />
                    </div>
                  )}
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

            {/* Submission Status Timeline */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Submission Status</h3>
              <p className={styles.cardDescription}>Track the verification progress of your payment submissions</p>
              
              {recentLoading ? (
                <p className={styles.uploadSmall}>Loading submissions...</p>
              ) : recentSubmissions.length === 0 ? (
                <div className={styles.emptyStateBox}>
                  <p className={styles.emptyStateText}>No submissions yet</p>
                  <p className={styles.uploadSmall}>Submit your first payment proof above to track it here.</p>
                </div>
              ) : (
                <div className={styles.submissionsList}>
                  {recentSubmissions.map((submission) => {
                    const isVerified = submission.status === 'Verified';
                    const daysAgo = submission.submittedDate 
                      ? Math.floor((Date.now() - new Date(submission.submittedDate).getTime()) / (1000 * 60 * 60 * 24))
                      : 0;

                    return (
                      <div key={submission.id ?? `${submission.submittedDate}-${submission.referenceNumber ?? ''}`} className={`${styles.submissionItem} ${isVerified ? styles.verified : styles.pending}`}>
                        {/* Timeline Progress */}
                        <div className={styles.timelineProgress}>
                          <div className={`${styles.timelineStep} ${styles.active}`}>
                            <span className={styles.timelineMarker}>✓</span>
                            <span className={styles.timelineLabel}>Submitted</span>
                          </div>
                          <div className={styles.timelineConnector}></div>
                          <div className={`${styles.timelineStep} ${isVerified ? styles.active : ''}`}>
                            <span className={styles.timelineMarker}>{isVerified ? '✓' : '◯'}</span>
                            <span className={styles.timelineLabel}>In Review</span>
                          </div>
                          <div className={styles.timelineConnector}></div>
                          <div className={`${styles.timelineStep} ${isVerified ? styles.active : ''}`}>
                            <span className={styles.timelineMarker}>{isVerified ? '✓' : '◯'}</span>
                            <span className={styles.timelineLabel}>Verified</span>
                          </div>
                        </div>

                        {/* Submission Details */}
                        <div className={styles.submissionDetails}>
                          <div className={styles.detailsHeader}>
                            <div className={styles.detailsLeft}>
                              <h4 className={styles.submissionMonth}>{submission.month}</h4>
                              <p className={styles.submissionAmount}>₱{submission.amount?.toLocaleString()}</p>
                            </div>
                            <div className={styles.detailsRight}>
                              <span className={`${styles.statusBadge} ${styles[submission.status.toLowerCase()]}`}>
                                {isVerified ? '✓ Verified' : '⏳ Pending'}
                              </span>
                              {daysAgo > 0 && !isVerified && (
                                <p className={styles.timeText}>{daysAgo}d ago</p>
                              )}
                            </div>
                          </div>

                          <div className={styles.detailsGrid}>
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Method</span>
                              <span className={styles.detailValue}>{submission.paymentMethod || 'Unknown'}</span>
                            </div>
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Reference</span>
                              <span className={styles.detailValue}>{submission.referenceNumber || '—'}</span>
                            </div>
                          </div>

                          <div className={styles.statusMessage}>
                            {isVerified ? (
                              <p className={styles.successMsg}>
                                ✓ Your payment has been verified and recorded. Thank you!
                              </p>
                            ) : (
                              <p className={styles.pendingMsg}>
                                Your submission is being reviewed by the HOA. This usually takes 1-2 business days. You'll receive a notification once verified.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
