export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export function isValidDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  
  try {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}

export function getDaysBetween(startDate: string | null | undefined, endDate: string | null | undefined): number {
  if (!startDate || !endDate) return 0;
  
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  
  if (!start || !end) return 0;
  
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
} 