'use client';

import Link from 'next/link';
import Image from 'next/image';
import styles from './page.module.css';

export default function LandingPage() {
  return (
    <div className={styles.landingContainer}>
      {/* Dynamic Background */}

      {/* Navigation */}
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <Link href="/" className={styles.logo}>
            <Image
              src="/lhhoa-logo.png"
              alt="LHHOA Logo"
              width={40}
              height={40}
              className={styles.navLogo}
              priority
            />
            <span className={styles.logoText}>LH-Connect</span>
          </Link>
          <div className={styles.navLinks}>
            <Link href="#features" className={styles.navLink}>Features</Link>
            <Link href="/login" className={styles.loginNavButton}>
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Modernizing Your <br />
            <span className={styles.highlight}>Community Experience</span>
          </h1>
          <p className={styles.heroSubtitle}>
            A unified management and information system for automating monthly dues, real-time resident analytics, and seamless communication.
          </p>
          <div className={styles.heroButtons}>
            <Link href="/login" className={styles.primaryButton}>
              Get Started <span style={{ fontSize: '1.2em' }}>→</span>
            </Link>
            <Link href="#features" className={styles.secondaryButton}>
              Explore Features
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={styles.featuresSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Everything you need</h2>
          <p className={styles.sectionSubtitle}>Powerful tools designed to simplify community administration and empower residents.</p>
        </div>
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={`${styles.featureIconWrapper} ${styles.iconBlue}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <h3 className={styles.featureTitle}>Automated Billing</h3>
            <p className={styles.featureDescription}>
              System-generated monthly invoices that auto-calculate dues and penalties based on community rules.
            </p>
          </div>
          
          <div className={styles.featureCard}>
            <div className={`${styles.featureIconWrapper} ${styles.iconGreen}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h3 className={styles.featureTitle}>Instant Verification</h3>
            <p className={styles.featureDescription}>
              Simple mobile interface to upload payment screenshots for rapid 60-second admin verification.
            </p>
          </div>
          
          <div className={styles.featureCard}>
            <div className={`${styles.featureIconWrapper} ${styles.iconPurple}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 className={styles.featureTitle}>Direct Messenger</h3>
            <p className={styles.featureDescription}>
              In-app communication linking homeowners directly to HOA officers for fast issue resolution.
            </p>
          </div>
          
          <div className={styles.featureCard}>
            <div className={`${styles.featureIconWrapper} ${styles.iconOrange}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            </div>
            <h3 className={styles.featureTitle}>Financial Dashboard</h3>
            <p className={styles.featureDescription}>
              Command center showing daily collections, fund breakdowns, and clear delinquency heatmaps.
            </p>
          </div>
          
          <div className={styles.featureCard}>
            <div className={`${styles.featureIconWrapper} ${styles.iconIndigo}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3 className={styles.featureTitle}>Digital Registry</h3>
            <p className={styles.featureDescription}>
              Secure profile system replacing paper files, beautifully organized by block and lot numbers.
            </p>
          </div>
          
          <div className={styles.featureCard}>
            <div className={`${styles.featureIconWrapper} ${styles.iconPink}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </div>
            <h3 className={styles.featureTitle}>Smart Reports</h3>
            <p className={styles.featureDescription}>
              One-click export of weekly and monthly financial statements in PDF or Excel format.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaWrapper}>
          <div className={styles.ctaContent}>
            <h2 className={styles.ctaTitle}>Ready to transform your community?</h2>
            <p className={styles.ctaSubtitle}>
              Join modern neighborhoods leveraging LH-Connect to automate their management and build stronger communities.
            </p>
            <Link href="/login" className={styles.ctaButton}>
              Create your account today
            </Link>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} LH-Connect. All rights reserved.</p>
      </footer>
    </div>
  );
}