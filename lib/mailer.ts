import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM ?? 'LH-Connect <onboarding@resend.dev>';

function getResend() {
  if (!RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY');
  return new Resend(RESEND_API_KEY);
}

interface DueBillEmailOptions {
  toEmail: string;
  residentName: string;
  dueAmount: number;
  dueMonth: string;
}

export async function sendDueBillEmail({ toEmail, residentName, dueAmount, dueMonth, }: DueBillEmailOptions): Promise<void> {
  console.log(`[mailer stub] sendDueBillEmail -> to=${toEmail}, name=${residentName}, amount=${dueAmount}, month=${dueMonth}`);
}

interface PaymentSubmittedOptions {
  residentName: string;
  block: string;
  lot: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  submissionId: string;
}

export async function sendPaymentSubmittedEmail(options: PaymentSubmittedOptions): Promise<void> {
  console.log(`[mailer stub] sendPaymentSubmittedEmail -> resident=${options.residentName}, amount=${options.amount}`);
}

interface PaymentVerifiedOptions {
  toEmail: string;
  residentName: string;
  amount: number;
  month: string;
}

export async function sendPaymentVerifiedEmail(options: PaymentVerifiedOptions): Promise<void> {
  await sendPaymentStatusEmail({
    toEmail: options.toEmail,
    residentName: options.residentName,
    amount: options.amount,
    month: options.month,
    status: 'Verified',
  });
}

interface PaymentStatusEmailOptions {
  toEmail: string;
  residentName: string;
  amount: number;
  month: string;
  status: 'Verified' | 'Rejected';
  rejectionReason?: string;
}

export async function sendPaymentStatusEmail({
  toEmail,
  residentName,
  amount,
  month,
  status,
  rejectionReason,
}: PaymentStatusEmailOptions): Promise<void> {
  const resend = getResend();
  const isApproved = status === 'Verified';
  const subject = isApproved ? `✅ Payment Approved for ${month}` : `⚠️ Payment Declined for ${month}`;
  const message = isApproved
    ? `Your payment of ₱${amount.toLocaleString()} for ${month} has been approved.`
    : `Your payment of ₱${amount.toLocaleString()} for ${month} was declined.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`;

  const { error } = await resend.emails.send({
    from: RESEND_FROM,
    to: [toEmail],
    subject,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${subject}</title>
      </head>
      <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
        <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;">
          <div style="background:#1B2A4A;color:#fff;padding:24px 32px;">
            <h1 style="margin:0;font-size:24px;">LH-Connect</h1>
          </div>
          <div style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;color:#374151;">Dear <strong>${residentName}</strong>,</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${message}</p>
            <p style="margin:0;font-size:14px;color:#6b7280;">You can check your account for the latest payment status and notification details.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

interface AccountStatusEmailOptions {
  toEmail: string;
  residentName: string;
  status: 'Approved' | 'Rejected';
}

export async function sendAccountStatusEmail({ toEmail, residentName, status, }: AccountStatusEmailOptions): Promise<void> {
  const resend = getResend();
  const subject = status === 'Approved' ? '✅ Account Approved' : '⚠️ Account Rejected';
  const message =
    status === 'Approved'
      ? 'Your account has been approved. You can now sign in to LH-Connect.'
      : 'Your account registration was not approved. Please contact the HOA for more information.';

  const { error } = await resend.emails.send({
    from: RESEND_FROM,
    to: [toEmail],
    subject,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${subject}</title>
      </head>
      <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
        <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;">
          <div style="background:#1B2A4A;color:#fff;padding:24px 32px;">
            <h1 style="margin:0;font-size:24px;">LH-Connect</h1>
          </div>
          <div style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;color:#374151;">Dear <strong>${residentName}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">${message}</p>
            <p style="margin:0;font-size:14px;color:#6b7280;">Please sign in to your account to continue.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

interface AnnouncementEmailOptions {
  toEmail: string;
  residentName?: string;
  title: string;
  content: string;
}

export async function sendAnnouncementEmail({ toEmail, residentName, title, content, }: AnnouncementEmailOptions): Promise<void> {
  const resend = getResend();
  const subject = `📢 ${title}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${subject}</title>
    </head>
    <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:#1B2A4A;color:#fff;padding:20px 28px;">
          <h1 style="margin:0;font-size:20px;">LH-Connect</h1>
        </div>
        <div style="padding:28px;color:#374151;">
          <p>Dear <strong>${residentName ?? 'Resident'}</strong>,</p>
          <h2 style="font-size:18px;margin-top:8px;margin-bottom:12px;">${title}</h2>
          <div style="font-size:15px;line-height:1.6;color:#374151;">${content}</div>
        </div>
      </div>
    </body>
    </html>
  `;

  const { error } = await resend.emails.send({
    from: RESEND_FROM,
    to: [toEmail],
    subject,
    html,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}
