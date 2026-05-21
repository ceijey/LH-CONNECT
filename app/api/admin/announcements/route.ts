import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCsrf } from '@/lib/csrf';
import { logAuditAction } from '@/lib/audit-logger';
import { sendAnnouncementEmail } from '@/lib/mailer';

export async function POST(request: NextRequest) {
  const tokenVerification = await requireApprovedUser(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;
  const adminId = decoded.uid;

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const adminDoc = await adminDb.collection('users').doc(adminId).get();
    const adminData = adminDoc.data();
    if (!adminData || (adminData.role ?? '') !== 'admin') {
      return createErrorResponse('Forbidden', 403);
    }

    const adminName = adminData.fullName || adminData.name || 'Admin';

    const body = await request.json();
    const { title, content, severity = 'info' } = body;

    if (!title || !content) {
      return createErrorResponse('Missing required fields: title, content', 400);
    }

    const now = new Date();

    // 1. Create the announcement record
    const announcementRef = await adminDb.collection('announcements').add({
      title,
      content,
      severity, // 'info' | 'warning' | 'success' | 'event'
      createdBy: adminName,
      createdAt: now,
    });

    // 2. Query all resident users
    const residentsSnapshot = await adminDb
      .collection('users')
      .where('role', '==', 'resident')
      .get();

    // 3. Batch write notifications to all residents and collect emails
    let batch = adminDb.batch();
    let count = 0;
    const emails: string[] = [];

    for (const resDoc of residentsSnapshot.docs) {
      const data = resDoc.data() as any;
      const notificationRef = adminDb.collection('notifications').doc();
      batch.set(notificationRef, {
        userId: resDoc.id,
        title: '📢 New Announcement',
        message: `Admin posted: "${title}"`,
        type: severity === 'warning' ? 'warning' : 'info',
        read: false,
        createdAt: now,
      });

      if (data && data.email) emails.push(data.email);

      count++;
      if (count === 500) {
        await batch.commit();
        batch = adminDb.batch();
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    // 4. Send announcement emails using limited concurrency + retry/backoff to avoid 429s
    function sleep(ms: number) {
      return new Promise((res) => setTimeout(res, ms));
    }

    async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
      const results: R[] = [] as any;
      let idx = 0;
      const workers = new Array(concurrency).fill(null).map(async () => {
        while (true) {
          const current = idx++;
          if (current >= items.length) break;
          // eslint-disable-next-line no-await-in-loop
          results[current] = await fn(items[current]);
        }
      });
      await Promise.all(workers);
      return results;
    }

    async function sendWithRetries(email: string, attempts = 5) {
      let attempt = 0;
      let delay = 500; // ms
      while (attempt < attempts) {
        attempt++;
        try {
          await sendAnnouncementEmail({ toEmail: email, title, content });
          return { email, ok: true };
        } catch (err: any) {
          const msg = String(err?.message || '');
          const is429 = /429|Too Many Requests/i.test(msg) || err?.status === 429 || err?.response?.status === 429;
          // try to respect Retry-After header if present
          const retryAfter = err?.response?.headers?.['retry-after'] || err?.headers?.['retry-after'];
          if (!is429 || attempt === attempts) {
            return { email, ok: false, err };
          }
          let wait = delay;
          if (retryAfter) {
            const ra = parseInt(String(retryAfter), 10);
            if (!isNaN(ra)) wait = ra * 1000;
          }
          // jitter
          const jitter = Math.floor(Math.random() * 300);
          await sleep(wait + jitter);
          delay *= 2;
        }
      }
      return { email, ok: false, err: new Error('exhausted retries') };
    }

    const chunkSize = parseInt(process.env.RESEND_ANNOUNCE_CHUNK_SIZE || '200', 10); // process these many emails per batch
    const concurrency = parseInt(process.env.RESEND_ANNOUNCE_CONCURRENCY || '5', 10); // how many concurrent sends to allow
    const batchDelay = parseInt(process.env.RESEND_ANNOUNCE_BATCH_DELAY_MS || '800', 10);
    console.log(`[Mailer] announcement send params chunkSize=${chunkSize} concurrency=${concurrency} batchDelay=${batchDelay} emails=${emails.length}`);
    for (let i = 0; i < emails.length; i += chunkSize) {
      const chunk = emails.slice(i, i + chunkSize);
      const results = await mapWithConcurrency(chunk, concurrency, (email) => sendWithRetries(email));
      const failed = results.filter(r => !r.ok);
      if (failed.length > 0) {
        console.warn(`[Mailer] Failed to send ${failed.length} announcement emails in batch starting at ${i}`);
      }
      // small pause between batches to avoid bursts
      await sleep(batchDelay);
    }

    await logAuditAction(
      adminId,
      adminName,
      'Create Announcement',
      `Posted a new ${severity} announcement: "${title}"`,
      announcementRef.id
    );

    return NextResponse.json({
      success: true,
      message: 'Announcement posted successfully',
      announcementId: announcementRef.id,
    });

  } catch (error: any) {
    console.error('Error posting announcement:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
