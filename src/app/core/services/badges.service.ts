import { Injectable, inject, signal } from '@angular/core';
import { BadgeKey } from '../navigation';
import { AdminApi } from './admin-api.service';
import { liveReload } from './live.service';

// How often, at most, the counters are fetched again while navigating.
const TTL_MS = 30_000;

/**
 * Counters for pending work (open tickets, requests, reports). They are shown
 * by the side menu and the home tiles; living here avoids fetching them twice
 * and each place showing a different number.
 */
@Injectable({ providedIn: 'root' })
export class BadgesService {
  private readonly api = inject(AdminApi);
  private last = 0;

  readonly counts = signal<Record<BadgeKey, number>>({ tickets: 0, improvements: 0, reports: 0, onboarding: 0 });

  // Real time: a new ticket or report lights up the counter right away.
  private readonly live = liveReload(['tickets', 'reports', 'plans', 'actors'], () => this.refresh(true));

  refresh(force = false) {
    const now = Date.now();
    if (!force && now - this.last < TTL_MS) return;
    this.last = now;

    this.api.tickets({ status: 'OPEN', kind: 'SUPPORT', page: 0, size: 1 }).subscribe({
      next: (r) => this.patch('tickets', r.totalElements),
      error: () => {},
    });
    this.api.tickets({ status: 'OPEN', kind: 'IMPROVEMENT', page: 0, size: 1 }).subscribe({
      next: (r) => this.patch('improvements', r.totalElements),
      error: () => {},
    });
    this.api.reports({ status: 'PENDING', page: 0, size: 1 }).subscribe({
      next: (r) => this.patch('reports', r.totalElements),
      error: () => {},
    });
    this.api.onboarding().subscribe({
      next: (r) => this.patch('onboarding', r.summary.due),
      error: () => {},
    });
  }

  private patch(key: BadgeKey, value: number) {
    this.counts.update((c) => ({ ...c, [key]: value }));
  }
}
