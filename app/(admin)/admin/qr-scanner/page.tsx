'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiCall } from '@/lib/api-client';
import LoadingScreen from '@/app/components/LoadingScreen';
import styles from './qr-scanner.module.css';

interface ResidentData {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  phase?: string;
  block?: string;
  lot?: string;
  balance?: number;
  role?: string;
  createdAt?: string;
}

function isValidFirebaseUid(value: string) {
  return /^[A-Za-z0-9_-]{10,128}$/.test(value);
}

export default function QRScannerPage() {
  const router = useRouter();
  
  const scannerRef = useRef<any>(null);
  const [scannedResident, setScannedResident] = useState<ResidentData | null>(null);
  const [scanError, setScanError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [residentsCache, setResidentsCache] = useState<ResidentData[]>([]);
  const [isLoadingResidents, setIsLoadingResidents] = useState(true);
  const [actionMessage, setActionMessage] = useState('');

  // Fetch residents on component mount
  useEffect(() => {
    const fetchResidents = async () => {
      try {
        setIsLoadingResidents(true);
        const data = await apiCall('/api/residents');
        console.log('Residents fetched:', data.residents?.length, 'residents');
        console.log('Sample resident:', data.residents?.[0]);
        setResidentsCache(data.residents || []);
      } catch (error) {
        console.error('Failed to fetch residents:', error);
        setScanError('Failed to load residents data. Please refresh the page.');
      } finally {
        setIsLoadingResidents(false);
      }
    };

    fetchResidents();
  }, []);

  // Initialize scanner when isScanning changes
  useEffect(() => {
    if (!isScanning || scannerRef.current) {
      return;
    }

    const setupScanner = async () => {
      try {
        const Html5QrcodeScanner = (await import('html5-qrcode')).Html5QrcodeScanner;

        const scanner = new Html5QrcodeScanner('qr-reader', {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        }, false);

        scanner.render(
          (decodedText: string) => {
            // Parse the QR code data
            const scannedId = decodedText.trim();
            console.log('QR Scanned ID:', scannedId);
            console.log('Available resident IDs:', residentsCache.map(r => r.id));

            if (!isValidFirebaseUid(scannedId)) {
              setScannedResident(null);
              setScanError('Invalid QR code format. Expected a Firebase UID.');
              return;
            }
            
            const resident = residentsCache.find((r) => r.id === scannedId);

            if (resident) {
              console.log('Resident found:', resident);
              setScannedResident(resident);
              setScanError('');
              setActionMessage('');
              scanner.pause();
            } else {
              console.log('Resident not found with ID:', scannedId);
              setScanError(`Resident not found. ID: ${scannedId}`);
            }
          },
          () => {
            // Silently fail on scan errors.
          }
        );

        scannerRef.current = scanner;
      } catch (error) {
        if ((error as Error).message.includes('permission')) {
          setPermissionDenied(true);
        }
        setScanError('Failed to initialize camera. Please ensure camera permission is granted.');
      }
    };

    setupScanner();

    return () => {
      if (scannerRef.current && isScanning) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [isScanning, residentsCache]);

  const handleStartScan = () => {
    setScannedResident(null);
    setScanError('');
    setActionMessage('');
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
    setActionMessage('');
    if (scannerRef.current) {
      scannerRef.current.resume();
    }
  };

  const handleCopyResidentId = async () => {
    if (!scannedResident) return;

    try {
      await navigator.clipboard.writeText(scannedResident.id);
      setActionMessage('Resident ID copied to clipboard.');
    } catch {
      setScanError('Unable to copy resident ID.');
    }
  };

  const handleShareResident = async () => {
    if (!scannedResident) return;

    const fullAddress = `Blk ${scannedResident.block || '-'} Lot ${scannedResident.lot || '-'}, ${scannedResident.phase || '-'}, Lincoln Heights`;
    const shareText = [
      `Resident: ${scannedResident.fullName || 'Unknown Resident'}`,
      `Resident ID: ${scannedResident.id}`,
      `Email: ${scannedResident.email || '-'}`,
      `Phone: ${scannedResident.phone || '-'}`,
      `Address: ${fullAddress}`,
      `Balance: ₱${(scannedResident.balance || 0).toLocaleString()}`,
    ].join('\n');

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'LH-Connect Resident Info',
          text: shareText,
        });
        setActionMessage('Resident details shared successfully.');
      } else {
        await navigator.clipboard.writeText(shareText);
        setActionMessage('Sharing is not supported here, so the resident details were copied instead.');
      }
    } catch {
      setScanError('Unable to share resident details.');
    }
  };

  if (isLoadingResidents) {
    return <LoadingScreen message="Initializing scanner data..." />;
  }

  return (
    <>
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
                  disabled={permissionDenied || isLoadingResidents}
                >
                  {isLoadingResidents ? '⏳ Loading residents...' : '🔍 Start Scanning'}
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

                {actionMessage && (
                  <div className={styles.successMessage}>
                    {actionMessage}
                  </div>
                )}

                {/* Resident Card */}
                <div className={styles.residentCard}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.residentName}>{scannedResident.fullName || 'Unknown Resident'}</h2>
                    <span
                      className={styles.statusBadge}
                      style={{
                        background: scannedResident.balance && scannedResident.balance > 0 ? '#c62828' : '#2e7d32',
                      }}
                    >
                      {scannedResident.balance && scannedResident.balance > 0 ? 'Delinquent' : 'Paid'}
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
                        <span className={styles.infoValue}>{scannedResident.email || '-'}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Phone:</span>
                        <span className={styles.infoValue}>{scannedResident.phone || '-'}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Phase:</span>
                        <span className={styles.infoValue}>{scannedResident.phase || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Location Information */}
                  <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Location</h3>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Block:</span>
                        <span className={styles.infoValue}>{scannedResident.block || '-'}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Lot:</span>
                        <span className={styles.infoValue}>{scannedResident.lot || '-'}</span>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span className={styles.infoLabel}>Full Address:</span>
                        <span className={styles.infoValue}>
                          Blk {scannedResident.block} Lot {scannedResident.lot}, {scannedResident.phase}, Lincoln Heights
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Billing Information */}
                  <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Balance Information</h3>
                    <div className={styles.billingGrid}>
                      <div className={styles.billingCard}>
                        <span className={styles.billingLabel}>Outstanding Balance</span>
                        <span
                          className={styles.billingAmount}
                          style={{
                            color: scannedResident.balance && scannedResident.balance > 0 ? '#c62828' : '#2e7d32',
                          }}
                        >
                          ₱{(scannedResident.balance || 0).toLocaleString()}
                        </span>
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
                      href={`/admin/residents/${scannedResident.id}`}
                      className={styles.viewDetailsBtn}
                    >
                      📋 View Full Details
                    </Link>
                  </div>

                  <div className={styles.utilityButtons}>
                    <button onClick={handleCopyResidentId} className={styles.utilityBtn}>
                      📋 Copy Resident ID
                    </button>
                    <button onClick={handleShareResident} className={styles.utilityBtnSecondary}>
                      📤 Share Resident Info
                    </button>
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
              <p className={styles.testText}>Use resident IDs to test scanning</p>
              <p className={styles.testNote}>
                Each resident's QR code encodes their Firebase user ID for lookup
              </p>
            </div>

            <div className={styles.infoCard}>
              <h3 className={styles.infoCardTitle}>Features</h3>
              <ul className={styles.featureList}>
                <li>✓ Instant resident lookup</li>
                <li>✓ Complete billing info</li>
                <li>✓ Real-time scanning</li>
                <li>✓ Camera permission handling</li>
                <li>✓ Live database sync</li>
              </ul>
            </div>
          </aside>
      </div>
    </>
  );
}
