export function validateEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10;
}

export function validateUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateRequired(value: any): boolean {
  if (value === null || value === undefined) return false;
  
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  
  return true;
} 