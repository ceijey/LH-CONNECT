'use client';

import Link from 'next/link';
import styles from './terms.module.css';

export default function TermsAndConditions() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <Link href="/" className={styles.backLink}>← Back to Home</Link>
        
        <h1 className={styles.title}>Terms and Conditions</h1>
        
        <section className={styles.section}>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using LH-Connect, you accept and agree to be bound by the terms and provision of this agreement. 
            If you do not agree to abide by the above, please do not use this service.
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. Use License</h2>
          <p>
            Permission is granted to temporarily download one copy of the materials (information or software) on LH-Connect 
            for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and 
            under this license you may not:
          </p>
          <ul>
            <li>Modifying or copying the materials</li>
            <li>Using the materials for any commercial purpose or for any public display</li>
            <li>Attempting to decompile or reverse engineer any software contained on LH-Connect</li>
            <li>Removing any copyright or other proprietary notations from the materials</li>
            <li>Transferring the materials to another person or "mirroring" the materials on any other server</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>3. Disclaimer</h2>
          <p>
            The materials on LH-Connect are provided on an 'as is' basis. LH-Connect makes no warranties, expressed or implied, 
            and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions 
            of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation 
            of rights.
          </p>
        </section>

        <section className={styles.section}>
          <h2>4. Limitations</h2>
          <p>
            In no event shall LH-Connect or its suppliers be liable for any damages (including, without limitation, damages for 
            loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on 
            LH-Connect, even if we or our authorized representative has been notified orally or in writing of the possibility of 
            such damage.
          </p>
        </section>

        <section className={styles.section}>
          <h2>5. Accuracy of Materials</h2>
          <p>
            The materials appearing on LH-Connect could include technical, typographical, or photographic errors. LH-Connect does 
            not warrant that any of the materials on LH-Connect are accurate, complete, or current. LH-Connect may make changes to 
            the materials contained on LH-Connect at any time without notice.
          </p>
        </section>

        <section className={styles.section}>
          <h2>6. Links</h2>
          <p>
            LH-Connect has not reviewed all of the sites linked to its website and is not responsible for the contents of any such 
            linked site. The inclusion of any link does not imply endorsement by LH-Connect of the site. Use of any such linked 
            website is at the user's own risk.
          </p>
        </section>

        <section className={styles.section}>
          <h2>7. Modifications</h2>
          <p>
            LH-Connect may revise these terms and conditions for our website at any time without notice. By using this website, 
            you are agreeing to be bound by the then current version of these terms and conditions.
          </p>
        </section>

        <section className={styles.section}>
          <h2>8. Governing Law</h2>
          <p>
            These terms and conditions are governed by and construed in accordance with the laws of the jurisdiction in which 
            LH-Connect operates, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
          </p>
        </section>
      </div>
    </div>
  );
}
