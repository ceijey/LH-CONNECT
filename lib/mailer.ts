import { Resend } from 'resend';

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? 'lhconnectadmin2@gmail.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Missing RESEND_API_KEY');
  return new Resend(apiKey);
}

// ─── Due Bill Email → Resident ───────────────────────────────────────────────

interface DueBillEmailOptions {
  toEmail: string;
  residentName: string;
  dueAmount: number;
  dueMonth: string;
}

export async function sendDueBillEmail({
  toEmail,
  residentName,
  dueAmount,
  dueMonth,
}: DueBillEmailOptions): Promise<void> {
  const resend = getResend();
  const formattedAmount = `₱${dueAmount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const { error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: [toEmail],
    subject: `📋 Monthly Due Bill — ${dueMonth}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Monthly Due Bill</title>
      </head>
      <body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;">

                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#1B2A4A 0%,#2C3E6B 100%);padding:36px 40px;text-align:center;">
                    <h1 style="color:#ffffff;font-size:26px;margin:0;letter-spacing:-0.5px;">LH-Connect</h1>
                    <p style="color:rgba(255,255,255,0.75);font-size:13px;margin:4px 0 0;">Lincoln Heights Homeowners Association</p>
                  </td>
                </tr>

                <!-- Alert Banner -->
                <tr>
                  <td style="background:#fff8e1;border-bottom:2px solid #ffe082;padding:16px 40px;text-align:center;">
                    <p style="color:#b45309;font-size:14px;font-weight:600;margin:0;">⚠️ You have an outstanding balance for <strong>${dueMonth}</strong></p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:36px 40px;">
                    <p style="color:#374151;font-size:16px;margin:0 0 8px;">Dear <strong>${residentName}</strong>,</p>
                    <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px;">
                      This is a friendly reminder from the Lincoln Heights HOA that your monthly dues are now due.
                      Please settle your balance at your earliest convenience to avoid penalties.
                    </p>

                    <!-- Amount Card -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:2px solid rgba(220,38,38,0.2);border-radius:10px;margin-bottom:28px;">
                      <tr>
                        <td style="padding:24px;text-align:center;">
                          <p style="color:#9b1c1c;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Amount Due</p>
                          <p style="color:#dc2626;font-size:42px;font-weight:700;margin:0;">${formattedAmount}</p>
                          <p style="color:#6b7280;font-size:13px;margin:8px 0 0;">${dueMonth}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${APP_URL}/dashboard/submit-payment"
                             style="display:inline-block;background:linear-gradient(135deg,#1B2A4A 0%,#2C3E6B 100%);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                            💳 Submit Payment Proof
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
                    <p style="color:#9ca3af;font-size:12px;margin:0 0 4px;">Lincoln Heights Homeowners Association</p>
                    <p style="color:#9ca3af;font-size:12px;margin:0;">This is an automated notification. Please do not reply to this email.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ─── Payment Submitted Notification → Admin ──────────────────────────────────

interface PaymentSubmittedOptions {
  residentName: string;
  block: string;
  lot: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  submissionId: string;
}

export async function sendPaymentSubmittedEmail({
  residentName,
  block,
  lot,
  amount,
  paymentMethod,
  referenceNumber,
  submissionId,
}: PaymentSubmittedOptions): Promise<void> {
  const resend = getResend();
  const formattedAmount = `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const { error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: [ADMIN_EMAIL],
    subject: `💰 New Payment Submitted — ${residentName}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"/><title>Payment Submitted</title></head>
      <body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;">

                <tr>
                  <td style="background:linear-gradient(135deg,#1B2A4A 0%,#2C3E6B 100%);padding:30px 40px;text-align:center;">
                    <h1 style="color:#fff;font-size:24px;margin:0;">LH-Connect</h1>
                    <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:4px 0 0;">Admin Payment Notification</p>
                  </td>
                </tr>

                <tr>
                  <td style="background:#f0fdf4;border-bottom:2px solid #86efac;padding:16px 40px;text-align:center;">
                    <p style="color:#15803d;font-size:14px;font-weight:600;margin:0;">✅ A resident has submitted payment proof for verification</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:32px 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:28px;">
                      <tr style="background:#f9fafb;">
                        <td style="padding:14px 20px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;" colspan="2">Payment Details</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 20px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;width:40%;">Resident</td>
                        <td style="padding:12px 20px;color:#111827;font-size:14px;font-weight:600;border-bottom:1px solid #f3f4f6;">${residentName}</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 20px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Unit</td>
                        <td style="padding:12px 20px;color:#111827;font-size:14px;border-bottom:1px solid #f3f4f6;">Block ${block}, Lot ${lot}</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 20px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Amount</td>
                        <td style="padding:12px 20px;color:#16a34a;font-size:16px;font-weight:700;border-bottom:1px solid #f3f4f6;">${formattedAmount}</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 20px;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Method</td>
                        <td style="padding:12px 20px;color:#111827;font-size:14px;border-bottom:1px solid #f3f4f6;">${paymentMethod}</td>
                      </tr>
                      ${referenceNumber ? `
                      <tr>
                        <td style="padding:12px 20px;color:#6b7280;font-size:14px;">Reference #</td>
                        <td style="padding:12px 20px;color:#111827;font-size:14px;font-weight:600;">${referenceNumber}</td>
                      </tr>` : ''}
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${APP_URL}/admin/payments"
                             style="display:inline-block;background:linear-gradient(135deg,#1B2A4A 0%,#2C3E6B 100%);color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">
                            🔍 Review Payment
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
                    <p style="color:#9ca3af;font-size:12px;margin:0;">LH-Connect • Automated Admin Notification</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

// ─── Payment Verified Notification → Resident ────────────────────────────────

interface PaymentVerifiedOptions {
  toEmail: string;
  residentName: string;
  amount: number;
  month: string;
}

export async function sendPaymentVerifiedEmail({
  toEmail,
  residentName,
  amount,
  month,
}: PaymentVerifiedOptions): Promise<void> {
  const resend = getResend();
  const formattedAmount = `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const { error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: [toEmail],
    subject: `✅ Payment Verified — ${month}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"/><title>Payment Verified</title></head>
      <body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;">
                <tr>
                  <td style="background:linear-gradient(135deg,#1B2A4A 0%,#2C3E6B 100%);padding:30px 40px;text-align:center;">
                    <h1 style="color:#fff;font-size:24px;margin:0;">LH-Connect</h1>
                    <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:4px 0 0;">Lincoln Heights Homeowners Association</p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f0fdf4;border-bottom:2px solid #86efac;padding:16px 40px;text-align:center;">
                    <p style="color:#15803d;font-size:14px;font-weight:600;margin:0;">✅ Your payment has been verified by the HOA!</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 40px;text-align:center;">
                    <p style="color:#374151;font-size:16px;margin:0 0 24px;">Dear <strong>${residentName}</strong>, your payment of</p>
                    <p style="color:#16a34a;font-size:48px;font-weight:700;margin:0 0 8px;">${formattedAmount}</p>
                    <p style="color:#6b7280;font-size:14px;margin:0 0 32px;">for <strong>${month}</strong> has been confirmed.</p>
                    <a href="${APP_URL}/dashboard/transactions"
                       style="display:inline-block;background:linear-gradient(135deg,#1B2A4A 0%,#2C3E6B 100%);color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">
                      📄 View Transaction
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
                    <p style="color:#9ca3af;font-size:12px;margin:0;">This is an automated notification from LH-Connect. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}
