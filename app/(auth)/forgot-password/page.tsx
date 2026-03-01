'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './forgot-password.module.css';

interface ForgotPasswordData {
  email: string;
  resetCode: string;
  newPassword: string;
  confirmPassword: string;
}

interface FormErrors {
  email?: string;
  resetCode?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [formData, setFormData] = useState<ForgotPasswordData>({
    email: '',
    resetCode: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Simulated stored reset codes (in real app, this would be in a database)
  const DEMO_RESET_CODES: { [key: string]: string } = {
    'admin@lh-connect.com': 'ADMIN123456',
    'juan@lh-connect.com': 'RESET789012',
    'maria@lh-connect.com': 'CODE345678',
    'pedro@lh-connect.com': 'VERIFY901234',
  };

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

  const validateResetCode = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.resetCode.trim()) {
      newErrors.resetCode = 'Reset code is required';
    } else if (formData.resetCode.length < 6) {
      newErrors.resetCode = 'Reset code must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateNewPassword = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!validateEmail(formData.email)) {
      return;
    }

    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      // Check if email exists in demo accounts
      if (DEMO_RESET_CODES[formData.email]) {
        setSuccessMessage('Reset code has been sent to your email address');
        setStep('verify');
        setIsLoading(false);
      } else {
        setErrorMessage('Email not found in our system');
        setIsLoading(false);
      }
    }, 1500);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!validateResetCode()) {
      return;
    }

    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      // Verify the reset code matches
      if (DEMO_RESET_CODES[formData.email] === formData.resetCode.toUpperCase()) {
        setSuccessMessage('Code verified successfully');
        setStep('reset');
        setFormData(prev => ({ ...prev, resetCode: '' }));
        setIsLoading(false);
      } else {
        setErrorMessage('Invalid reset code. Please try again.');
        setIsLoading(false);
      }
    }, 1500);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!validateNewPassword()) {
      return;
    }

    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      // In a real app, this would update the password in the database
      setSuccessMessage('Password has been reset successfully! Redirecting to login...');
      
      // Clear form
      setFormData({
        email: '',
        resetCode: '',
        newPassword: '',
        confirmPassword: '',
      });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    }, 1500);
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
      {/* Header */}
      <header className={styles.header}>
        <Link href="/login" className={styles.backLink}>
          ← Back to Login
        </Link>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h1 className={styles.title}>Reset Your Password</h1>
            <p className={styles.subtitle}>
              {step === 'request' && 'Enter your email address to receive a reset code'}
              {step === 'verify' && 'Enter the reset code sent to your email'}
              {step === 'reset' && 'Create your new password'}
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

          {/* Request Reset Step */}
          {step === 'request' && (
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
                {isLoading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </form>
          )}

          {/* Verify Code Step */}
          {step === 'verify' && (
            <form onSubmit={handleVerifyCode} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Reset Code</label>
                <input
                  type="text"
                  name="resetCode"
                  value={formData.resetCode}
                  onChange={handleChange}
                  placeholder="Enter the code from your email"
                  className={`${styles.input} ${errors.resetCode ? styles.inputError : ''}`}
                  maxLength={20}
                />
                {errors.resetCode && (
                  <span className={styles.errorText}>{errors.resetCode}</span>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={styles.submitBtn}
              >
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </button>

              <button
                type="button"
                onClick={() => setStep('request')}
                className={styles.backBtn}
                disabled={isLoading}
              >
                ← Back
              </button>
            </form>
          )}

          {/* Reset Password Step */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  placeholder="Enter new password"
                  className={`${styles.input} ${errors.newPassword ? styles.inputError : ''}`}
                />
                {errors.newPassword && (
                  <span className={styles.errorText}>{errors.newPassword}</span>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm new password"
                  className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ''}`}
                />
                {errors.confirmPassword && (
                  <span className={styles.errorText}>{errors.confirmPassword}</span>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={styles.submitBtn}
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          {/* Demo Codes Hint */}
          <div className={styles.demoHint}>
            <p className={styles.demoTitle}>Demo Accounts for Testing:</p>
            <ul className={styles.demoList}>
              <li><strong>admin@lh-connect.com</strong> - Code: ADMIN123456</li>
              <li><strong>juan@lh-connect.com</strong> - Code: RESET789012</li>
              <li><strong>maria@lh-connect.com</strong> - Code: CODE345678</li>
              <li><strong>pedro@lh-connect.com</strong> - Code: VERIFY901234</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
