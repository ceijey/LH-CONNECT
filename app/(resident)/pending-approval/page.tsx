'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { logoutAndRedirect } from '@/lib/auth-session';

export default function PendingApprovalPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: 'linear-gradient(135deg, #f8fbff 0%, #eef4ff 100%)', color: '#1B2A4A' }}>
      <div style={{ width: '100%', maxWidth: '720px', background: '#fff', borderRadius: '28px', padding: '40px', boxShadow: '0 18px 50px rgba(27, 42, 74, 0.12)', border: '1px solid rgba(27, 42, 74, 0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <Image src="/lhhoa-logo.png" alt="LHHOA Logo" width={56} height={56} priority />
          <div>
            <div style={{ fontSize: '0.85rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5f6f8a', fontWeight: 700 }}>LH-Connect</div>
            <h1 style={{ margin: 0, fontSize: '2rem', lineHeight: 1.1 }}>Account pending HOA approval</h1>
          </div>
        </div>

        <p style={{ fontSize: '1.05rem', lineHeight: 1.7, margin: '0 0 16px' }}>
          Your account has been created, but it is not active yet. An HOA admin needs to verify your residency details before you can access the resident dashboard.
        </p>
        <p style={{ fontSize: '1rem', lineHeight: 1.7, margin: '0 0 28px', color: '#4c5a73' }}>
          If the information you submitted is correct, please wait for approval. If you need to speed things up, contact the HOA office and confirm your unit details.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={async () => {
              await logoutAndRedirect(router, '/login');
            }}
            style={{ border: 'none', borderRadius: '999px', padding: '14px 22px', background: '#1B2A4A', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}