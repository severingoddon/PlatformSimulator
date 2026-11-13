import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'participantId';

/** Allowed participant IDs: letters, digits, "_" and "-" (matches Qualtrics/Prolific IDs). */
export const PID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

@Injectable({ providedIn: 'root' })
export class UserSessionService {
  private pid = signal<string | null>(this.restore());

  setPid(pid: string): void {
    this.pid.set(pid);
    try {
      sessionStorage.setItem(STORAGE_KEY, pid);
    } catch {
      // storage unavailable (e.g. private mode) – the in-memory value is enough
    }
  }

  getPid(): string | null {
    return this.pid();
  }

  hasPid(): boolean {
    return this.pid() !== null;
  }

  private restore(): string | null {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored && PID_PATTERN.test(stored) ? stored : null;
    } catch {
      return null;
    }
  }
}
