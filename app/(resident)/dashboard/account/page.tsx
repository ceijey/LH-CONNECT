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
  profileImage?: string;
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
    profileImage: '',
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
          profileImage: user.profileImage ?? '',
        });
      } catch (error) {
        setToast({ message: 'Failed to load your profile.', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
  }, []);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setToast({ message: 'Profile photo must be smaller than 1MB.', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (base64) {
        setProfile((current) => {
          const updated = { ...current, profileImage: base64 };

          void (async () => {
            try {
              setIsSaving(true);
              const payload = await apiCall('/api/auth/profile', {
                method: 'POST',
                body: JSON.stringify(updated),
              });
              const savedUser = (payload.user ?? updated) as ProfileForm;
              setProfile({
                fullName: savedUser.fullName ?? updated.fullName,
                email: savedUser.email ?? updated.email,
                phase: savedUser.phase ?? updated.phase,
                block: savedUser.block ?? updated.block,
                lot: savedUser.lot ?? updated.lot,
                phone: savedUser.phone ?? updated.phone,
                role: savedUser.role === 'admin' ? 'admin' : 'resident',
                profileImage: savedUser.profileImage ?? updated.profileImage ?? '',
              });
              setToast({ message: 'Profile photo updated successfully!', type: 'success' });
            } catch (err: any) {
              setToast({ message: err?.message || 'Failed to save profile photo.', type: 'error' });
            } finally {
              setIsSaving(false);
            }
          })();

          return updated;
        });
      }
    };
    reader.readAsDataURL(file);
  };

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
        profileImage: savedUser.profileImage ?? profile.profileImage ?? '',
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

      {/* ── Header ── */}
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
                width={38}
                height={38}
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
            onClick={async () => { await logoutAndRedirect(router, '/login'); }}
          >
            ⬅ Logout
          </button>
        </div>
      </header>

      <main className={styles.main}>

        {/* ── Profile Banner ── */}
        <div className={styles.profileBanner}>
          <div className={styles.avatarWrap}>
            {profile.profileImage ? (
              <img
                src={profile.profileImage}
                alt="Profile"
                className={styles.avatarImg}
              />
            ) : (
              <div className={styles.avatarInitial}>
                {(profile.fullName || 'R').charAt(0).toUpperCase()}
              </div>
            )}
            <label htmlFor="profile-image-upload" className={styles.avatarEditLabel} title="Change photo">
              📷
            </label>
            <input
              id="profile-image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
          </div>

          <div className={styles.bannerInfo}>
            <p className={styles.bannerTag}>Account Summary</p>
            <h2 className={styles.bannerName}>{profile.fullName || 'Resident'}</h2>
            <p className={styles.bannerAddress}>{addressLabel || 'Address not set'}</p>
            <p className={styles.bannerEmail}>{profile.email || 'No email on file'}</p>
          </div>

          <span className={styles.bannerBadge}>
            {profile.role === 'admin' ? '🛡 Admin' : '🏠 Resident'}
          </span>
        </div>

        {/* ── Content Grid ── */}
        <div className={styles.contentGrid}>

          {/* Form Card */}
          <form className={styles.formCard} onSubmit={handleSubmit}>
            <div className={styles.sectionHeader}>
              <h3>Profile details</h3>
              <p>All fields are required by the profile API. Keep your information accurate and up to date.</p>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Full name</span>
                <input name="fullName" value={profile.fullName} onChange={handleChange} className={styles.input} placeholder="e.g. Juan Dela Cruz" />
              </label>
              <label className={styles.field}>
                <span>Email address</span>
                <input name="email" type="email" value={profile.email} onChange={handleChange} className={styles.input} placeholder="you@example.com" />
              </label>
              <label className={styles.field}>
                <span>Phase</span>
                <input name="phase" value={profile.phase} onChange={handleChange} className={styles.input} placeholder="e.g. Phase 1" />
              </label>
              <label className={styles.field}>
                <span>Block</span>
                <input name="block" value={profile.block} onChange={handleChange} className={styles.input} placeholder="e.g. 3" />
              </label>
              <label className={styles.field}>
                <span>Lot</span>
                <input name="lot" value={profile.lot} onChange={handleChange} className={styles.input} placeholder="e.g. 12" />
              </label>
              <label className={styles.field}>
                <span>Phone number</span>
                <input name="phone" value={profile.phone} onChange={handleChange} className={styles.input} placeholder="e.g. 09XX XXX XXXX" />
              </label>
            </div>

            <div className={styles.actionsRow}>
              <button type="submit" className={styles.saveBtn} disabled={isSaving}>
                {isSaving ? '⏳ Saving...' : '💾 Save Profile'}
              </button>
              <Link href="/dashboard/contact-hoa" className={styles.secondaryBtn}>
                💬 Update with HOA
              </Link>
            </div>
          </form>

          {/* Side Card */}
          <aside className={styles.sideCard}>
            <div className={styles.whyCard}>
              <h3 className={styles.whyTitle}>Why this matters</h3>
              <p className={styles.whyDesc}>
                Keeping your profile updated ensures accurate billing, proper communication, and smooth HOA service delivery.
              </p>

              <div className={styles.sideStat}>
                <span className={styles.statLabel}>Resident type</span>
                <strong className={styles.statValue}>{profile.role === 'admin' ? 'Admin' : 'Resident'}</strong>
              </div>
              <div className={styles.sideStat} style={{ marginTop: '0.75rem' }}>
                <span className={styles.statLabel}>Address</span>
                <strong className={styles.statValue}>{addressLabel || 'Not set yet'}</strong>
              </div>
              <div className={styles.sideStat} style={{ marginTop: '0.75rem' }}>
                <span className={styles.statLabel}>Primary contact</span>
                <strong className={styles.statValue}>{profile.phone || 'No phone number set'}</strong>
              </div>
            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}
