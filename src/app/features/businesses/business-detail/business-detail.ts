import { DatePipe, LowerCasePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import {
  AuditLogEntry,
  BusinessDetail,
  BusinessSubscription,
  Feature,
  BusinessOverview,
  Grant,
  Plan,
  Ticket,
} from '../../../core/models/admin.models';
import { AdminApi } from '../../../core/services/admin-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { apiErrorMessage, isNotFound } from '../../../core/utils/api-error';
import { timeAgo } from '../../../core/utils/format';
import {
  auditAction,
  businessState,
  grantState,
  subscriptionSource,
  subscriptionStatus,
  ticketPriority,
  ticketStatus,
} from '../../../core/utils/labels';
import { Avatar } from '../../../shared/components/avatar/avatar';
import { ConfirmModal } from '../../../shared/components/confirm-modal/confirm-modal';
import { Pill } from '../../../shared/components/pill/pill';
import { BookingsTable } from '../../../shared/components/bookings-table/bookings-table';
import { NotifyDialog } from '../../../shared/components/notify-dialog/notify-dialog';
import { ReviewsList } from '../../../shared/components/reviews-list/reviews-list';
import { TabOption, Tabs } from '../../../shared/components/tabs/tabs';
import { copyText } from '../../../shared/utils/download';
import { GrantDialog } from '../../plans/grant-dialog';
import { PlanAccess } from '../plan-access/plan-access';
import { BusinessClients } from '../sections/business-clients';
import { BusinessPayments } from '../sections/business-payments';
import { BusinessPhotos } from '../sections/business-photos';
import { BusinessServices } from '../sections/business-services';
import { BusinessTeam } from '../sections/business-team';
import { liveReload } from '../../../core/services/live.service';

type Tab = 'profile' | 'subscriptions' | 'clients' | 'bookings' | 'team' | 'services' | 'reviews' | 'photos' | 'payments' | 'grants' | 'support' | 'history';

/** Same slug as bipsy-web-app (shared/slug.ts): the trailing id is what gets parsed. */
function businessSlug(id: number, name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug ? `${slug}-${id}` : String(id);
}

@Component({
  selector: 'app-business-detail',
  imports: [
    RouterLink, DatePipe, LowerCasePipe, Avatar, Pill, Tabs, ConfirmModal, GrantDialog, PlanAccess, NotifyDialog,
    BookingsTable, ReviewsList, BusinessClients, BusinessTeam, BusinessServices, BusinessPhotos, BusinessPayments,
  ],
  templateUrl: './business-detail.html',
  styleUrl: './business-detail.scss',
})
export class BusinessDetailPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  readonly id = input.required<string>();
  private businessId = 0;

  protected readonly business = signal<BusinessDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tab = signal<Tab>('profile');

  protected readonly subscriptions = signal<BusinessSubscription[] | null>(null);
  protected readonly plans = signal<Plan[]>([]);
  protected readonly grants = signal<Grant[] | null>(null);
  protected readonly grantsUnavailable = signal(false);
  protected readonly features = signal<Feature[]>([]);
  protected readonly tickets = signal<Ticket[] | null>(null);
  protected readonly ticketsTotal = signal(0);
  protected readonly history = signal<AuditLogEntry[] | null>(null);
  protected readonly historyUnavailable = signal(false);

  protected readonly confirmBan = signal(false);
  protected readonly banning = signal(false);

  protected readonly grantOpen = signal(false);
  protected readonly revokeTarget = signal<Grant | null>(null);
  protected readonly revoking = signal(false);

  protected readonly state = businessState;
  protected readonly grantState = grantState;
  protected readonly labels = { subscriptionStatus, subscriptionSource, ticketStatus, ticketPriority, auditAction };
  protected readonly ago = timeAgo;

  protected readonly overview = signal<BusinessOverview | null>(null);
  protected readonly notifyOpen = signal(false);

  protected readonly tabs = computed<TabOption<Tab>[]>(() => {
    const o = this.overview();
    return [
      { value: 'profile', label: 'Ficha', icon: 'badge' },
      { value: 'subscriptions', label: 'Plan y acceso', icon: 'workspace_premium' },
      { value: 'clients', label: 'Clientes', icon: 'contacts', count: o?.customers ?? null },
      { value: 'bookings', label: 'Citas', icon: 'event', count: o?.bookings ?? null },
      { value: 'team', label: 'Equipo', icon: 'groups', count: o?.workers ?? null },
      { value: 'services', label: 'Servicios', icon: 'content_cut', count: o?.services ?? null },
      { value: 'reviews', label: 'Reseñas', icon: 'reviews', count: o?.reviewCount ?? null },
      { value: 'photos', label: 'Fotos', icon: 'photo_library', count: o?.portfolioImages ?? null },
      { value: 'payments', label: 'Cobros', icon: 'receipt_long' },
      { value: 'grants', label: 'Ofertas', icon: 'redeem' },
      { value: 'support', label: 'Soporte', icon: 'support_agent', count: this.tickets() ? this.ticketsTotal() : null },
      { value: 'history', label: 'Historial', icon: 'history' },
    ];
  });

  /** The subscription granting access now (active and not expired), for the header pill. */
  protected readonly activeSubscription = computed(() => {
    const now = Date.now();
    return (
      this.subscriptions()?.find(
        (s) => s.status === 'ACTIVE' && (!s.currentPeriodEnd || new Date(s.currentPeriodEnd).getTime() > now),
      ) ?? null
    );
  });

  protected readonly publicUrl = computed(() => {
    const b = this.business();
    return b ? `${environment.webUrl}/business/${businessSlug(b.id, b.name)}` : '';
  });

  // Real time: reloads quietly when this data changes.
  private readonly live = liveReload(['actors', 'businesses', 'plans', 'tickets', 'reviews'], () => { this.load(); this.loadSubscriptions(); this.loadTickets(); if (this.grants() !== null) this.loadGrants(); });

  constructor() {
    this.api.plans().subscribe({ next: (p) => this.plans.set(p), error: () => {} });

    // Reacts to :id: jumping from one business to another reuses the component.
    effect(() => {
      const id = Number(this.id());
      untracked(() => {
        this.businessId = id;
        this.business.set(null);
        this.subscriptions.set(null);
        this.grants.set(null);
        this.tickets.set(null);
        this.history.set(null);
        this.overview.set(null);
        this.tab.set('profile');
        this.load();
        this.api.businessOverview(id).subscribe({ next: (o) => this.overview.set(o), error: () => {} });
        this.loadSubscriptions();
        this.loadTickets();
      });
    });
  }

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.business(this.businessId).subscribe({
      next: (b) => {
        this.business.set(b);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'No se ha podido cargar el negocio.'));
      },
    });
  }

  protected setTab(tab: Tab) {
    this.tab.set(tab);
    if (tab === 'grants' && this.grants() === null) this.loadGrants();
    if (tab === 'history' && this.history() === null) this.loadHistory();
  }

  protected async copy(text: string | null, what: string) {
    if (text && (await copyText(text))) this.toast.info(`${what} copiado.`);
  }

  // ----- BAN --------------------

  protected toggleBan() {
    const b = this.business();
    if (!b) return;
    this.banning.set(true);
    const call = b.banned ? this.api.unbanBusiness(this.businessId) : this.api.banBusiness(this.businessId);
    call.subscribe({
      next: () => {
        this.banning.set(false);
        this.confirmBan.set(false);
        this.toast.success(b.banned ? 'Baneo retirado. El negocio ya puede entrar.' : 'Negocio baneado.');
        this.history.set(null);
        this.load();
      },
      error: (err) => {
        this.banning.set(false);
        this.confirmBan.set(false);
        this.toast.error(err, 'No se ha podido cambiar el baneo.');
      },
    });
  }

  // ----- SUBSCRIPTIONS --------------------

  protected loadSubscriptions() {
    this.api.businessSubscriptions(this.businessId).subscribe({
      next: (s) => this.subscriptions.set(s),
      error: () => this.subscriptions.set([]),
    });
  }

  /** Plan and access changed something: history, header and audit get refreshed. */
  protected onAccessChanged() {
    this.history.set(null);
    this.loadSubscriptions();
  }

  // ----- OFFERS --------------------

  protected loadGrants() {
    this.grantsUnavailable.set(false);
    this.api.grants(this.businessId).subscribe({
      next: (g) => this.grants.set(g),
      error: (err) => {
        this.grants.set([]);
        if (isNotFound(err)) this.grantsUnavailable.set(true);
      },
    });
    if (!this.features().length) {
      this.api.features().subscribe({ next: (f) => this.features.set(f), error: () => {} });
    }
  }

  protected onGrantCreated() {
    this.grantOpen.set(false);
    this.history.set(null);
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

  // ----- SUPPORT AND HISTORY --------------------

  private loadTickets() {
    this.api.tickets({ businessId: this.businessId, page: 0, size: 8 }).subscribe({
      next: (r) => {
        this.tickets.set(r.content);
        this.ticketsTotal.set(r.totalElements);
      },
      error: () => this.tickets.set([]),
    });
  }

  private loadHistory() {
    this.historyUnavailable.set(false);
    this.api.auditLogFor('BUSINESS', this.businessId).subscribe({
      next: (r) => this.history.set(r.content),
      error: (err) => {
        this.history.set([]);
        if (isNotFound(err)) this.historyUnavailable.set(true);
      },
    });
  }
}
