import type { SessionData } from '../types';
import { defaultSession } from '../types';

const KEY = 'author-brand-architect-session';

export function loadSession(): SessionData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaultSession };
    const parsed = JSON.parse(raw);
    return { ...defaultSession, ...parsed };
  } catch {
    return { ...defaultSession };
  }
}

export function saveSession(data: SessionData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage might be full
  }
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}

