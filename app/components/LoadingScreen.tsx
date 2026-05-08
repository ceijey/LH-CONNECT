import React from 'react';
import Image from 'next/image';
import styles from './LoadingScreen.module.css';

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Loading...', 
  fullScreen = true 
}) => {
  return (
    <div className={`${styles.container} ${fullScreen ? styles.fullScreen : ''}`}>
      <div className={styles.content}>
        <div className={styles.logoWrapper}>
          <Image
            src="/lhhoa-logo.png"
            alt="LH-Connect Logo"
            width={80}
            height={80}
            className={styles.logo}
            priority
          />
          <div className={styles.spinner}></div>
        </div>
        <div className={styles.textWrapper}>
          <h2 className={styles.title}>LH-Connect</h2>
          <p className={styles.message}>{message}</p>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill}></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
