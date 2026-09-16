import { Injectable, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'bipsy_admin_theme';

/**
 * Tema del panel. Por defecto sigue al sistema, como las webs; se puede fijar
 * a mano desde Cuenta. El script de index.html aplica lo guardado antes del
 * primer pintado; esto lo mantiene al día después.
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
      /* sin almacenamiento: se aplica solo en esta visita */
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
