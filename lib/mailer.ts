import { Resend } from 'resend';

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
  const formattedAmount = `₱${dueAmount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY');
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: 'LH-Connect HOA <onboarding@resend.dev>',
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

                    <!-- Payment Options -->
                    <p style="color:#374151;font-size:15px;font-weight:600;margin:0 0 12px;">Payment Options:</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
                          <span style="color:#1B2A4A;font-weight:600;">💙 GCash:</span>
                          <span style="color:#6b7280;"> 0917-123-4567</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
                          <span style="color:#1B2A4A;font-weight:600;">💚 Maya:</span>
                          <span style="color:#6b7280;"> 0918-765-4321</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
                          <span style="color:#1B2A4A;font-weight:600;">🏦 Bank Transfer:</span>
                          <span style="color:#6b7280;"> BDO Account 12345-6789</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;">
                          <span style="color:#1B2A4A;font-weight:600;">💵 Cash:</span>
                          <span style="color:#6b7280;"> Pay at HOA office</span>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${appUrl}/dashboard/submit-payment"
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
                    <p style="color:#9ca3af;font-size:12px;margin:0;">
                      This is an automated notification from LH-Connect. Please do not reply to this email.
                    </p>
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

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
