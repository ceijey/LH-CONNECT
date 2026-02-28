'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Html5QrcodeScanner } from 'html5-qrcode';
import styles from './qr-scanner.module.css';

interface ResidentData {
  id: string;
  name: string;
  email: string;
  phone: string;
  phase: string;
  block: string;
  lot: string;
  monthlyDues: number;
  balance: number;
  status: 'Paid' | 'Pending' | 'Delinquent';
  lastPayment: string;
  lastPaymentAmount: number;
}

const residentsDatabase: Record<string, ResidentData> = {
  'RES001': {
    id: 'RES001',
    name: 'Juan dela Cruz',
    email: 'juan@email.com',
    phone: '0917-123-4567',
    phase: 'Phase 1',
    block: '1',
    lot: '5',
    monthlyDues: 500,
    balance: 0,
    status: 'Paid',
    lastPayment: 'Feb 28, 2026',
    lastPaymentAmount: 500,
  },
  'RES002': {
    id: 'RES002',
    name: 'Maria Santos',
    email: 'maria@email.com',
    phone: '0918-987-6543',
    phase: 'Phase 2',
    block: '2',
    lot: '8',
    monthlyDues: 500,
    balance: 500,
    status: 'Pending',
    lastPayment: 'Jan 30, 2026',
    lastPaymentAmount: 500,
  },
  'RES003': {
    id: 'RES003',
    name: 'Carlos Rodriguez',
    email: 'carlos@email.com',
    phone: '0919-456-7890',
    phase: 'Phase 1',
    block: '3',
    lot: '12',
    monthlyDues: 500,
    balance: 1500,
    status: 'Delinquent',
    lastPayment: 'Dec 15, 2025',
    lastPaymentAmount: 500,
  },
  'RES004': {
    id: 'RES004',
    name: 'Ana Garcia',
    email: 'ana@email.com',
    phone: '0920-321-6547',
    phase: 'Phase 3',
    block: '4',
    lot: '2',
    monthlyDues: 500,
    balance: 0,
    status: 'Paid',
    lastPayment: 'Feb 25, 2026',
    lastPaymentAmount: 500,
  },
};

export default function QRScannerPage() {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [scannedResident, setScannedResident] = useState<ResidentData | null>(null);
  const [scanError, setScanError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (isScanning && !scannerRef.current) {
      try {
        const scanner = new Html5QrcodeScanner('qr-reader', {
          fps: 10,
          qrbox: 250,
          aspectRatio: 1,
        }, false);

        scanner.render(
          (decodedText) => {
            // Parse the QR code data
            const residentId = decodedText.trim();
            const resident = residentsDatabase[residentId];

            if (resident) {
              setScannedResident(resident);
              setScanError('');
              scanner.pause();
            } else {
              setScanError(`Resident not found. ID: ${residentId}`);
            }
          },
          (error) => {
            // Silently fail on scan errors
          }
        );

        scannerRef.current = scanner;
      } catch (error) {
        if ((error as Error).message.includes('permission')) {
          setPermissionDenied(true);
        }
        setScanError('Failed to initialize camera. Please ensure camera permission is granted.');
      }
    }

    return () => {
      if (scannerRef.current && isScanning) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [isScanning]);

  const handleStartScan = () => {
    setScannedResident(null);
    setScanError('');
    setIsScanning(true);
  };

  const handleStopScan = () => {
    setIsScanning(false);
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
  };

  const handleRescan = () => {
    setScannedResident(null);
    setScanError('');
    if (scannerRef.current) {
      scannerRef.current.resume();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid':
        return '#2e7d32';
      case 'Pending':
        return '#f57f17';
      case 'Delinquent':
        return '#c62828';
      default:
        return '#546e7a';
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLefty}>
            <Link href="/admin/dashboard" className={styles.backBtn}>
              ← Back
            </Link>
            <div className={styles.headerBrand}>
              <span className={styles.headerIcon}>📱</span>
              <div>
                <h1 className={styles.headerTitle}>QR Code Scanner</h1>
                <p className={styles.headerSubtitle}>Scan resident QR code for instant info</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.contentWrapper}>
          {/* Scanner Section */}
          <div className={styles.scannerSection}>
            {!isScanning && !scannedResident && (
              <div className={styles.scanPrompt}>
                <div className={styles.promptIcon}>📷</div>
                <h2 className={styles.promptTitle}>Ready to Scan</h2>
                <p className={styles.promptText}>
                  Click the button below to start scanning resident QR codes
                </p>
                <button
                  onClick={handleStartScan}
                  className={styles.scanBtn}
                  disabled={permissionDenied}
                >
                  🔍 Start Scanning
                </button>
                {permissionDenied && (
                  <p className={styles.errorText}>
                    Camera permission denied. Please enable camera access in your browser settings.
                  </p>
                )}
              </div>
            )}

            {isScanning && (
              <div className={styles.scanner}>
                <div id="qr-reader" className={styles.qrReader}></div>
                <button
                  onClick={handleStopScan}
                  className={styles.stopBtn}
                >
                  ⏹ Stop Scanning
                </button>
                {scanError && (
                  <div className={styles.errorBox}>
                    <p className={styles.errorText}>{scanError}</p>
                    <button onClick={() => setScanError('')} className={styles.closeError}>
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}

            {scannedResident && (
              <div className={styles.resultSection}>
                <div className={styles.successMessage}>
                  ✓ Resident found! Scanning complete.
                </div>

                {/* Resident Card */}
                <div className={styles.residentCard}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.residentName}>{scannedResident.name}</h2>
                    <span
                      className={styles.statusBadge}
                      style={{ background: getStatusColor(scannedResident.status) }}
                    >
                      {scannedResident.status}
                    </span>
                  </div>

                  {/* Personal Information */}
                  <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Personal Information</h3>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Resident ID:</span>
                        <span className={styles.infoValue}>{scannedResident.id}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Email:</span>
                        <span className={styles.infoValue}>{scannedResident.email}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Phone:</span>
                        <span className={styles.infoValue}>{scannedResident.phone}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Phase:</span>
                        <span className={styles.infoValue}>{scannedResident.phase}</span>
                      </div>
                    </div>
                  </div>

                  {/* Location Information */}
                  <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Location</h3>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Block:</span>
                        <span className={styles.infoValue}>{scannedResident.block}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Lot:</span>
                        <span className={styles.infoValue}>{scannedResident.lot}</span>
                      </div>
                      <div className={styles.infoItem} style={{ gridColumn: '1 / -1' }}>
                        <span className={styles.infoLabel}>Full Address:</span>
                        <span className={styles.infoValue}>
                          Blk {scannedResident.block} Lot {scannedResident.lot}, {scannedResident.phase}, Lincoln Heights
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Billing Information */}
                  <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Billing Information</h3>
                    <div className={styles.billingGrid}>
                      <div className={styles.billingCard}>
                        <span className={styles.billingLabel}>Monthly Dues</span>
                        <span className={styles.billingAmount}>₱{scannedResident.monthlyDues.toLocaleString()}</span>
                      </div>
                      <div className={styles.billingCard}>
                        <span className={styles.billingLabel}>Outstanding Balance</span>
                        <span
                          className={styles.billingAmount}
                          style={{
                            color: scannedResident.balance > 0 ? '#c62828' : '#2e7d32',
                          }}
                        >
                          ₱{scannedResident.balance.toLocaleString()}
                        </span>
                      </div>
                      <div className={styles.billingCard}>
                        <span className={styles.billingLabel}>Last Payment</span>
                        <span className={styles.billingValue}>{scannedResident.lastPayment}</span>
                      </div>
                      <div className={styles.billingCard}>
                        <span className={styles.billingLabel}>Last Payment Amount</span>
                        <span className={styles.billingValue}>₱{scannedResident.lastPaymentAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className={styles.actionButtons}>
                    <button
                      onClick={handleRescan}
                      className={styles.rescanBtn}
                    >
                      🔄 Scan Another
                    </button>
                    <Link
                      href={`/admin/residents`}
                      className={styles.viewDetailsBtn}
                    >
                      📋 View Full Details
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Info Sidebar */}
          <aside className={styles.infoSidebar}>
            <div className={styles.infoCard}>
              <h3 className={styles.infoCardTitle}>How to Use</h3>
              <ol className={styles.instructionsList}>
                <li>Click "Start Scanning" button</li>
                <li>Point camera at resident's QR code</li>
                <li>Wait for automatic detection</li>
                <li>Resident information displays instantly</li>
                <li>Click "Scan Another" to repeat</li>
              </ol>
            </div>

            <div className={styles.infoCard}>
              <h3 className={styles.infoCardTitle}>Test QR Codes</h3>
              <p className={styles.testText}>Use these IDs to test:</p>
              <ul className={styles.testList}>
                <li>RES001 - Juan dela Cruz</li>
                <li>RES002 - Maria Santos</li>
                <li>RES003 - Carlos Rodriguez</li>
                <li>RES004 - Ana Garcia</li>
              </ul>
              <p className={styles.testNote}>
                Scan the QR displayed on each resident's profile card
              </p>
            </div>

            <div className={styles.infoCard}>
              <h3 className={styles.infoCardTitle}>Features</h3>
              <ul className={styles.featureList}>
                <li>✓ Instant resident lookup</li>
                <li>✓ Complete billing info</li>
                <li>✓ Payment history</li>
                <li>✓ Status indicators</li>
                <li>✓ Real-time scanning</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
