export function getMonthlySubmissionMonth(date: Date = new Date()): string {
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

export function getMonthlySubmissionId(residentId: string, date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${residentId}-${year}-${month}`;
}