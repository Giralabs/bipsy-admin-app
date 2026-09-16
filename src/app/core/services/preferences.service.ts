import { Injectable, computed, signal } from '@angular/core';

/**
 * - sidebar: side menu with text (the classic one).
 * - rail:    side menu with icons only; more room for tables.
 * - topbar:  top navigation with a dropdown menu per section.
 * - tiles:   home screen made of tiles, with no fixed menu.
 */
export type LayoutMode = 'sidebar' | 'rail' | 'topbar' | 'tiles';
export type TextSize = 'normal' | 'large' | 'xlarge';
export type MotionPref = 'system' | 'reduce' | 'full';

export interface Preferences {
  /** Classic side panel, or a home screen with large tiles. */
  layout: LayoutMode;
  textSize: TextSize;
  motion: MotionPref;
  highContrast: boolean;
  underlineLinks: boolean;
  /** Taller buttons, rows and fields: targets that are easier to hit. */
  largeTargets: boolean;
  /** Thick focus ring, always visible when navigating with the keyboard. */
  strongFocus: boolean;
  /** Tiles hidden on the home screen (by their route). */
  hiddenTiles: string[];
}

export const DEFAULT_PREFERENCES: Preferences = {
  layout: 'sidebar',
  textSize: 'normal',
  motion: 'system',
  highContrast: false,
  underlineLinks: false,
  largeTargets: false,
  strongFocus: false,
  hiddenTiles: [],
};

// Same key the index.html script reads before the first paint.
const STORAGE_KEY = 'bipsy_admin_prefs';

/**
 * Interface and accessibility preferences of whoever uses the panel. They belong
 * to this browser (localStorage): each workstation can have its own layout, and
 * a large office screen can use tiles while the laptop uses a list.
 *
 * Everything is applied as data-* attributes on <html>; the styles live in
 * styles.scss. That way a new preference does not touch any component.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly state = signal<Preferences>(this.read());

  readonly prefs = this.state.asReadonly();
  readonly layout = computed(() => this.state().layout);

  constructor() {
    this.apply(this.state());
  }

  set<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    this.update({ [key]: value } as Partial<Preferences>);
  }

  update(changes: Partial<Preferences>) {
    const next = { ...this.state(), ...changes };
    this.state.set(next);
    this.apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // No storage available: it only applies for this visit.
    }
  }

  /** Restores the factory defaults without touching the chosen layout or tiles. */
  resetAccessibility() {
    const { layout, hiddenTiles } = this.state();
    this.update({ ...DEFAULT_PREFERENCES, layout, hiddenTiles });
  }

  toggleTile(path: string) {
    const hidden = this.state().hiddenTiles;
    this.set('hiddenTiles', hidden.includes(path) ? hidden.filter((p) => p !== path) : [...hidden, path]);
  }

  private apply(p: Preferences) {
    const el = document.documentElement;
    el.dataset['layout'] = p.layout;
    el.dataset['text'] = p.textSize;
    el.dataset['motion'] = p.motion;
    toggle(el, 'contrast', p.highContrast ? 'high' : null);
    toggle(el, 'links', p.underlineLinks ? 'underline' : null);
    toggle(el, 'targets', p.largeTargets ? 'large' : null);
    toggle(el, 'focus', p.strongFocus ? 'strong' : null);
  }

  private read(): Preferences {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_PREFERENCES };
      const parsed = { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) };
      // A value stored by an older version (or by hand) must not leave the panel without navigation.
      if (!['sidebar', 'rail', 'topbar', 'tiles'].includes(parsed.layout)) parsed.layout = 'sidebar';
      if (!Array.isArray(parsed.hiddenTiles)) parsed.hiddenTiles = [];
      return parsed;
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }
}

function toggle(el: HTMLElement, key: string, value: string | null) {
  if (value) el.dataset[key] = value;
  else delete el.dataset[key];
}
