'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { FirebaseError } from 'firebase/app';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import styles from './forgot-password.module.css';

interface ForgotPasswordData {
  email: string;
}

interface FormErrors {
  email?: string;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<ForgotPasswordData>({
    email: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const validateEmail = (email: string): boolean => {
    const newErrors: FormErrors = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getResetErrorMessage = (error: unknown): string => {
    const firebaseError = error as FirebaseError;

    switch (firebaseError?.code) {
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-not-found':
        return 'No account found for this email address.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection.';
      default:
        return 'Could not send reset email. Please try again.';
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!validateEmail(formData.email)) {
      return;
    }

    setIsLoading(true);

    try {
      await sendPasswordResetEmail(auth, formData.email.trim(), {
        url: `${window.location.origin}/login`,
      });

      setSuccessMessage(
        'Password reset email sent. Please check your inbox and follow the link to set a new password.'
      );
    } catch (error) {
      setErrorMessage(getResetErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.main}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <div className={styles.logoContainer}>
              <Image
                src="/lhhoa-logo.png"
                alt="LHHOA Logo"
                width={110}
                height={110}
                className={styles.logo}
                priority
              />
            </div>
            <h1 className={styles.title}>Reset Your Password</h1>
            <p className={styles.subtitle}>
              Enter your registered email and we will send you a secure reset link.
            </p>
          </div>

          {/* Messages */}
          {successMessage && (
            <div className={styles.successMessage}>
              ✓ {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className={styles.errorMessage}>
              ✗ {errorMessage}
            </div>
          )}

          <form onSubmit={handleRequestReset} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your registered email"
                className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
              />
              {errors.email && (
                <span className={styles.errorText}>{errors.email}</span>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={styles.submitBtn}
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <button
              type="button"
              className={styles.backBtn}
              onClick={() => router.push('/login')}
              disabled={isLoading}
            >
              ← Back to Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
