'use client';

import Link from 'next/link';
import styles from './privacy.module.css';

export default function DataPrivacy() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <Link href="/" className={styles.backLink}>← Back to Home</Link>
        
        <h1 className={styles.title}>Privacy Policy</h1>
        
        <section className={styles.section}>
         
          <p>
            LH-Connect is committed to protecting your personal data and respecting your privacy rights in compliance with the 
            Data Privacy Act of 2012 (Republic Act No. 10173) and its implementing rules and regulations.
          </p>
        </section>

        <section className={styles.section}>
          <h2>1. Collection of Personal Data</h2>
          <p>
            LH-Connect collects personal data necessary to provide our services, including:
          </p>
          <ul>
            <li>Name and contact information</li>
            <li>Residential address and property details (block and lot numbers)</li>
            <li>Financial information for payment processing</li>
            <li>Communication preferences and interaction history</li>
            <li>Authentication and account security information</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>2. Purpose of Data Collection</h2>
          <p>
            Your personal data is collected and processed for the following lawful purposes:
          </p>
          <ul>
            <li>Providing billing, payment processing, and financial statement services</li>
            <li>Facilitating community communication and announcements</li>
            <li>Maintaining a secure digital registry of residents</li>
            <li>Generating financial reports and analytics</li>
            <li>Ensuring system security and fraud prevention</li>
            <li>Complying with legal and regulatory obligations</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>3. Data Protection and Security</h2>
          <p>
            LH-Connect implements appropriate technical and organizational measures to protect your personal data against 
            unauthorized access, alteration, disclosure, or destruction. All data is encrypted and stored securely using 
            industry-standard security protocols.
          </p>
        </section>

        <section className={styles.section}>
          <h2>4. Data Retention</h2>
          <p>
            Your personal data will be retained only as long as necessary to fulfill the purposes outlined in this notice or 
            as required by applicable laws and regulations. After the retention period, data will be securely deleted or 
            anonymized.
          </p>
        </section>

        <section className={styles.section}>
          <h2>5. Access and Correction Rights</h2>
          <p>
            You have the right to access, rectify, or request correction of your personal data held by LH-Connect. You may 
            submit a request by contacting our Data Protection Officer through your account settings or via email.
          </p>
        </section>

        <section className={styles.section}>
          <h2>6. Data Sharing and Disclosure</h2>
          <p>
            LH-Connect does not sell, rent, or lease your personal data to third parties. We may share your data only with:
          </p>
          <ul>
            <li>Authorized HOA officers and administrators (for legitimate business purposes)</li>
            <li>Payment processors and financial institutions (for payment processing)</li>
            <li>Legal authorities (when required by law)</li>
            <li>Trusted service providers bound by confidentiality agreements</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>7. Withdrawal of Consent</h2>
          <p>
            You may withdraw your consent to data processing at any time by submitting a written request to our Data Protection 
            Officer. However, withdrawal of consent may affect your ability to use certain features of the platform.
          </p>
        </section>

        <section className={styles.section}>
          <h2>8. Contact Information</h2>
          <p>
            For inquiries, concerns, or requests related to your personal data, please contact our Data Protection Officer:
          </p>
          <p>
            <strong>Email:</strong> lhconnectadmin@gmail.com<br />
            <strong>Address:</strong> LH-Connect Privacy Office
          </p>
        </section>

        <section className={styles.section}>
          <h2>9. Policy Updates</h2>
          <p>
            LH-Connect reserves the right to update this privacy policy to reflect changes in our practices or applicable 
            legislation. We will notify users of any material changes via email or through the platform.
          </p>
        </section>

        <section className={styles.section}>
          <h2>10. Complaint Resolution</h2>
          <p>
            If you believe your personal data has been mishandled, you have the right to file a complaint with the National 
            Privacy Commission (NPC) of the Philippines, in accordance with the Data Privacy Act of 2012.
          </p>
        </section>
      </div>
    </div>
  );
}
