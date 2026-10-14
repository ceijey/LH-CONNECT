function normalizeReference(value: unknown): string {
  return String(value ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

export function normalizeReceiptDateTime(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) return '';

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
  ].join('');
}

export function createReceiptFingerprint(referenceNumber: unknown, paymentDateTime: unknown): string {
  const reference = normalizeReference(referenceNumber);
  const dateTime = normalizeReceiptDateTime(paymentDateTime);
  return reference && dateTime ? `${reference}:${dateTime}` : '';
}
