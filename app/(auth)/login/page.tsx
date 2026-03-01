'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

  // Demo user accounts
  const DEMO_ACCOUNTS = [
    { email: 'admin@lh-connect.com', password: 'admin123', role: 'admin', name: 'Admin Account' },
    { email: 'juan@lh-connect.com', password: 'resident123', role: 'resident', name: 'Juan Dela Cruz' },
    { email: 'maria@lh-connect.com', password: 'resident123', role: 'resident', name: 'Maria Santos' },
    { email: 'pedro@lh-connect.com', password: 'resident123', role: 'resident', name: 'Pedro Garcia' },
  ];

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
    // Clear error for this field when user interacts
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
    // Clear error for this field when user interacts
    if (signupErrors[name as keyof SignupErrors]) {
      setSignupErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const validateSignupForm = (): boolean => {
    const newErrors: SignupErrors = {};

    if (!signupFormData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!signupFormData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(signupFormData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!signupFormData.phase) {
      newErrors.phase = 'Phase is required';
    }

    if (!signupFormData.block) {
      newErrors.block = 'Block number is required';
    }

    if (!signupFormData.lot) {
      newErrors.lot = 'Lot number is required';
    }

    if (!signupFormData.phone) {
      newErrors.phone = 'Phone number is required';
    }

    if (!signupFormData.password) {
      newErrors.password = 'Password is required';
    } else if (signupFormData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!signupFormData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (signupFormData.password !== signupFormData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!signupFormData.acceptTerms) {
      newErrors.acceptTerms = 'You must accept the Terms and Conditions';
    }

    setSignupErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    // Simulate API call
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check credentials against demo accounts
      const user = DEMO_ACCOUNTS.find(
        account => account.email === formData.email && account.password === formData.password
      );

      if (user) {
        // Store auth info
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('userName', user.name);
        localStorage.setItem('userRole', user.role);
        localStorage.setItem('termsAccepted', 'true');
        
        // Redirect based on user role
        if (user.role === 'admin') {
          router.push('/admin/dashboard');
        } else {
          router.push('/dashboard');
        }
      } else {
        setLoginError('Invalid email or password.');
      }
    } catch (error) {
      setLoginError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSignupMessage('');

    if (!validateSignupForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      // In a real application, you would send this data to a backend server
      // For now, we'll just show a success message and switch to login
      setSignupMessage('Account created successfully! You can now log in.');
      
      // Reset form
      setSignupFormData({
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

      // Switch to login after 2 seconds
      setTimeout(() => {
        setIsSignUp(false);
        setSignupMessage('');
      }, 2000);
    } catch (error) {
      setSignupMessage('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        {!isSignUp ? (
          <>
            {/* LOGIN FORM */}
            <div className={styles.header}>
              <h1 className={styles.title}>Welcome Back</h1>
              <p className={styles.subtitle}>Please sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              disabled={isLoading}
            />
            {errors.email && (
              <p className={styles.errorMessage}>{errors.email}</p>
            )}
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
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
            {errors.password && (
              <p className={styles.errorMessage}>{errors.password}</p>
            )}
          </div>

          {/* Terms and Conditions Checkbox */}
          <div className={styles.termsGroup}>
            <label className={styles.termsLabel}>
              <input
                type="checkbox"
                name="acceptTerms"
                checked={formData.acceptTerms}
                onChange={handleChange}
                className={styles.termsCheckbox}
                disabled={isLoading}
              />
              <span className={styles.termsText}>
                I accept the{' '}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className={styles.termsLink}
                >
                  Terms and Conditions
                </button>
              </span>
            </label>
            {errors.acceptTerms && (
              <p className={styles.errorMessage}>{errors.acceptTerms}</p>
            )}
          </div>

          <div className={styles.forgotPassword}>
            <Link href="/forgot-password" className={styles.forgotLink}>
              Forgot password?
            </Link>
          </div>

          {loginError && (
            <p className={styles.errorMessage} style={{ textAlign: 'center' }}>
              {loginError}
            </p>
          )}

          <button 
            type="submit" 
            className={styles.button}
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className={styles.signupPrompt}>
            Don't have an account?
            <button 
              type="button"
              onClick={() => setIsSignUp(true)}
              className={styles.signupLink}
            >
              Sign up
            </button>
          </div>

          {/* Demo Credentials */}
          <div className={styles.demoSection}>
            <p className={styles.demoTitle}>🧪 Demo Credentials:</p>
            <div className={styles.demoCredentials}>
              <div className={styles.demoItem}>
                <p className={styles.demoLabel}>Admin Account:</p>
                <p className={styles.demoValue}>admin@lh-connect.com</p>
                <p className={styles.demoValue}>admin123</p>
              </div>
              <div className={styles.demoItem}>
                <p className={styles.demoLabel}>Resident Accounts:</p>
                <p className={styles.demoValue}>juan@lh-connect.com</p>
                <p className={styles.demoValue}>maria@lh-connect.com</p>
                <p className={styles.demoValue}>pedro@lh-connect.com</p>
                <p className={styles.demoValue}>All residents: resident123</p>
              </div>
            </div>
          </div>
        </form>
          </>
        ) : (
          <>
            {/* SIGNUP FORM */}
            <div className={styles.header}>
              <h1 className={styles.title}>Create Account</h1>
              <p className={styles.subtitle}>Join our community</p>
            </div>

            <form onSubmit={handleSignup} className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="fullName" className={styles.label}>
                  Full Name
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  className={`${styles.input} ${signupErrors.fullName ? styles.inputError : ''}`}
                  value={signupFormData.fullName}
                  onChange={handleSignupChange}
                  placeholder="Enter your full name"
                  disabled={isLoading}
                />
                {signupErrors.fullName && (
                  <p className={styles.errorMessage}>{signupErrors.fullName}</p>
                )}
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="signupEmail" className={styles.label}>
                  Email Address
                </label>
                <input
                  type="email"
                  id="signupEmail"
                  name="email"
                  className={`${styles.input} ${signupErrors.email ? styles.inputError : ''}`}
                  value={signupFormData.email}
                  onChange={handleSignupChange}
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
                {signupErrors.email && (
                  <p className={styles.errorMessage}>{signupErrors.email}</p>
                )}
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="phase" className={styles.label}>
                  Phase
                </label>
                <select
                  id="phase"
                  name="phase"
                  className={`${styles.input} ${signupErrors.phase ? styles.inputError : ''}`}
                  value={signupFormData.phase}
                  onChange={handleSignupChange}
                  disabled={isLoading}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">Select your phase</option>
                  <option value="Phase 1">Phase 1</option>
                  <option value="Phase 2">Phase 2</option>
                  <option value="Phase 3">Phase 3</option>
                </select>
                {signupErrors.phase && (
                  <p className={styles.errorMessage}>{signupErrors.phase}</p>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className={styles.inputGroup}>
                  <label htmlFor="block" className={styles.label}>
                    Block
                  </label>
                  <input
                    type="text"
                    id="block"
                    name="block"
                    className={`${styles.input} ${signupErrors.block ? styles.inputError : ''}`}
                    value={signupFormData.block}
                    onChange={handleSignupChange}
                    placeholder="Block number"
                    disabled={isLoading}
                  />
                  {signupErrors.block && (
                    <p className={styles.errorMessage}>{signupErrors.block}</p>
                  )}
                </div>

                <div className={styles.inputGroup}>
                  <label htmlFor="lot" className={styles.label}>
                    Lot
                  </label>
                  <input
                    type="text"
                    id="lot"
                    name="lot"
                    className={`${styles.input} ${signupErrors.lot ? styles.inputError : ''}`}
                    value={signupFormData.lot}
                    onChange={handleSignupChange}
                    placeholder="Lot number"
                    disabled={isLoading}
                  />
                  {signupErrors.lot && (
                    <p className={styles.errorMessage}>{signupErrors.lot}</p>
                  )}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="phone" className={styles.label}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  className={`${styles.input} ${signupErrors.phone ? styles.inputError : ''}`}
                  value={signupFormData.phone}
                  onChange={handleSignupChange}
                  placeholder="Enter your phone number"
                  disabled={isLoading}
                />
                {signupErrors.phone && (
                  <p className={styles.errorMessage}>{signupErrors.phone}</p>
                )}
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="signupPassword" className={styles.label}>
                  Password
                </label>
                <input
                  type="password"
                  id="signupPassword"
                  name="password"
                  className={`${styles.input} ${signupErrors.password ? styles.inputError : ''}`}
                  value={signupFormData.password}
                  onChange={handleSignupChange}
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                {signupErrors.password && (
                  <p className={styles.errorMessage}>{signupErrors.password}</p>
                )}
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="confirmPassword" className={styles.label}>
                  Confirm Password
                </label>
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
                {signupErrors.confirmPassword && (
                  <p className={styles.errorMessage}>{signupErrors.confirmPassword}</p>
                )}
              </div>

              <div className={styles.termsGroup}>
                <label className={styles.termsLabel}>
                  <input
                    type="checkbox"
                    name="acceptTerms"
                    checked={signupFormData.acceptTerms}
                    onChange={handleSignupChange}
                    className={styles.termsCheckbox}
                    disabled={isLoading}
                  />
                  <span className={styles.termsText}>
                    I accept the{' '}
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className={styles.termsLink}
                    >
                      Terms and Conditions
                    </button>
                  </span>
                </label>
                {signupErrors.acceptTerms && (
                  <p className={styles.errorMessage}>{signupErrors.acceptTerms}</p>
                )}
              </div>

              {signupMessage && (
                <p style={{ textAlign: 'center', color: signupMessage.includes('successfully') ? '#2e7d32' : '#d32f2f' }} className={styles.errorMessage}>
                  {signupMessage}
                </p>
              )}

              <button 
                type="submit" 
                className={styles.button}
                disabled={isLoading}
              >
                {isLoading ? 'Creating Account...' : 'Sign Up'}
              </button>

              <div className={styles.signupPrompt}>
                Already have an account?
                <button 
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className={styles.signupLink}
                >
                  Sign in
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowTermsModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Terms and Conditions</h2>
              <button 
                className={styles.modalClose}
                onClick={() => setShowTermsModal(false)}
              >
                ×
              </button>
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
              
              <h3>5. Termination</h3>
              <p>We reserve the right to terminate or suspend your account and access to the application at our sole discretion, without notice, for conduct that we believe violates these terms.</p>
              
              <h3>6. Changes to Terms</h3>
              <p>We reserve the right to modify these terms at any time. Your continued use of the application following any changes constitutes your acceptance of the new terms.</p>
              
              <h3>7. Contact Information</h3>
              <p>If you have any questions about these Terms, please contact us at support@example.com.</p>
            </div>
            <div className={styles.modalFooter}>
              <button 
                className={styles.modalButton}
                onClick={() => setShowTermsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}