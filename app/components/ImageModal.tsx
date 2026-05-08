'use client';

import { useEffect } from 'react';
import styles from './ImageModal.module.css';

interface ImageModalProps {
  isOpen: boolean;
  imageUrl: string;
  title: string;
  proofKind?: 'image' | 'pdf' | 'none';
  onClose: () => void;
}

export default function ImageModal({ isOpen, imageUrl, title, proofKind = 'none', onClose }: ImageModalProps) {
  const normalizedUrl = imageUrl.toLowerCase();
  const isPdf =
    proofKind === 'pdf' ||
    normalizedUrl.includes('.pdf') ||
    normalizedUrl.includes('application/pdf') ||
    normalizedUrl.includes('application%2fpdf');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.content}>
          {imageUrl ? (
            isPdf ? (
              <div className={styles.documentWrapper}>
                <iframe src={imageUrl} title={title} className={styles.documentFrame} />
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.openLink}
                >
                  Open PDF in new tab
                </a>
              </div>
            ) : (
              <img src={imageUrl} alt={title} className={styles.image} />
            )
          ) : (
            <div className={styles.noImage}>No proof file available for this payment.</div>
          )}
        </div>
      </div>
    </div>
  );
}
