'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import ConfirmationModal from '@/app/components/ConfirmationModal';
import ImageModal from '@/app/components/ImageModal';
import styles from '../residents/admin-page.module.css';

interface PaymentSubmission {
  id: string;
  residentId: string;
  residentName: string;
  blockLot: string;
  paymentAmount: number;
  paymentMethod: string;
  referenceNumber: string;
  fileUrl?: string;
  status: 'Verified' | 'Pending' | 'Rejected';
  submittedDate: string;
  verifiedDate?: string;
}

export default function AdminPayments() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Pending' | 'Verified' | 'Rejected'>('Pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [allPayments, setAllPayments] = useState<PaymentSubmission[]>([]);
  
  // Modal states
  const [proofModal, setProofModal] = useState<{ isOpen: boolean; url: string; title: string }>({
    isOpen: false,
    url: '',
    title: ''
  });
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    type: 'Approve' | 'Reject' | 'Delete';
    id: string;
    name: string;
  }>({
    isOpen: false,
    type: 'Approve',
    id: '',
    name: ''
  });
  const [rejectionReason, setRejectionReason] = useState('');

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
    const matchesStatus = payment.status === activeTab;
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

  if (isLoading) return <div className={styles.loading}>Loading payments...</div>;

  return (
    <>
      <ConfirmationModal
        isOpen={actionModal.isOpen}
        title={`${actionModal.type} Payment`}
        message={
          actionModal.type === 'Reject' 
            ? `Please provide a reason for rejecting the payment from ${actionModal.name}.`
            : `Are you sure you want to ${actionModal.type.toLowerCase()} this payment from ${actionModal.name}?`
        }
        confirmText={actionModal.type === 'Approve' ? 'Verify' : actionModal.type}
        onConfirm={handleAction}
        onCancel={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
        isDangerous={actionModal.type !== 'Approve'}
        showInput={actionModal.type === 'Reject'}
        inputValue={rejectionReason}
        onInputChange={setRejectionReason}
        inputPlaceholder="Reason for rejection (e.g., Invalid reference number, amount mismatch...)"
      />

      <ImageModal
        isOpen={proofModal.isOpen}
        imageUrl={proofModal.url}
        title={proofModal.title}
        onClose={() => setProofModal(prev => ({ ...prev, isOpen: false }))}
      />

      <div className={styles.content}>
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
              onClick={() => setActiveTab('Pending')}
            >
              ⏳ Pending ({pendingCount})
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'Verified' ? styles.active : ''}`}
              onClick={() => setActiveTab('Verified')}
            >
              ✓ Verified ({verifiedCount})
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'Rejected' ? styles.active : ''}`}
              onClick={() => setActiveTab('Rejected')}
            >
              ✕ Rejected ({rejectedCount})
            </button>
          </div>

          <div className={styles.sectionTitle}>
            {activeTab === 'Pending' && '⏳ Pending Payment Verifications'}
            {activeTab === 'Verified' && '✓ Verified Payments'}
            {activeTab === 'Rejected' && '✕ Rejected Payments'}
          </div>
          
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Resident</th>
                  <th>Block/Lot</th>
                  <th>Amount</th>
                  <th>Date/Time</th>
                  <th>Method</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length > 0 ? (
                  filteredPayments.map((payment) => {
                    // Extract block/lot/phase from string "Phase X Blk Y Lot Z" if possible
                    const addressParts = payment.blockLot.split(' ');
                    const phase = addressParts[0] === 'Phase' ? `${addressParts[0]} ${addressParts[1]}` : 'N/A';
                    const blkLot = payment.blockLot.replace(phase, '').trim();

                    return (
                      <tr key={payment.id}>
                        <td className={styles.paymentId}>
                          <span className={styles.idBadge} title={payment.id}>{payment.id}</span>
                        </td>
                        <td className={styles.resident}>{payment.residentName}</td>
                        <td>
                          <div className={styles.blockLot}>
                            <span className={styles.phaseBadge}>{phase}</span>
                            <span className={styles.blockLotText}>{blkLot}</span>
                          </div>
                        </td>
                        <td className={styles.amount}>₱{payment.paymentAmount.toLocaleString()}</td>
                        <td className={styles.datetime}>
                          <div>{payment.status === 'Verified' ? payment.verifiedDate : payment.submittedDate}</div>
                        </td>
                        <td>{payment.paymentMethod}</td>
                        <td className={styles.paymentActions}>
                          <button 
                            className={styles.viewProofBtn} 
                            title="View Proof"
                            onClick={() => {
                              if (!payment.fileUrl) {
                                alert('No proof of payment was uploaded for this submission.');
                                return;
                              }
                              setProofModal({
                                isOpen: true,
                                url: payment.fileUrl,
                                title: `Payment Proof - ${payment.residentName}`
                              });
                            }}
                          >
                            🖼️ View Proof
                          </button>
                          {payment.status === 'Pending' && (
                            <>
                              <button 
                                className={styles.approveBtn} 
                                title="Approve"
                                onClick={() => setActionModal({
                                  isOpen: true,
                                  type: 'Approve',
                                  id: payment.id,
                                  name: payment.residentName
                                })}
                              >
                                ✓
                              </button>
                              <button 
                                className={styles.rejectBtn} 
                                title="Reject"
                                onClick={() => setActionModal({
                                  isOpen: true,
                                  type: 'Reject',
                                  id: payment.id,
                                  name: payment.residentName
                                })}
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: '#9E9E9E' }}>
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
