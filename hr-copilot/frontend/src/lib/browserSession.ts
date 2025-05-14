import { v4 as uuidv4 } from 'uuid';

const BROWSER_SESSION_KEY = 'hr_copilot_browser_session';

export function getBrowserSessionId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  let sessionId = localStorage.getItem(BROWSER_SESSION_KEY);
  
  if (!sessionId) {
    sessionId = uuidv4();
    localStorage.setItem(BROWSER_SESSION_KEY, sessionId);
  }
  
  return sessionId;
} 