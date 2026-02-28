'use client';

import Link from 'next/link';
import styles from './page.module.css';

export default function LandingPage() {
  return (
    <div className={styles.landingContainer}>
      {/* Navigation */}
      <nav className={styles.navbar}>
        <div className={styles.navContent}>
          <div className={styles.logo}>
            <span className={styles.logoText}>LH-Connect</span>
          </div>
          <div className={styles.navLinks}>
            <Link href="#features" className={styles.navLink}>Features</Link>
            <Link href="#about" className={styles.navLink}>About</Link>
            <Link href="#contact" className={styles.navLink}>Contact</Link>
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
            LH-Connect <span className={styles.highlight}></span>
          </h1>
          <p className={styles.heroSubtitle}>
            A Unified Management and Information System for Automating Monthly Dues and Resident Financial Analytics

          </p>
          <div className={styles.heroButtons}>
            <Link href="/login" className={styles.primaryButton}>
              Get Started
            </Link>
            <Link href="#features" className={styles.secondaryButton}>
              Learn More
            </Link>
          </div>
        </div>
        <div className={styles.heroImage}>
          <div className={styles.illustration}>
            {/* Simple illustration using CSS */}
            <div className={styles.circle}></div>
            <div className={styles.circle2}></div>
            <div className={styles.circle3}></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={styles.featuresSection}>
        <h2 className={styles.sectionTitle}>Core Features</h2>
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.iconBlue}`}>📈</div>
            <h3 className={styles.featureTitle}>Automated Billing Engine</h3>
            <p className={styles.featureDescription}>
              System-generated monthly invoices that auto-calculate dues and penalties based on community rules.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.iconGreen}`}>🛡️</div>
            <h3 className={styles.featureTitle}>60-Second Proof-of-Payment</h3>
            <p className={styles.featureDescription}>
              Simple mobile interface to upload payment screenshots for instant admin verification.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.iconPurple}`}>👥</div>
            <h3 className={styles.featureTitle}>Direct Admin Messenger</h3>
            <p className={styles.featureDescription}>
              In-app communication linking homeowners directly to HOA officers for queries.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.iconOrange}`}>📊</div>
            <h3 className={styles.featureTitle}>Real-Time Financial Dashboard</h3>
            <p className={styles.featureDescription}>
              Command center showing daily collections, fund breakdowns, and delinquency heatmaps.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.iconPurple}`}>👤</div>
            <h3 className={styles.featureTitle}>Digital Resident Registry</h3>
            <p className={styles.featureDescription}>
              Secure profile system replacing paper files, organized by block and lot numbers.
            </p>
          </div>
          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.iconPink}`}>📈</div>
            <h3 className={styles.featureTitle}>Auto-Generated Reports</h3>
            <p className={styles.featureDescription}>
              One-click export of weekly and monthly financial statements in PDF/Excel format.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>Ready to Get Started?</h2>
          <p className={styles.ctaSubtitle}>
            Join thousands of satisfied users today
          </p>
          <Link href="/login" className={styles.ctaButton}>
            Sign In Now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerColumn}>
            <h4 className={styles.footerTitle}>YourBrand</h4>
            <p className={styles.footerText}>
              Making your life easier since 2024
            </p>
          </div>
          <div className={styles.footerColumn}>
            <h4 className={styles.footerTitle}>Links</h4>
            <Link href="#features" className={styles.footerLink}>Features</Link>
            <Link href="#about" className={styles.footerLink}>About</Link>
            <Link href="#contact" className={styles.footerLink}>Contact</Link>
          </div>
          <div className={styles.footerColumn}>
            <h4 className={styles.footerTitle}>Legal</h4>
            <Link href="#" className={styles.footerLink}>Privacy Policy</Link>
            <Link href="#" className={styles.footerLink}>Terms of Service</Link>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p className={styles.copyright}>
            © 2024 YourBrand. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}