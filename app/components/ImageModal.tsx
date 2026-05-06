'use client';

import { useEffect } from 'react';
import styles from './ImageModal.module.css';

interface ImageModalProps {
  isOpen: boolean;
  imageUrl?: string | null;
  title?: string;
  onClose: () => void;
}

export default function ImageModal({ isOpen, imageUrl, title = 'Proof of Payment', onClose }: ImageModalProps) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close preview">×</button>
        </div>
        <div className={styles.content}>
          {imageUrl ? (
            // eslint-disable-next-line jsx-a11y/img-redundant-alt
            <img src={imageUrl} alt="Proof image" className={styles.image} />
          ) : (
            <div className={styles.empty}>No image available</div>
          )}
        </div>
      </div>
    </div>
  );
}
