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

const formatDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

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

  const [isCameraStarting, setIsCameraStarting] = useState(false);

  // Initialize scanner when isScanning changes
  useEffect(() => {
    let html5QrCode: any = null;

    if (isScanning && !scannedResident) {
      const startScanner = async () => {
        try {
          setIsCameraStarting(true);
          const { Html5Qrcode } = await import('html5-qrcode');
          html5QrCode = new Html5Qrcode('qr-reader');
          scannerRef.current = html5QrCode;

          const config = {
            fps: 10,
            qrbox: { width: 280, height: 280 },
            aspectRatio: 1,
          };

          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText: string) => {
              const scannedId = decodedText.trim();
              console.log('QR Scanned ID:', scannedId);

              if (!isValidFirebaseUid(scannedId)) {
                setScanError('Invalid QR code format. Expected a Firebase UID.');
                return;
              }

              const resident = residentsCache.find((r) => r.id === scannedId);

              if (resident) {
                console.log('Resident found:', resident);
                setScannedResident(resident);
                setScanError('');
                setActionMessage('');

                // Stop scanning
                html5QrCode.stop().then(() => {
                  setIsScanning(false);
                }).catch((err: any) => {
                  console.error("Error stopping scanner:", err);
                  setIsScanning(false);
                });
              } else {
                setScanError(`Resident not found. ID: ${scannedId}`);
              }
            },
            (errorMessage: string) => {
              // Ignore constant "No QR code found" logs
            }
          );
          setIsCameraStarting(false);
        } catch (err: any) {
          console.error("Failed to start scanner:", err);
          setIsCameraStarting(false);
          setIsScanning(false);
          if (err?.toString().toLowerCase().includes('permission')) {
            setPermissionDenied(true);
          } else {
            setScanError('Failed to start camera. Please ensure it is not used by another app.');
          }
        }
      };

      startScanner();
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => { });
      }
    };
  }, [isScanning, residentsCache, scannedResident]);

  const handleStartScan = () => {
    setScannedResident(null);
    setScanError('');
    setActionMessage('');
    setIsScanning(true);
  };

  const handleStopScan = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().then(() => {
        setIsScanning(false);
        scannerRef.current = null;
      }).catch(() => {
        setIsScanning(false);
      });
    } else {
      setIsScanning(false);
    }
  };

  const handleRescan = () => {
    setScannedResident(null);
    setScanError('');
    setActionMessage('');
    setIsScanning(true);
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
              <div className={styles.promptIconWrapper}>
                <div className={styles.promptIcon}>📷</div>
              </div>
              <h2 className={styles.promptTitle}>Scan Resident QR Code</h2>
              <p className={styles.promptText}>
                Point your camera at a resident's QR code to instantly pull up their profile and billing information.
              </p>
              <button
                onClick={handleStartScan}
                className={styles.scanBtn}
                disabled={permissionDenied || isLoadingResidents}
              >
                <span className={styles.btnIcon}>🔍</span>
                {isLoadingResidents ? 'Initializing...' : 'Tap to Start Scanning'}
              </button>
              {permissionDenied && (
                <p className={styles.errorText}>
                  Camera permission denied. Please enable camera access in your browser settings.
                </p>
              )}
            </div>
          )}

          {isScanning && (
            <div className={styles.scannerContainer}>
              <div className={styles.scannerHeader}>
                <h3 className={styles.scannerTitle}>Scanning Resident QR</h3>
                <button onClick={handleStopScan} className={styles.closeScanner}>✕</button>
              </div>

              <div className={styles.scannerFrame}>
                <div id="qr-reader" className={styles.qrReader}></div>
                {isCameraStarting && (
                  <div className={styles.cameraLoading}>
                    <div className={styles.spinner}></div>
                    <p>Accessing Camera...</p>
                  </div>
                )}
                <div className={styles.scanOverlay}>
                  <div className={styles.scannerLaser}></div>
                  <div className={styles.scannerCorner + ' ' + styles.topLeft}></div>
                  <div className={styles.scannerCorner + ' ' + styles.topRight}></div>
                  <div className={styles.scannerCorner + ' ' + styles.bottomLeft}></div>
                  <div className={styles.scannerCorner + ' ' + styles.bottomRight}></div>
                </div>
              </div>

              <div className={styles.scannerFooter}>
                <p className={styles.scannerHint}>Align the QR code within the frame to scan</p>
                <button onClick={handleStopScan} className={styles.cancelBtn}>
                  Cancel Scanning
                </button>
              </div>

              {scanError && (
                <div className={styles.scanErrorBox}>
                  <p>{scanError}</p>
                  <button onClick={() => setScanError('')}>✕</button>
                </div>
              )}
            </div>
          )}

          {scannedResident && (
            <div className={styles.resultSection}>
              <div className={styles.successMessage}>
                <span className={styles.successIcon}>✓</span>
                <div className={styles.successText}>
                  <strong>Resident Found</strong>
                  <span>Scanning completed successfully</span>
                </div>
              </div>

              {actionMessage && (
                <div className={styles.successMessage} style={{marginTop: '-0.5rem', background: '#e3f2fd', borderColor: '#90caf9', color: '#1565c0'}}>
                  <span className={styles.successIcon} style={{background: '#1565c0'}}>✓</span>
                  <div className={styles.successText}>
                    <strong>Action Successful</strong>
                    <span>{actionMessage}</span>
                  </div>
                </div>
              )}

              {/* Resident Card */}
              <div className={styles.residentCard}>
                {/* Top Profile Banner */}
                <div className={styles.profileBanner}>
                  <div className={styles.avatarPlaceholder}>
                    {scannedResident.fullName ? scannedResident.fullName.charAt(0).toUpperCase() : '👤'}
                  </div>
                  <div className={styles.profileDetails}>
                    <h2 className={styles.residentName}>{scannedResident.fullName || 'Unknown Resident'}</h2>
                    <div className={styles.contactRow}>
                      <div className={styles.contactItem}>
                        <span className={styles.contactIcon}>✉️</span>
                        <span>{scannedResident.email || 'No email provided'}</span>
                      </div>
                      <div className={styles.contactItem}>
                        <span className={styles.contactIcon}>📞</span>
                        <span>{scannedResident.phone || 'No phone provided'}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.statusContainer}>
                    <div
                      className={styles.statusBadge}
                      style={{
                        background: scannedResident.balance && scannedResident.balance > 0 ? 'linear-gradient(135deg, #ef5350, #c62828)' : 'linear-gradient(135deg, #4caf50, #2e7d32)',
                        boxShadow: scannedResident.balance && scannedResident.balance > 0 ? '0 4px 15px rgba(239, 83, 80, 0.3)' : '0 4px 15px rgba(76, 175, 80, 0.3)'
                      }}
                    >
                      {scannedResident.balance && scannedResident.balance > 0
                        ? `DELINQUENT — ${Math.floor(scannedResident.balance / 400)} MONTH${Math.floor(scannedResident.balance / 400) > 1 ? 'S' : ''}`
                        : `ACTIVE & PAID`}
                    </div>
                  </div>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.infoSection}>
                    <h3 className={styles.subTitle}>
                      <span className={styles.subTitleIcon}>🏠</span>
                      Property Details
                    </h3>
                    <div className={styles.propertyGrid}>
                      <div className={styles.propItem}>
                        <span className={styles.propLabel}>Phase</span>
                        <span className={styles.propValue}>{scannedResident.phase || '-'}</span>
                      </div>
                      <div className={styles.propItem}>
                        <span className={styles.propLabel}>Block</span>
                        <span className={styles.propValue}>{scannedResident.block || '-'}</span>
                      </div>
                      <div className={styles.propItem}>
                        <span className={styles.propLabel}>Lot</span>
                        <span className={styles.propValue}>{scannedResident.lot || '-'}</span>
                      </div>
                    </div>
                    <div className={styles.fullAddress}>
                      <span className={styles.addressIcon}>📍</span>
                      <span className={styles.addressText}>
                        Lincoln Heights, {scannedResident.phase}, Blk {scannedResident.block}, Lot {scannedResident.lot}
                      </span>
                    </div>
                  </div>

                  <div className={styles.balanceSection}>
                    <h3 className={styles.subTitle}>
                      <span className={styles.subTitleIcon}>💳</span>
                      Financial Status
                    </h3>
                    <div className={styles.balanceDisplay}>
                      <span className={styles.balanceSubtext}>Total Outstanding Balance</span>
                      <div className={styles.balanceAmount} style={{ color: scannedResident.balance && scannedResident.balance > 0 ? '#d32f2f' : '#2e7d32' }}>
                        ₱{(scannedResident.balance || 0).toLocaleString()}
                      </div>
                      
                      {scannedResident.balance && scannedResident.balance > 0 ? (
                        <div className={styles.unpaidMonths}>
                          <strong>Unpaid Months:</strong> {
                            Array.from({ length: Math.floor(scannedResident.balance / 400) }).map((_, i) => {
                              const d = new Date();
                              d.setMonth(d.getMonth() - i);
                              return formatDate(d);
                            }).reverse().join(', ')
                          }
                        </div>
                      ) : (
                        <div className={styles.paidStatus}>
                          <span style={{marginRight: '6px'}}>✓</span> Up to date for {formatDate(new Date())}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className={styles.cardActions}>
                  <button onClick={handleCopyResidentId} className={styles.secondaryAction}>
                    📋 Copy Resident ID
                  </button>
                  <button onClick={handleRescan} className={styles.primaryAction}>
                    🔄 Scan Another QR
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
