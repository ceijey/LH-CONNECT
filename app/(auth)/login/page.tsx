'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { FirebaseError } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
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

export default function LoginPage() {
  const router = useRouter();
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

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.acceptTerms) {
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

    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userEmail', email ?? formData.email);
    localStorage.setItem('userName', userData.fullName ?? fallbackName);
    localStorage.setItem('userRole', role);
    localStorage.setItem('userId', profilePayload.user?.uid ?? auth.currentUser?.uid ?? '');

    const sessionResponse = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!sessionResponse.ok) {
      const sessionError = await parseApiResponse(sessionResponse);
      throw new Error(sessionError?.error ?? 'Failed to create secure session.');
    }

    router.replace(role === 'admin' ? '/admin/dashboard' : '/dashboard');
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

  const handleGoogleSignIn = async () => {
    setLoginError('');
    setIsLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const userCredential = await signInWithPopup(auth, provider);
      const idToken = await userCredential.user.getIdToken();

      await completeLogin(idToken, userCredential.user.email, userCredential.user.displayName ?? 'User');
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

      const profileResponse = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
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

      setSignupMessage('Account created successfully! You can now log in.');
      setSignupFormData({
        fullName: '', email: '', phase: '', block: '', lot: '', phone: '', password: '', confirmPassword: '', acceptTerms: false,
      });

      setTimeout(() => {
        setIsSignUp(false);
        setSignupMessage('');
      }, 2000);
    } catch (error) {
      setSignupMessage(getSignupErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      
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

          {!isSignUp ? (
            <>
              {/* LOGIN FORM */}
              <div className={styles.header}>
                <h2 className={styles.title}>Welcome back</h2>
                <p className={styles.subtitle}>Please enter your details to sign in.</p>
              </div>

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                  <label htmlFor="email" className={styles.label}>Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@example.com"
                    disabled={isLoading}
                  />
                  {errors.email && <p className={styles.errorMessage}>{errors.email}</p>}
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="password" className={styles.label}>Password</label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    disabled={isLoading}
                  />
                  {errors.password && <p className={styles.errorMessage}>{errors.password}</p>}
                </div>

                <div className={styles.optionsRow}>
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

                  <div className={styles.forgotPassword}>
                    <Link href="/forgot-password" className={styles.forgotLink}>Forgot password?</Link>
                  </div>
                </div>
                {errors.acceptTerms && <p className={styles.errorMessage}>{errors.acceptTerms}</p>}

                {loginError && <p className={styles.errorMessage} style={{ textAlign: 'center' }}>{loginError}</p>}

                <button type="submit" className={styles.button} disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>

                <button
                  type="button"
                  className={styles.button}
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  style={{ marginTop: '12px', backgroundColor: '#fff', color: '#1B2A4A', border: '2px solid #D0D7E2' }}
                >
                  {isLoading ? 'Connecting...' : 'Continue with Google'}
                </button>

                <div className={styles.signupPrompt}>
                  Don't have an account?
                  <button type="button" onClick={() => setIsSignUp(true)} className={styles.signupLink}>
                    Sign up
                  </button>
                </div>
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

                <button type="submit" className={styles.button} disabled={isLoading}>
                  {isLoading ? 'Creating Account...' : 'Sign Up'}
                </button>

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