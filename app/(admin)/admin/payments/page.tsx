'use client';

import { startTransition, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import Skeleton from '@/app/components/Skeleton';
import ConfirmationModal from '@/app/components/ConfirmationModal';
import ImageModal from '@/app/components/ImageModal';
import ReceiptModal from '@/app/components/ReceiptModal';
import styles from '../residents/admin-page.module.css';

interface PaymentSubmission {
  id: string;
  month?: string;
  residentId: string;
  residentName: string;
  blockLot: string;
  paymentAmount: number;
  paymentMethod: string;
  referenceNumber: string;
  fileName?: string;
  fileUrl?: string;
  filePath?: string;
  status: 'Verified' | 'Pending' | 'Rejected';
  submittedDate: string;
  verifiedDate?: string;
  notes?: string;
  paymentDateTime?: string;
  receiptAmount?: string;
}

type ProofKind = 'image' | 'pdf' | 'none';

export default function AdminPayments() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Pending' | 'Verified' | 'Declined'>('Pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [allPayments, setAllPayments] = useState<PaymentSubmission[]>([]);
  
  // Modal states
  const [proofModal, setProofModal] = useState<{ isOpen: boolean; url: string; title: string; proofKind: ProofKind }>({
    isOpen: false,
    url: '',
    title: '',
    proofKind: 'none'
  });
  const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean; payment: PaymentSubmission | null }>({
    isOpen: false,
    payment: null
  });
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    type: 'Approve' | 'Reject' | 'Delete';
    id: string;
    name: string;
    imageUrl?: string;
  }>({
    isOpen: false,
    type: 'Approve',
    id: '',
    name: '',
    imageUrl: ''
  });
  const [rejectionReason, setRejectionReason] = useState('');

  const detectProofKind = (payment: PaymentSubmission): ProofKind => {
    const sample = `${payment.fileName || ''} ${payment.filePath || ''} ${payment.fileUrl || ''}`.toLowerCase();
    if (!sample.trim()) return 'none';
    if (sample.includes('.pdf') || sample.includes('application/pdf') || sample.includes('application%2fpdf')) {
      return 'pdf';
    }
    return 'image';
  };

  const fetchPayments = async () => {
    try {
      const data = await apiCall('/api/payment-submissions');
      setAllPayments(data.submissions || []);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleAction = async () => {
    const { type, id } = actionModal;
    const reason = rejectionReason;
    
    // Close modal and reset reason immediately for UI feedback
    setActionModal(prev => ({ ...prev, isOpen: false }));
    setRejectionReason('');
    
    try {
      if (type === 'Delete') {
        await apiCall(`/api/payment-submissions/${id}`, { method: 'DELETE' });
      } else {
        const status = type === 'Approve' ? 'Verified' : 'Rejected';
        await apiCall(`/api/payment-submissions/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ 
            status,
            rejectionReason: status === 'Rejected' ? reason : undefined
          })
        });
      }
      // Refresh list
      fetchPayments();
    } catch (error: any) {
      alert(`Error: ${error.message || 'Operation failed'}`);
    }
  };

  const filteredPayments = allPayments.filter((payment) => {
    const matchesStatus = activeTab === 'Declined' ? payment.status === 'Rejected' : payment.status === activeTab;
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return matchesStatus;
    }

    return matchesStatus && [
      payment.id,
      payment.residentName,
      payment.blockLot,
      payment.paymentMethod,
      payment.submittedDate,
      payment.referenceNumber
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch));
  });

  const pendingCount = allPayments.filter(p => p.status === 'Pending').length;
  const verifiedCount = allPayments.filter(p => p.status === 'Verified').length;
  const rejectedCount = allPayments.filter(p => p.status === 'Rejected').length;

  if (isLoading) {
    return (
      <div>
        {/* Stats Grid Skeleton */}
        <div className={styles.statsGrid}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.registryStat}>
              <Skeleton height="0.875rem" width="70%" style={{ marginBottom: '0.75rem' }} />
              <Skeleton height="2rem" width="60%" />
            </div>
          ))}
        </div>

        {/* Tabs and Table Skeleton */}
        <div className={styles.content}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height="40px" width="120px" />
            ))}
          </div>

          <div className={styles.searchSection}>
            <Skeleton height="40px" style={{ flex: 1 }} />
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Block/Lot</th>
                  <th>Amount</th>
                  <th>Date/Time</th>
                  <th>Method</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td>
                      <Skeleton height="0.9rem" width="160px" />
                    </td>
                    <td>
                      <div className={styles.blockLot}>
                        <Skeleton height="1rem" width="78px" borderRadius="4px" />
                        <Skeleton height="0.875rem" width="130px" />
                      </div>
                    </td>
                    <td>
                      <Skeleton height="0.9rem" width="100px" />
                    </td>
                    <td>
                      <Skeleton height="0.875rem" width="120px" style={{ marginBottom: '0.25rem' }} />
                      <Skeleton height="0.8rem" width="95px" />
                    </td>
                    <td>
                      <Skeleton height="0.9rem" width="100px" />
                    </td>
                    <td className={styles.paymentActions}>
                      <Skeleton height="2rem" width="88px" borderRadius="4px" />
                      <Skeleton height="2rem" width="2rem" borderRadius="4px" />
                      <Skeleton height="2rem" width="2rem" borderRadius="4px" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConfirmationModal
        isOpen={actionModal.isOpen}
        title={actionModal.type === 'Reject' ? 'Decline Payment' : `${actionModal.type} Payment`}
        message={
          actionModal.type === 'Reject' 
            ? `Please provide a reason for declining the payment from ${actionModal.name}.`
            : `Are you sure you want to ${actionModal.type.toLowerCase()} this payment from ${actionModal.name}?`
        }
        confirmText={actionModal.type === 'Approve' ? 'Verify' : (actionModal.type === 'Reject' ? 'Decline' : actionModal.type)}
        onConfirm={handleAction}
        onCancel={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
        isDangerous={actionModal.type !== 'Approve'}
        showInput={actionModal.type === 'Reject'}
        inputValue={rejectionReason}
        onInputChange={setRejectionReason}
        inputPlaceholder="Reason for declining (e.g., Invalid reference number, amount mismatch...)"
        imageUrl={actionModal.imageUrl}
      />

      <ImageModal
        isOpen={proofModal.isOpen}
        imageUrl={proofModal.url}
        title={proofModal.title}
        proofKind={proofModal.proofKind}
        onClose={() => setProofModal(prev => ({ ...prev, isOpen: false }))}
      />

      <ReceiptModal
        isOpen={receiptModal.isOpen}
        payment={receiptModal.payment}
        onClose={() => setReceiptModal(prev => ({ ...prev, isOpen: false }))}
      />

      <div className={styles.content}>
          <div className={styles.statsGrid}>
            <div className={styles.registryStat}>
              <div className={styles.registryStatIcon}>⏳</div>
              <div className={styles.registryStatInfo}>
                <span className={styles.registryStatLabel}>Pending</span>
                <span className={styles.registryStatValue}>{pendingCount}</span>
              </div>
            </div>
            <div className={styles.registryStat}>
              <div className={styles.registryStatIcon}>✓</div>
              <div className={styles.registryStatInfo}>
                <span className={styles.registryStatLabel}>Verified</span>
                <span className={styles.registryStatValue}>{verifiedCount}</span>
              </div>
            </div>
            <div className={styles.registryStat}>
              <div className={styles.registryStatIcon}>✕</div>
              <div className={styles.registryStatInfo}>
                <span className={styles.registryStatLabel}>Rejected</span>
                <span className={styles.registryStatValue}>{rejectedCount}</span>
              </div>
            </div>
          </div>

          <div className={styles.controlsSection} style={{ marginBottom: '20px' }}>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by resident, payment ID, block, lot, or method..."
              className={styles.searchInput}
              style={{ width: '100%', maxWidth: '420px' }}
            />
          </div>

          {/* Tabs */}
          <div className={styles.tabsContainer}>
            <button 
              className={`${styles.tab} ${activeTab === 'Pending' ? styles.active : ''}`}
              onClick={() => startTransition(() => setActiveTab('Pending'))}
            >
              ⏳ Pending ({pendingCount})
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'Verified' ? styles.active : ''}`}
              onClick={() => startTransition(() => setActiveTab('Verified'))}
            >
              ✓ Verified ({verifiedCount})
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'Declined' ? styles.active : ''}`}
              onClick={() => startTransition(() => setActiveTab('Declined'))}
            >
              ✕ Declined ({rejectedCount})
            </button>
          </div>

          <div className={styles.sectionTitle}>
            {activeTab === 'Pending' && '⏳ Pending Payment Verifications'}
            {activeTab === 'Verified' && '✓ Verified Payments'}
            {activeTab === 'Declined' && '✕ Declined Payments'}
          </div>
          
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Block/Lot</th>
                  <th>Amount</th>
                  <th>Proof</th>
                  <th>Notes</th>
                  <th>Date/Time</th>
                  <th>Method</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length > 0 ? (
                  filteredPayments.map((payment) => {
                    const proofKind = detectProofKind(payment);
                    // Use the proxy endpoint for all images to avoid Vercel payload limits
                    const proofSrc = `/api/payment-submissions/${payment.id}/proof?v=${Date.now()}`;

                    // Extract block/lot/phase from string "Phase X Blk Y Lot Z" if possible
                    const addressParts = payment.blockLot.split(' ');
                    const phase = addressParts[0] === 'Phase' ? `${addressParts[0]} ${addressParts[1]}` : 'N/A';
                    const blkLot = payment.blockLot.replace(phase, '').trim();

                    return (
                      <tr key={payment.id}>
                        <td className={styles.resident}>{payment.residentName}</td>
                        <td>
                          <div className={styles.blockLot}>
                            <span className={styles.phaseBadge}>{phase}</span>
                            <span className={styles.blockLotText}>{blkLot}</span>
                          </div>
                        </td>
                        <td className={styles.amount}>₱{payment.paymentAmount.toLocaleString()}</td>
                        <td>
                          {proofSrc ? (
                            <div className={styles.proofActions}>
                              <div 
                                className={styles.thumbnailWrapper}
                                onClick={() => setProofModal({
                                  isOpen: true,
                                  url: proofSrc,
                                  title: `Payment Proof - ${payment.residentName}`,
                                  proofKind
                                })}
                              >
                                {proofKind === 'pdf' ? (
                                  <span className={styles.noProof}>PDF</span>
                                ) : (
                                  <img src={proofSrc} alt="Proof" className={styles.thumbnail} />
                                )}
                              </div>
                              {payment.fileUrl && (
                                <a 
                                  href={payment.fileUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className={styles.urlLink}
                                  title="Open Direct URL"
                                >
                                  🔗 URL
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className={styles.noProof}>No Proof</span>
                          )}
                        </td>
                        <td className={styles.notesTd} title={payment.notes}>
                          {payment.notes ? (
                            <span className={styles.notesText}>{payment.notes}</span>
                          ) : (
                            <span className={styles.noNotes}>—</span>
                          )}
                        </td>
                        <td className={styles.datetime}>
                          <div>{payment.status === 'Verified' ? payment.verifiedDate : payment.submittedDate}</div>
                          {payment.paymentDateTime && (
                            <div className={styles.paymentDateTimeSubtext} style={{ fontSize: '0.75rem', color: '#ff9800', marginTop: '4px', fontWeight: 'bold' }}>
                              🗓️ Proof: {new Date(payment.paymentDateTime).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          )}
                          {payment.receiptAmount && (
                            <div className={styles.paymentDateTimeSubtext} style={{ fontSize: '0.75rem', color: '#4caf50', marginTop: '4px', fontWeight: 'bold' }}>
                              💵 Scanned: ₱{Number(payment.receiptAmount).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </div>
                          )}
                        </td>
                        <td>{payment.paymentMethod}</td>
                        <td className={styles.paymentActions}>
                          {payment.status === 'Pending' && (
                            <>
                              <button 
                                className={styles.approveBtn} 
                                title="Approve Payment"
                                onClick={() => setActionModal({
                                  isOpen: true,
                                  type: 'Approve',
                                  id: payment.id,
                                  name: payment.residentName,
                                  imageUrl: proofKind === 'image' ? proofSrc : undefined
                                })}
                              >
                                ✓ Verify Payment
                              </button>
                              <button 
                                className={styles.rejectBtn} 
                                title="Decline Payment"
                                onClick={() => setActionModal({
                                  isOpen: true,
                                  type: 'Reject',
                                  id: payment.id,
                                  name: payment.residentName,
                                  imageUrl: proofKind === 'image' ? proofSrc : undefined
                                })}
                              >
                                ✕ Decline
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#9E9E9E' }}>
                      No {activeTab.toLowerCase()} payments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </div>
    </>
  );
}
