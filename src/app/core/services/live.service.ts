import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Áreas que publica GET /admin/live (AdminLiveService en el backend). */
export type LiveArea =
  | 'tickets'
  | 'payments'
  | 'bookings'
  | 'reports'
  | 'reviews'
  | 'actors'
  | 'businesses'
  | 'plans'
  | 'categories'
  | 'discovery'
  | 'audit';

const INTERVAL_MS = 6000;

/**
 * Tiempo real del panel.
 *
 * Pregunta al backend cada pocos segundos por una huella de cada área y, si
 * alguna cambia, sube su versión. Las pantallas se suscriben con `liveReload`
 * y recargan sin parpadeo solo cuando cambia lo que enseñan: lo haga otra
 * persona del equipo, un cliente desde la app o un webhook de Stripe.
 *
 * Con la pestaña en segundo plano no pregunta; al volver, pregunta al momento.
 */
@Injectable({ providedIn: 'root' })
export class LiveService {
  private readonly http = inject(HttpClient);

  private readonly prints = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private inFlight = false;

  /** Versión de cada área: sube cada vez que su huella cambia. */
  readonly versions = signal<Partial<Record<LiveArea, number>>>({});
  /** Última vez que se habló con el backend, y si respondió. */
  readonly lastSync = signal<Date | null>(null);
  readonly connected = signal(true);
  /** Se enciende un momento cuando llega un cambio, para el indicador. */
  readonly flash = signal(false);
  readonly supported = signal(true);

  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible') this.tick();
  };

  start() {
    if (this.running) return;
    this.running = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('focus', this.onVisibility);
    this.tick();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('focus', this.onVisibility);
  }

  /** Pregunta ya, sin esperar al siguiente ciclo (p. ej. tras guardar algo). */
  poke() {
    this.tick();
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    if (this.running && this.supported()) this.timer = setTimeout(() => this.tick(), INTERVAL_MS);
  }

  private tick() {
    if (!this.running || this.inFlight) return;
    if (document.visibilityState === 'hidden') {
      this.schedule();
      return;
    }
    this.inFlight = true;
    this.http.get<Record<string, string>>(`${environment.apiUrl}/admin/live`).subscribe({
      next: (pulse) => {
        this.inFlight = false;
        this.connected.set(true);
        this.lastSync.set(new Date());
        this.apply(pulse);
        this.schedule();
      },
      error: (err) => {
        this.inFlight = false;
        // Backend sin el endpoint: se deja de preguntar y el panel funciona como antes.
        if (err?.status === 404) {
          this.supported.set(false);
          return;
        }
        this.connected.set(false);
        this.schedule();
      },
    });
  }

  private apply(pulse: Record<string, string>) {
    const first = this.prints.size === 0;
    const changed: string[] = [];
    for (const [area, print] of Object.entries(pulse)) {
      if (this.prints.get(area) !== print) {
        if (!first) changed.push(area);
        this.prints.set(area, print);
      }
    }
    if (!changed.length) return;
    this.versions.update((v) => {
      const next = { ...v };
      for (const area of changed) next[area as LiveArea] = (next[area as LiveArea] ?? 0) + 1;
      return next;
    });
    this.flash.set(true);
    setTimeout(() => this.flash.set(false), 1200);
  }
}

/**
 * Recarga en silencio cuando cambia alguna de las áreas. Se llama desde el
 * constructor (contexto de inyección) de la pantalla o el componente.
 */
export function liveReload(areas: LiveArea[], reload: () => void) {
  const live = inject(LiveService);
  const key = computed(() => {
    const v = live.versions();
    return areas.map((a) => v[a] ?? 0).join('.');
  });
  let first = true;
  const ref = effect(() => {
    key();
    if (first) {
      first = false;
      return;
    }
    untracked(reload);
  });
  inject(DestroyRef).onDestroy(() => ref.destroy());
}
