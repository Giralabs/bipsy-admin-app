import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Feature, Grant, Plan, SubscriptionOverview } from '../../core/models/admin.models';
import { AdminApi } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage, isNotFound } from '../../core/utils/api-error';
import { formatEur, timeAgo } from '../../core/utils/format';
import { billingInterval, grantState, subscriptionSource, subscriptionStatus } from '../../core/utils/labels';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';
import { Pill } from '../../shared/components/pill/pill';
import { SegmentOption, Segmented } from '../../shared/components/segmented/segmented';
import { GrantDialog } from './grant-dialog';
import { liveReload } from '../../core/services/live.service';

type GrantFilter = 'LIVE' | 'ALL';
type SubsFilter = 'FREE' | 'PAID' | 'ALL';

// Grants from the panel and the welcome period do not go through any payment gateway.
const FREE_SOURCES = ['ADMIN', 'WELCOME'];

@Component({
  selector: 'app-plans',
  imports: [RouterLink, DatePipe, Pill, Segmented, ConfirmModal, GrantDialog],
  templateUrl: './plans.html',
  styleUrl: './plans.scss',
})
export class Plans {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly plans = signal<Plan[] | null>(null);
  protected readonly plansError = signal<string | null>(null);
  protected readonly features = signal<Feature[]>([]);
  protected readonly grants = signal<Grant[] | null>(null);
  protected readonly grantsUnavailable = signal(false);
  protected readonly filter = signal<GrantFilter>('LIVE');

  protected readonly grantOpen = signal(false);
  protected readonly revokeTarget = signal<Grant | null>(null);
  protected readonly revoking = signal(false);

  protected readonly filterOptions: SegmentOption<GrantFilter>[] = [
    { value: 'LIVE', label: 'En vigor' },
    { value: 'ALL', label: 'Todas' },
  ];
  protected readonly eur = formatEur;
  protected readonly interval = billingInterval;
  protected readonly grantState = grantState;

  // ----- SUBSCRIPTIONS OF ALL BUSINESSES --------------------
  protected readonly subs = signal<SubscriptionOverview[] | null>(null);
  protected readonly subsUnavailable = signal(false);
  protected readonly subsFilter = signal<SubsFilter>('FREE');
  protected readonly subsOptions = computed<SegmentOption<SubsFilter>[]>(() => {
    const list = this.subs() ?? [];
    const live = list.filter((s) => s.grantsAccessNow);
    return [
      { value: 'FREE', label: 'Regaladas', count: live.filter((s) => FREE_SOURCES.includes(s.source)).length },
      { value: 'PAID', label: 'De pago', count: live.filter((s) => !FREE_SOURCES.includes(s.source)).length },
      { value: 'ALL', label: 'Historial', count: list.length },
    ];
  });
  protected readonly visibleSubs = computed(() => {
    const list = this.subs() ?? [];
    switch (this.subsFilter()) {
      case 'FREE':
        return list.filter((s) => s.grantsAccessNow && FREE_SOURCES.includes(s.source));
      case 'PAID':
        return list.filter((s) => s.grantsAccessNow && !FREE_SOURCES.includes(s.source));
      default:
        return list;
    }
  });
  protected readonly labels = { subscriptionSource, subscriptionStatus };
  protected readonly ago = timeAgo;

  protected readonly visibleGrants = computed(() => {
    const list = this.grants() ?? [];
    return this.filter() === 'ALL' ? list : list.filter((g) => grantState(g).label !== 'Revocada' && grantState(g).label !== 'Caducada');
  });

  // Real time: reloads quietly when this data changes.
  private readonly live = liveReload(['plans'], () => { this.loadPlans(); this.loadGrants(); this.loadSubs(); });

  constructor() {
    this.loadPlans();
    this.loadGrants();
    this.loadSubs();
    this.api.features().subscribe({ next: (f) => this.features.set(f), error: () => {} });
  }

  protected loadPlans() {
    this.plansError.set(null);
    this.api.plans().subscribe({
      next: (p) => this.plans.set([...p].sort((a, b) => a.displayOrder - b.displayOrder || a.priceCents - b.priceCents)),
      error: (err) => this.plansError.set(apiErrorMessage(err, 'No se ha podido cargar el catálogo.')),
    });
  }

  protected loadGrants() {
    this.grantsUnavailable.set(false);
    this.api.grants().subscribe({
      next: (g) => this.grants.set(g),
      error: (err) => {
        this.grants.set([]);
        if (isNotFound(err)) this.grantsUnavailable.set(true);
        else this.toast.error(err, 'No se han podido cargar las ofertas.');
      },
    });
  }

  protected loadSubs() {
    this.api.subscriptionsOverview().subscribe({
      next: (s) => this.subs.set(s),
      error: (err) => {
        this.subs.set([]);
        if (isNotFound(err)) this.subsUnavailable.set(true);
      },
    });
  }

  /** Returns "quedan 12 días", "caduca hoy" or an empty string if it never expires. */
  protected remaining(iso: string | null): string {
    if (!iso) return '';
    const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
    if (days <= 0) return 'caducada';
    return days === 1 ? 'queda 1 día' : `quedan ${days} días`;
  }

  protected onCreated() {
    this.grantOpen.set(false);
    this.loadGrants();
  }

  protected revoke() {
    const g = this.revokeTarget();
    if (!g) return;
    this.revoking.set(true);
    this.api.revokeGrant(g.id).subscribe({
      next: () => {
        this.revoking.set(false);
        this.revokeTarget.set(null);
        this.toast.success('Oferta revocada.');
        this.loadGrants();
      },
      error: (err) => {
        this.revoking.set(false);
        this.revokeTarget.set(null);
        this.toast.error(err, 'No se ha podido revocar.');
      },
    });
  }

  protected grantTarget(g: Grant): string {
    return g.targetType === 'PLAN' ? `Plan ${g.planName ?? g.planCode}` : (g.featureName ?? g.featureCode ?? '—');
  }
}
