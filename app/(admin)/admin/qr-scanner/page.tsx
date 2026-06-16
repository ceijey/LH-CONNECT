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
        html5QrCode.stop().catch(() => {});
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
                    <div className={styles.nameSection}>
                      <span className={styles.idLabel}>RESIDENT ID: {scannedResident.id}</span>
                      <h2 className={styles.residentName}>{scannedResident.fullName || 'Unknown Resident'}</h2>
                    </div>
                    <span
                      className={styles.statusBadge}
                      style={{
                        background: scannedResident.balance && scannedResident.balance > 0 ? '#ef5350' : '#4caf50',
                        boxShadow: `0 4px 10px ${scannedResident.balance && scannedResident.balance > 0 ? 'rgba(239, 83, 80, 0.3)' : 'rgba(76, 175, 80, 0.3)'}`
                      }}
                    >
                      {scannedResident.balance && scannedResident.balance > 0 
                        ? `DELINQUENT - ${Math.floor(scannedResident.balance / 400)} Month${Math.floor(scannedResident.balance / 400) > 1 ? 's' : ''} Delayed`
                        : `PAID - ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`}
                    </span>
                  </div>

                  <div className={styles.cardBody}>
                    {/* Left Column: Personal & Location */}
                    <div className={styles.mainInfo}>
                      <div className={styles.infoSection}>
                        <h3 className={styles.subTitle}>Personal Information</h3>
                        <div className={styles.gridRow}>
                          <div className={styles.dataGroup}>
                            <span className={styles.label}>Email Address</span>
                            <span className={styles.value}>{scannedResident.email || '-'}</span>
                          </div>
                          <div className={styles.dataGroup}>
                            <span className={styles.label}>Phone Number</span>
                            <span className={styles.value}>{scannedResident.phone || '-'}</span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.infoSection}>
                        <h3 className={styles.subTitle}>Location Details</h3>
                        <div className={styles.gridRow}>
                          <div className={styles.dataGroup}>
                            <span className={styles.label}>Phase</span>
                            <span className={styles.value}>{scannedResident.phase || '-'}</span>
                          </div>
                          <div className={styles.dataGroup}>
                            <span className={styles.label}>Block & Lot</span>
                            <span className={styles.value}>Blk {scannedResident.block || '-'} Lot {scannedResident.lot || '-'}</span>
                          </div>
                        </div>
                        <div className={styles.fullAddress}>
                          <span className={styles.label}>Full Address</span>
                          <span className={styles.value}>Lincoln Heights, {scannedResident.phase}, Blk {scannedResident.block}, Lot {scannedResident.lot}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Balance */}
                    <div className={styles.balanceSidebar}>
                      <div className={styles.balanceCard}>
                        <span className={styles.balanceLabel}>OUTSTANDING BALANCE</span>
                        <div 
                          className={styles.balanceValue}
                          style={{ color: scannedResident.balance && scannedResident.balance > 0 ? '#ef5350' : '#4caf50' }}
                        >
                          ₱{(scannedResident.balance || 0).toLocaleString()}
                        </div>
                        <div className={styles.balanceFooter}>
                          <span>Last updated: {new Date().toLocaleDateString()}</span>
                          {scannedResident.balance && scannedResident.balance > 0 ? (
                            <span style={{ 
                              padding: '4px 12px', 
                              background: '#fee2e2', 
                              color: '#b91c1c', 
                              borderRadius: '20px',
                              fontSize: '0.75rem', 
                              fontWeight: 700 
                            }}>
                              Unpaid: {
                                Array.from({ length: Math.floor(scannedResident.balance / 400) }).map((_, i) => {
                                  const d = new Date();
                                  d.setMonth(d.getMonth() - i);
                                  return d.toLocaleString('default', { month: 'short' });
                                }).reverse().join(', ')
                              }
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className={styles.cardActions}>
                    <button onClick={handleRescan} className={styles.primaryAction}>
                      🔄 Scan Another
                    </button>
                    <button onClick={handleCopyResidentId} className={styles.secondaryAction}>
                      📋 Copy ID
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
