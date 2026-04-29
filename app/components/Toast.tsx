'use client';

import { useEffect } from 'react';
import styles from './Toast.module.css';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  isVisible: boolean;
  duration?: number;
  onClose: () => void;
}

export default function Toast({
  message,
  type = 'info',
  isVisible,
  duration = 3000,
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (!isVisible) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className={`${styles.toast} ${styles[type]}`} role="status" aria-live="polite">
      <span className={styles.icon}>{type === 'success' ? '✓' : type === 'error' ? '!' : 'i'}</span>
      <p className={styles.message}>{message}</p>
      <button className={styles.closeBtn} onClick={onClose} aria-label="Close toast">
        ×
      </button>
    </div>
  );
}
