import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReferralStat } from '../../core/models/admin.models';
import { AdminApi } from '../../core/services/admin-api.service';
import { apiErrorMessage } from '../../core/utils/api-error';
import { formatInt } from '../../core/utils/format';
import { Avatar } from '../../shared/components/avatar/avatar';
import { liveReload } from '../../core/services/live.service';

@Component({
  selector: 'app-referrals',
  imports: [RouterLink, Avatar],
  templateUrl: './referrals.html',
  styles: `
    .ref-rank { width: 28px; color: var(--clr-text-3); font-variant-numeric: tabular-nums; font-weight: 700; }
    .ref-rank--top { color: var(--clr-accent-text); }
    .ref-bar { display: flex; align-items: center; gap: 12px; min-width: 180px; }
    .ref-bar .bar__track { flex: 1; }
    .ref-bar strong { width: 40px; text-align: right; font-variant-numeric: tabular-nums; }
    .ref-name { color: var(--clr-text); font-weight: 600; text-decoration: none; }
    .ref-name:hover { color: var(--clr-accent-text); text-decoration: underline; }
  `,
})
export class Referrals {
  private readonly api = inject(AdminApi);

  protected readonly stats = signal<ReferralStat[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly int = formatInt;

  protected readonly sorted = computed(() =>
    [...(this.stats() ?? [])].sort((a, b) => b.referredCount - a.referredCount || a.businessName.localeCompare(b.businessName, 'es')),
  );
  protected readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.sorted()
      .map((s, i) => ({ ...s, rank: i + 1 }))
      .filter((s) => !term || s.businessName.toLowerCase().includes(term) || (s.referralCode ?? '').toLowerCase().includes(term));
  });
  protected readonly max = computed(() => Math.max(1, ...this.sorted().map((s) => s.referredCount)));
  protected readonly total = computed(() => this.sorted().reduce((sum, s) => sum + s.referredCount, 0));
  protected readonly withCode = computed(() => this.sorted().filter((s) => !!s.referralCode).length);
  protected readonly bringing = computed(() => this.sorted().filter((s) => s.referredCount > 0).length);

  /** Tiempo real: recarga en silencio cuando cambian estos datos. */
  private readonly live = liveReload(['actors'], () => this.load());

  constructor() {
    this.load();
  }

  protected load() {
    this.error.set(null);
    this.api.referrals().subscribe({
      next: (s) => this.stats.set(s),
      error: (err) => this.error.set(apiErrorMessage(err, 'No se han podido cargar los referidos.')),
    });
  }
}
