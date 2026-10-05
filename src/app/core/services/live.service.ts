import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Areas published by GET /admin/live (AdminLiveService in the backend). */
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
  | 'maintenance'
  | 'audit';

const INTERVAL_MS = 6000;

/**
 * Real-time updates for the panel.
 *
 * Every few seconds it asks the backend for a fingerprint of each area and, if
 * any changes, bumps its version. Screens subscribe with `liveReload` and
 * reload without flickering only when what they show changes: whether another
 * team member, a client from the app or a Stripe webhook caused it.
 *
 * With the tab in the background it does not poll; on return, it polls right away.
 */
@Injectable({ providedIn: 'root' })
export class LiveService {
  private readonly http = inject(HttpClient);

  private readonly prints = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private inFlight = false;

  /** Version of each area: bumped every time its fingerprint changes. */
  readonly versions = signal<Partial<Record<LiveArea, number>>>({});
  /** Last time the backend was contacted, and whether it responded. */
  readonly lastSync = signal<Date | null>(null);
  readonly connected = signal(true);
  /** Turns on briefly when a change arrives, for the indicator. */
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

  /** Polls now, without waiting for the next cycle (e.g. after saving something). */
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
        // Backend without the endpoint: stop polling and the panel works as before.
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
 * Silently reloads when any of the areas changes. Call it from the constructor
 * (injection context) of the screen or component.
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
