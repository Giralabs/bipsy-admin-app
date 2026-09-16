import { Injectable, computed, signal } from '@angular/core';

/**
 * - sidebar: menú lateral con texto (el de siempre).
 * - rail:    menú lateral solo con iconos; más sitio para tablas.
 * - topbar:  navegación arriba con menús desplegables por sección.
 * - tiles:   pantalla de inicio en bloques, sin menú fijo.
 */
export type LayoutMode = 'sidebar' | 'rail' | 'topbar' | 'tiles';
export type TextSize = 'normal' | 'large' | 'xlarge';
export type MotionPref = 'system' | 'reduce' | 'full';

export interface Preferences {
  /** Panel lateral de siempre, o pantalla de inicio con bloques grandes. */
  layout: LayoutMode;
  textSize: TextSize;
  motion: MotionPref;
  highContrast: boolean;
  underlineLinks: boolean;
  /** Botones, filas y campos más altos: dianas más fáciles de acertar. */
  largeTargets: boolean;
  /** Anillo de foco grueso y siempre visible al navegar con teclado. */
  strongFocus: boolean;
  /** Bloques ocultos en la pantalla de inicio (por su ruta). */
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

/** Misma clave que lee el script de index.html antes del primer pintado. */
const STORAGE_KEY = 'bipsy_admin_prefs';

/**
 * Preferencias de interfaz y accesibilidad de quien usa el panel. Son de este
 * navegador (localStorage): cada puesto puede tener su diseño, y una pantalla
 * grande de la oficina puede ir en bloques mientras el portátil va en lista.
 *
 * Todo se aplica como atributos data-* en <html>; los estilos viven en
 * styles.scss. Así una preferencia nueva no toca ningún componente.
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
      /* sin almacenamiento: se aplica solo en esta visita */
    }
  }

  /** Vuelve a lo de fábrica sin tocar el diseño ni los bloques elegidos. */
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
      // Un valor guardado por una versión anterior (o a mano) no puede dejar el panel sin navegación.
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
