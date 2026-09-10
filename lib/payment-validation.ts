export function validatePaymentAmount(value: number | string): { isValid: boolean; error?: string } {
  const numericValue = typeof value === 'string' ? Number(value.trim()) : Number(value);

  if (!Number.isFinite(numericValue)) {
    return { isValid: false, error: 'Payment amount is invalid.' };
  }

  if (numericValue <= 0) {
    return { isValid: false, error: 'Payment amount must be greater than zero.' };
  }

  if (numericValue > 1000000000) {
    return { isValid: false, error: 'Payment amount is too large.' };
  }

  return { isValid: true };
}
