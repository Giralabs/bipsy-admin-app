import { Injectable, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'bipsy_admin_theme';

/**
 * Panel theme. By default it follows the system, like the websites; it can be
 * set manually from Cuenta. The script in index.html applies the stored value
 * before the first paint; this keeps it up to date afterwards.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  readonly preference = signal<ThemePreference>(this.read());

  constructor() {
    this.media.addEventListener('change', () => this.apply());
    this.apply();
  }

  set(pref: ThemePreference) {
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // No storage available: it only applies for this visit.
    }
    this.preference.set(pref);
    this.apply();
  }

  private apply() {
    const pref = this.preference();
    const dark = pref === 'dark' || (pref === 'system' && this.media.matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  private read(): ThemePreference {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'light' || v === 'dark' ? v : 'system';
    } catch {
      return 'system';
    }
  }
}
