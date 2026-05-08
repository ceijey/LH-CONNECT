'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import { logoutAndRedirect } from '@/lib/auth-session';
import { useAuthPageshow } from '@/lib/useAuthPageshow';
import Toast from '@/app/components/Toast';
import LoadingScreen from '@/app/components/LoadingScreen';
import styles from './account.module.css';

interface ProfileForm {
  fullName: string;
  email: string;
  phase: string;
  block: string;
  lot: string;
  phone: string;
  role: 'resident' | 'admin';
}

export default function AccountPage() {
  const router = useRouter();
  useAuthPageshow('resident');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [profile, setProfile] = useState<ProfileForm>({
    fullName: '',
    email: '',
    phase: '',
    block: '',
    lot: '',
    phone: '',
    role: 'resident',
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const payload = await apiCall('/api/auth/profile');
        const user = (payload.user ?? {}) as Partial<ProfileForm>;

        setProfile({
          fullName: user.fullName ?? '',
          email: user.email ?? '',
          phase: user.phase ?? '',
          block: user.block ?? '',
          lot: user.lot ?? '',
          phone: user.phone ?? '',
          role: user.role === 'admin' ? 'admin' : 'resident',
        });
      } catch (error) {
        setToast({ message: 'Failed to load your profile.', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const requiredFields = [profile.fullName, profile.email, profile.phase, profile.block, profile.lot, profile.phone];
    if (requiredFields.some((field) => !String(field).trim())) {
      setToast({ message: 'Fill in all required profile fields before saving.', type: 'error' });
      return;
    }

    try {
      setIsSaving(true);
      const payload = await apiCall('/api/auth/profile', {
        method: 'POST',
        body: JSON.stringify(profile),
      });

      const savedUser = (payload.user ?? profile) as ProfileForm;
      setProfile({
        fullName: savedUser.fullName ?? profile.fullName,
        email: savedUser.email ?? profile.email,
        phase: savedUser.phase ?? profile.phase,
        block: savedUser.block ?? profile.block,
        lot: savedUser.lot ?? profile.lot,
        phone: savedUser.phone ?? profile.phone,
        role: savedUser.role === 'admin' ? 'admin' : 'resident',
      });
      setToast({ message: 'Profile updated successfully.', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to save your profile.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const addressLabel = [profile.phase, profile.block && `Blk ${profile.block}`, profile.lot && `Lot ${profile.lot}`]
    .filter(Boolean)
    .join(' ');

  if (isLoading) {
    return <LoadingScreen message="Loading your account..." />;
  }

  return (
    <div className={styles.container}>
      <Toast
        isVisible={toast !== null}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'info'}
        onClose={() => setToast(null)}
      />

      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <Link href="/dashboard" className={styles.backBtn}>
              ← Back
            </Link>
            <div className={styles.headerBrand}>
              <Image
                src="/lhhoa-logo.png"
                alt="LHHOA Logo"
                width={50}
                height={50}
                className={styles.headerIcon}
                priority
              />
              <div>
                <h1 className={styles.headerTitle}>My Account</h1>
                <p className={styles.headerSubtitle}>Manage your resident profile</p>
              </div>
            </div>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={async () => {
              await logoutAndRedirect(router, '/');
            }}
          >
            ⬅ Logout
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>Resident record</p>
            <h2 className={styles.heroTitle}>Keep your contact details current</h2>
            <p className={styles.heroCopy}>
              The HOA uses this profile for billing, follow-ups, and resident verification.
            </p>
          </div>
          <aside className={styles.heroCard}>
            <span className={styles.heroLabel}>Account summary</span>
            <strong className={styles.heroValue}>{profile.fullName || 'Resident'}</strong>
            <span className={styles.heroMeta}>{addressLabel || 'Address not set'}</span>
            <span className={styles.heroMeta}>{profile.email || 'No email on file'}</span>
          </aside>
        </section>

        <section className={styles.contentGrid}>
          <form className={styles.formCard} onSubmit={handleSubmit}>
            <div className={styles.sectionHeader}>
              <h3>Profile details</h3>
              <p>Fields marked here are required by the current profile API.</p>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Full name</span>
                <input name="fullName" value={profile.fullName} onChange={handleChange} className={styles.input} />
              </label>
              <label className={styles.field}>
                <span>Email address</span>
                <input name="email" type="email" value={profile.email} onChange={handleChange} className={styles.input} />
              </label>
              <label className={styles.field}>
                <span>Phase</span>
                <input name="phase" value={profile.phase} onChange={handleChange} className={styles.input} />
              </label>
              <label className={styles.field}>
                <span>Block</span>
                <input name="block" value={profile.block} onChange={handleChange} className={styles.input} />
              </label>
              <label className={styles.field}>
                <span>Lot</span>
                <input name="lot" value={profile.lot} onChange={handleChange} className={styles.input} />
              </label>
              <label className={styles.field}>
                <span>Phone number</span>
                <input name="phone" value={profile.phone} onChange={handleChange} className={styles.input} />
              </label>
            </div>

            <div className={styles.actionsRow}>
              <button type="submit" className={styles.saveBtn} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
              <Link href="/dashboard/contact-hoa" className={styles.secondaryBtn}>
                Update with HOA
              </Link>
            </div>
          </form>

          <aside className={styles.sideCard}>
            <div className={styles.sectionHeader}>
              <h3>Why this matters</h3>
              <p>Keeping your profile updated improves billing and message delivery.</p>
            </div>

            <div className={styles.sideStat}>
              <span className={styles.statLabel}>Resident type</span>
              <strong className={styles.statValue}>{profile.role === 'admin' ? 'Admin' : 'Resident'}</strong>
            </div>
            <div className={styles.sideStat}>
              <span className={styles.statLabel}>Address</span>
              <strong className={styles.statValue}>{addressLabel || 'Not set yet'}</strong>
            </div>
            <div className={styles.sideStat}>
              <span className={styles.statLabel}>Primary contact</span>
              <strong className={styles.statValue}>{profile.phone || 'No phone number set'}</strong>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
