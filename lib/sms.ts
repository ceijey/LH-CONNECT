/**
 * SMS utility using Semaphore (Philippine SMS gateway)
 * Sign up free at: https://semaphore.co
 * Free trial includes 20 SMS credits
 */

const SEMAPHORE_API_URL = 'https://api.semaphore.co/api/v4/messages';

interface DueBillSMSOptions {
  toPhone: string;      // Philippine number e.g. 09171234567 or +639171234567
  residentName: string;
  dueAmount: number;
  dueMonth: string;
}

function formatPhilippineNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Convert 09xxxxxxxxx → 639xxxxxxxxx (Semaphore format)
  if (digits.startsWith('0') && digits.length === 11) {
    return '63' + digits.slice(1);
  }
  // Already in 639xxxxxxxxx format
  if (digits.startsWith('63') && digits.length === 12) {
    return digits;
  }
  // Strip leading + if present
  if (digits.startsWith('639') && digits.length === 12) {
    return digits;
  }
  // Return as-is and let Semaphore handle it
  return digits;
}

export async function sendDueBillSMS({
  toPhone,
  residentName,
  dueAmount,
  dueMonth,
}: DueBillSMSOptions): Promise<void> {
  const apiKey = process.env.SEMAPHORE_API_KEY;

  if (!apiKey) {
    throw new Error('SEMAPHORE_API_KEY is not set in environment variables');
  }

  const formattedPhone = formatPhilippineNumber(toPhone);
  const formattedAmount = `PHP ${dueAmount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  // Keep message under 160 chars for a single SMS
  const message =
    `LH-Connect HOA: Hi ${residentName}, ` +
    `your monthly due of ${formattedAmount} for ${dueMonth} is now due. ` +
    `Please log in to lh-connect to submit your payment. Thank you!`;

  const params = new URLSearchParams({
    apikey: apiKey,
    number: formattedPhone,
    message,
    sendername: process.env.SEMAPHORE_SENDER_NAME ?? 'LH-Connect',
  });

  const response = await fetch(SEMAPHORE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Semaphore SMS error ${response.status}: ${text}`);
  }

  const result = await response.json();
  console.log('[SMS] Sent successfully:', result);
}
