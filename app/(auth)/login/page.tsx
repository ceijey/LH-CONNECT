'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import AnimatedBackground from '@/components/AnimatedBackground';
import styles from './login.module.css';

interface FormData {
  email: string;
  password: string;
  acceptTerms: boolean;
}

interface SignupFormData {
  fullName: string;
  email: string;
  phase: string;
  block: string;
  lot: string;
  phone: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

interface FormErrors {
  email?: string;
  password?: string;
  acceptTerms?: string;
}

interface SignupErrors {
  fullName?: string;
  email?: string;
  phase?: string;
  block?: string;
  lot?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  acceptTerms?: string;
}

type UserType = 'resident' | 'admin';

export default function LoginPage() {
  const router = useRouter();
  const [userType, setUserType] = useState<UserType>('resident');
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    acceptTerms: false,
  });
  const [signupFormData, setSignupFormData] = useState<SignupFormData>({
    fullName: '',
    email: '',
    phase: '',
    block: '',
    lot: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [signupErrors, setSignupErrors] = useState<SignupErrors>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [signupMessage, setSignupMessage] = useState<string>('');
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email) {
      newErrors.email = userType === 'admin' ? 'Admin username is required' : 'Email is required';
    } else if (userType === 'resident' && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (userType === 'resident' && !formData.acceptTerms) {
      newErrors.acceptTerms = 'You must accept the Terms and Conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = (e.target as HTMLInputElement).checked;
    setSignupFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (signupErrors[name as keyof SignupErrors]) {
      setSignupErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const validateSignupForm = (): boolean => {
    const newErrors: SignupErrors = {};

    if (!signupFormData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!signupFormData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(signupFormData.email)) newErrors.email = 'Email is invalid';
    if (!signupFormData.phase) newErrors.phase = 'Phase is required';
    if (!signupFormData.block) newErrors.block = 'Block number is required';
    if (!signupFormData.lot) newErrors.lot = 'Lot number is required';
    if (!signupFormData.phone) newErrors.phone = 'Phone number is required';
    if (!signupFormData.password) newErrors.password = 'Password is required';
    else if (signupFormData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (!signupFormData.confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (signupFormData.password !== signupFormData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (!signupFormData.acceptTerms) newErrors.acceptTerms = 'You must accept the Terms and Conditions';

    setSignupErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getAuthErrorMessage = (error: unknown): string => {
    const firebaseError = error as FirebaseError;
    if (error instanceof Error && !firebaseError?.code) {
      return error.message;
    }
    
    switch (firebaseError?.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
      case 'auth/invalid-email': return 'Invalid email or password.';
      case 'auth/too-many-requests': return 'Too many failed attempts. Please try again later.';
      case 'auth/operation-not-allowed': return 'Email/password sign-in is not enabled.';
      case 'auth/network-request-failed': return 'Network error. Please check your internet connection.';
      default: return 'An error occurred. Please try again.';
    }
  };

  const getSignupErrorMessage = (error: unknown): string => {
    const firebaseError = error as FirebaseError;
    if (error instanceof Error && !firebaseError?.code) return error.message;
    switch (firebaseError?.code) {
      case 'auth/email-already-in-use': return 'This email is already registered.';
      case 'auth/invalid-email': return 'Please enter a valid email address.';
      case 'auth/weak-password': return 'Password is too weak. Use at least 6 characters.';
      case 'auth/operation-not-allowed': return 'Email/password sign-up is not enabled.';
      case 'auth/network-request-failed': return 'Network error. Please check your internet connection.';
      default: return 'An error occurred during sign-up. Please try again.';
    }
  };

  const parseApiResponse = async (response: Response) => {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) return response.json();
    const text = await response.text();
    const cleanedText = text.trim();
    if (cleanedText.startsWith('<!DOCTYPE') || cleanedText.startsWith('<html')) {
      throw new Error('Server route failed before returning JSON. Check Firebase Admin environment variables.');
    }
    throw new Error(cleanedText || 'Unexpected server response.');
  };

  const completeLogin = async (idToken: string, email: string | null, fallbackName: string) => {
    const profileResponse = await fetch('/api/auth/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
    });

    if (!profileResponse.ok) {
      const errorPayload = await parseApiResponse(profileResponse);
      throw new Error(errorPayload?.error ?? 'Failed to load user profile.');
    }

    const profilePayload = await parseApiResponse(profileResponse);
    const userData = profilePayload.user ?? {};
    const role = userData.role === 'admin' ? 'admin' : 'resident';
    const accountStatus = userData.approvalStatus === 'Pending' ? 'Pending' : 'Approved';

    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userEmail', email ?? formData.email);
    localStorage.setItem('userName', userData.fullName ?? fallbackName);
    localStorage.setItem('userRole', role);
    localStorage.setItem('userId', profilePayload.user?.uid ?? auth.currentUser?.uid ?? '');
    localStorage.setItem('accountStatus', accountStatus);

    const sessionResponse = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!sessionResponse.ok) {
      const sessionError = await parseApiResponse(sessionResponse);
      throw new Error(sessionError?.error ?? 'Failed to create secure session.');
    }

    router.replace(role === 'admin' ? '/admin/dashboard' : accountStatus === 'Pending' ? '/pending-approval' : '/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');

    if (!validateForm()) return;
    setIsLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      const idToken = await userCredential.user.getIdToken();

      await completeLogin(idToken, userCredential.user.email, 'User');
    } catch (error) {
      setLoginError(getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };


  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSignupMessage('');

    if (!validateSignupForm()) return;
    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, signupFormData.email, signupFormData.password);
      const idToken = await userCredential.user.getIdToken();

      // Create the secure server session first so the CSRF cookie exists before the profile POST.
      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });

      if (!sessionResponse.ok) {
        const sessionError = await parseApiResponse(sessionResponse);
        throw new Error(sessionError?.error ?? 'Failed to create secure session.');
      }

      const sessionPayload = await parseApiResponse(sessionResponse);
      const csrfToken = String(sessionPayload?.csrfToken ?? '').trim();

      const profileResponse = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          fullName: signupFormData.fullName,
          email: signupFormData.email,
          phase: signupFormData.phase,
          block: signupFormData.block,
          lot: signupFormData.lot,
          phone: signupFormData.phone,
          role: 'resident',
        }),
      });

      if (!profileResponse.ok) {
        const profileError = await parseApiResponse(profileResponse);
        throw new Error(profileError.error ?? 'Failed to save profile.');
      }

      // Auto-login user after successful account creation
      await completeLogin(idToken, signupFormData.email, signupFormData.fullName);
    } catch (error) {
      setSignupMessage(getSignupErrorMessage(error));
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <AnimatedBackground />
      <Link href="/" className={styles.backToHome}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Back to Home
      </Link>
      
      {/* Left Visual Section */}
      <div className={styles.visualSection}>
        <div className={styles.visualContent}>
          <Image
            src="/lhhoa-logo.png"
            alt="LHHOA Logo"
            width={80}
            height={80}
            className={styles.visualLogo}
            priority
          />
          <h1 className={styles.visualTitle}>Manage Your Community</h1>
          <p className={styles.visualSubtitle}>
            Experience seamless community living. Access your HOA account, track dues, and connect with administrators all in one place.
          </p>
        </div>
      </div>

      {/* Right Form Section */}
      <div className={styles.formSection}>
        <div className={styles.loginBox}>
          
          <div className={styles.mobileLogoContainer}>
             <Image src="/lhhoa-logo.png" alt="LHHOA Logo" width={60} height={60} className={styles.mobileLogo} priority />
          </div>

          <div className={styles.userTypeTabs}>
            <button
              type="button"
              className={userType === 'resident' ? styles.userTypeTabActive : styles.userTypeTab}
              onClick={() => { setUserType('resident'); setIsSignUp(false); setLoginError(''); }}
            >
              Resident
            </button>
            <button
              type="button"
              className={userType === 'admin' ? styles.userTypeTabActive : styles.userTypeTab}
              onClick={() => { setUserType('admin'); setIsSignUp(false); setLoginError(''); }}
            >
              Admin
            </button>
          </div>

          {!isSignUp ? (
            <>
              {/* LOGIN FORM */}
              <div className={styles.header}>
                <h2 className={styles.title}>{userType === 'admin' ? 'Admin Portal' : 'Welcome back'}</h2>
                <p className={styles.subtitle}>
                  {userType === 'admin'
                    ? 'Sign in with your admin credentials.'
                    : 'Please enter your details to sign in.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                  <label htmlFor="email" className={styles.label}>
                    {userType === 'admin' ? 'Admin username' : 'Email Address'}
                  </label>
                  <input
                    type="text"
                    id="email"
                    name="email"
                    className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={userType === 'admin' ? 'admin username' : 'name@example.com'}
                    disabled={isLoading}
                  />
                  {errors.email && <p className={styles.errorMessage}>{errors.email}</p>}
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="password" className={styles.label}>Password</label>
                  <div className={styles.passwordField}>
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      className={`${styles.input} ${styles.passwordInput} ${errors.password ? styles.inputError : ''}`}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter your password"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowLoginPassword(prev => !prev)}
                      disabled={isLoading}
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPassword ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.89 1 12c.73-2.06 2.01-3.85 3.66-5.2" />
                          <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a11.05 11.05 0 0 1-4.29 5.14" />
                          <path d="m1 1 22 22" />
                          <path d="M9.53 9.53a3.5 3.5 0 0 0 4.95 4.95" />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {errors.password && <p className={styles.errorMessage}>{errors.password}</p>}
                </div>

                {userType === 'resident' && (
                  <>
                    <div className={styles.termsGroup}>
                      <input
                        type="checkbox"
                        name="acceptTerms"
                        id="loginAcceptTerms"
                        checked={formData.acceptTerms}
                        onChange={handleChange}
                        className={styles.termsCheckbox}
                        disabled={isLoading}
                      />
                      <div className={styles.termsLabel}>
                        <label htmlFor="loginAcceptTerms" className={styles.termsText}>
                          I accept the{' '}
                        </label>
                        <button type="button" onClick={() => setShowTermsModal(true)} className={styles.termsLink}>
                          Terms and Conditions
                        </button>
                      </div>
                    </div>
                    {errors.acceptTerms && <p className={styles.errorMessage}>{errors.acceptTerms}</p>}
                  </>
                )}

                {loginError && <p className={styles.errorMessage} style={{ textAlign: 'center' }}>{loginError}</p>}

                <button type="submit" className={styles.button} disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>

                {userType === 'resident' ? (
                  <>
                    <div className={styles.linkRow}>
                      <Link href="/forgot-password" className={styles.forgotLink}>Forgot password?</Link>
                      <Link href="/data-privacy" className={styles.privacyLink}>Privacy Policy</Link>
                    </div>
                  </>
                ) : (
                  <p className={styles.adminHint}>Use your admin username and password to access the dashboard.</p>
                )}
              </form>
            </>
          ) : (
            <>
              {/* SIGNUP FORM */}
              <div className={styles.header}>
                <h2 className={styles.title}>Create Account</h2>
                <p className={styles.subtitle}>Join your neighborhood network.</p>
              </div>

              <form onSubmit={handleSignup} className={styles.form}>
                <div className={styles.inputGroup}>
                  <label htmlFor="fullName" className={styles.label}>Full Name</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    className={`${styles.input} ${signupErrors.fullName ? styles.inputError : ''}`}
                    value={signupFormData.fullName}
                    onChange={handleSignupChange}
                    placeholder="John Doe"
                    disabled={isLoading}
                  />
                  {signupErrors.fullName && <p className={styles.errorMessage}>{signupErrors.fullName}</p>}
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="signupEmail" className={styles.label}>Email Address</label>
                  <input
                    type="email"
                    id="signupEmail"
                    name="email"
                    className={`${styles.input} ${signupErrors.email ? styles.inputError : ''}`}
                    value={signupFormData.email}
                    onChange={handleSignupChange}
                    placeholder="name@example.com"
                    disabled={isLoading}
                  />
                  {signupErrors.email && <p className={styles.errorMessage}>{signupErrors.email}</p>}
                </div>

                <div className={styles.gridCols2}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="phase" className={styles.label}>Phase</label>
                    <select
                      id="phase"
                      name="phase"
                      className={`${styles.input} ${signupErrors.phase ? styles.inputError : ''}`}
                      value={signupFormData.phase}
                      onChange={handleSignupChange}
                      disabled={isLoading}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="">Select</option>
                      <option value="Phase 1">Phase 1</option>
                      <option value="Phase 2">Phase 2</option>
                      <option value="Phase 3">Phase 3</option>
                    </select>
                    {signupErrors.phase && <p className={styles.errorMessage}>{signupErrors.phase}</p>}
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="phone" className={styles.label}>Phone Number</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      className={`${styles.input} ${signupErrors.phone ? styles.inputError : ''}`}
                      value={signupFormData.phone}
                      onChange={handleSignupChange}
                      placeholder="+1..."
                      disabled={isLoading}
                    />
                    {signupErrors.phone && <p className={styles.errorMessage}>{signupErrors.phone}</p>}
                  </div>
                </div>

                <div className={styles.gridCols2}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="block" className={styles.label}>Block</label>
                    <input
                      type="text"
                      id="block"
                      name="block"
                      className={`${styles.input} ${signupErrors.block ? styles.inputError : ''}`}
                      value={signupFormData.block}
                      onChange={handleSignupChange}
                      placeholder="#"
                      disabled={isLoading}
                    />
                    {signupErrors.block && <p className={styles.errorMessage}>{signupErrors.block}</p>}
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="lot" className={styles.label}>Lot</label>
                    <input
                      type="text"
                      id="lot"
                      name="lot"
                      className={`${styles.input} ${signupErrors.lot ? styles.inputError : ''}`}
                      value={signupFormData.lot}
                      onChange={handleSignupChange}
                      placeholder="#"
                      disabled={isLoading}
                    />
                    {signupErrors.lot && <p className={styles.errorMessage}>{signupErrors.lot}</p>}
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="signupPassword" className={styles.label}>Password</label>
                  <input
                    type="password"
                    id="signupPassword"
                    name="password"
                    className={`${styles.input} ${signupErrors.password ? styles.inputError : ''}`}
                    value={signupFormData.password}
                    onChange={handleSignupChange}
                    placeholder="Create a password"
                    disabled={isLoading}
                  />
                  {signupErrors.password && <p className={styles.errorMessage}>{signupErrors.password}</p>}
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="confirmPassword" className={styles.label}>Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    className={`${styles.input} ${signupErrors.confirmPassword ? styles.inputError : ''}`}
                    value={signupFormData.confirmPassword}
                    onChange={handleSignupChange}
                    placeholder="Confirm your password"
                    disabled={isLoading}
                  />
                  {signupErrors.confirmPassword && <p className={styles.errorMessage}>{signupErrors.confirmPassword}</p>}
                </div>

                <button type="submit" className={styles.button} disabled={isLoading}>
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>

                <div className={styles.termsGroup}>
                  <input
                    type="checkbox"
                    name="acceptTerms"
                    id="signupAcceptTerms"
                    checked={signupFormData.acceptTerms}
                    onChange={handleSignupChange}
                    className={styles.termsCheckbox}
                    disabled={isLoading}
                  />
                  <div className={styles.termsLabel}>
                    <label htmlFor="signupAcceptTerms" className={styles.termsText}>
                      I accept the{' '}
                    </label>
                    <button type="button" onClick={() => setShowTermsModal(true)} className={styles.termsLink}>
                      Terms and Conditions
                    </button>
                  </div>
                </div>
                {signupErrors.acceptTerms && <p className={styles.errorMessage}>{signupErrors.acceptTerms}</p>}

                {signupMessage && (
                  <p className={signupMessage.includes('successfully') ? styles.successMessage : styles.errorMessage} style={{ textAlign: 'center' }}>
                    {signupMessage}
                  </p>
                )}

                <div className={styles.signupPrompt}>
                  Already have an account?
                  <button type="button" onClick={() => setIsSignUp(false)} className={styles.signupLink}>
                    Sign in
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowTermsModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Terms and Conditions</h2>
              <button className={styles.modalClose} onClick={() => setShowTermsModal(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <h3>1. Acceptance of Terms</h3>
              <p>By accessing and using this application, you accept and agree to be bound by the terms and conditions of this agreement.</p>
              
              <h3>2. User Accounts</h3>
              <p>You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.</p>
              
              <h3>3. Privacy Policy</h3>
              <p>Your use of the application is also governed by our Privacy Policy, which is incorporated into these terms by reference.</p>
              
              <h3>4. Prohibited Activities</h3>
              <p>You agree not to engage in any activity that interferes with or disrupts the application or its services.</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalButton} onClick={() => setShowTermsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}