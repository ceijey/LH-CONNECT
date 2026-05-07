'use client';

import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
  variant?: 'text' | 'circle' | 'rect' | 'button';
}

export default function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = '4px',
  className = '',
  variant = 'rect',
}: SkeletonProps) {
  const skeletonStyles: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: variant === 'circle' ? '50%' : borderRadius,
  };

  return (
    <div
      className={`${styles.skeleton} ${styles[variant]} ${className}`}
      style={skeletonStyles}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '70%' : '100%'}
          height="1rem"
          className={styles.textLine}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 80 }: { size?: number }) {
  return <Skeleton width={size} height={size} variant="circle" />;
}

export function SkeletonCard() {
  return (
    <div className={styles.cardSkeleton}>
      <Skeleton height="200px" borderRadius="8px" />
      <Skeleton height="1.25rem" width="70%" className={styles.textLine} />
      <Skeleton height="1rem" width="90%" className={styles.textLine} />
      <Skeleton height="1rem" width="60%" className={styles.textLine} />
    </div>
  );
}
