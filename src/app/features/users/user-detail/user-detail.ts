import { DatePipe, LowerCasePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuditLogEntry, CustomerDetail, Sanction, SanctionType } from '../../../core/models/admin.models';
import { AdminApi } from '../../../core/services/admin-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { apiErrorMessage, isNotFound } from '../../../core/utils/api-error';
import { formatCents, formatInt, timeAgo } from '../../../core/utils/format';
import { Meta, auditAction, authProvider, chargeKind, chargeStatus, reputation } from '../../../core/utils/labels';
import { Avatar } from '../../../shared/components/avatar/avatar';
import { ConfirmModal } from '../../../shared/components/confirm-modal/confirm-modal';
import { Pill } from '../../../shared/components/pill/pill';
import { BookingsTable } from '../../../shared/components/bookings-table/bookings-table';
import { NotifyDialog } from '../../../shared/components/notify-dialog/notify-dialog';
import { ReviewsList } from '../../../shared/components/reviews-list/reviews-list';
import { SegmentOption, Segmented } from '../../../shared/components/segmented/segmented';
import { TabOption, Tabs } from '../../../shared/components/tabs/tabs';
import { copyText } from '../../../shared/utils/download';
import { liveReload } from '../../../core/services/live.service';

type Tab = 'summary' | 'bookings' | 'businesses' | 'reviews' | 'sanctions' | 'payments' | 'history';

const DURATIONS = [
  { days: 1, label: '1 día' },
  { days: 7, label: '7 días' },
  { days: 15, label: '15 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
];

const IP_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i;

@Component({
  selector: 'app-user-detail',
  imports: [RouterLink, DatePipe, LowerCasePipe, Avatar, Pill, Segmented, Tabs, ConfirmModal, BookingsTable, ReviewsList, NotifyDialog],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.scss',
})
export class UserDetail {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  readonly id = input.required<string>();
  private customerId = 0;

  protected readonly customer = signal<CustomerDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tab = signal<Tab>('summary');

  protected readonly history = signal<AuditLogEntry[] | null>(null);
  protected readonly historyUnavailable = signal(false);

  // Reset
  protected readonly confirmReset = signal(false);
  protected readonly resetting = signal(false);

  // Sanction
  protected readonly sanctionOpen = signal(false);
  protected readonly sanctionType = signal<SanctionType>('SUSPENSION');
  protected readonly sanctionDays = signal<number | 'custom'>(7);
  protected readonly sanctionUntil = signal('');
  protected readonly sanctionReason = signal('');
  protected readonly sanctionIps = signal('');
  protected readonly sanctioning = signal(false);

  // Lift sanction
  protected readonly liftTarget = signal<Sanction | null>(null);
  protected readonly lifting = signal(false);

  protected readonly durations = DURATIONS;
  protected readonly sanctionTypeOptions: SegmentOption<SanctionType>[] = [
    { value: 'SUSPENSION', label: 'Suspensión temporal' },
    { value: 'BAN', label: 'Baneo permanente' },
  ];
  protected readonly labels = { reputation, authProvider, chargeKind, chargeStatus, auditAction };
  protected readonly cents = formatCents;
  protected readonly int = formatInt;
  protected readonly ago = timeAgo;

  protected readonly notifyOpen = signal(false);

  protected readonly tabs = computed<TabOption<Tab>[]>(() => {
    const c = this.customer();
    return [
      { value: 'summary', label: 'Resumen', icon: 'person' },
      { value: 'bookings', label: 'Citas', icon: 'event', count: c?.totalBookings ?? null },
      { value: 'businesses', label: 'Negocios', icon: 'storefront', count: c?.interactions.length ?? null },
      { value: 'reviews', label: 'Reseñas', icon: 'reviews' },
      { value: 'sanctions', label: 'Sanciones', icon: 'gavel', count: c?.sanctions.length ?? null },
      { value: 'payments', label: 'Pagos', icon: 'credit_card', count: c?.charges.length ?? null },
      { value: 'history', label: 'Historial', icon: 'history' },
    ];
  });

  protected readonly activeSanction = computed(() => this.customer()?.sanctions.find((s) => s.active && !s.liftedAt) ?? null);

  protected readonly accountState = computed<Meta>(() => {
    const c = this.customer();
    const s = this.activeSanction();
    if (!c) return { label: '—', tone: 'neutral' };
    if (c.deleted) return { label: 'Cuenta eliminada', tone: 'neutral', icon: 'person_off' };
    if (s?.type === 'BAN' || c.banned) return { label: 'Baneado', tone: 'danger', icon: 'block' };
    if (s) return { label: 'Suspendido', tone: 'warn', icon: 'timer' };
    return { label: 'Activo', tone: 'success', icon: 'check_circle' };
  });

  /** What was actually charged: successful charges minus refunds. */
  protected readonly chargedCents = computed(() =>
    (this.customer()?.charges ?? [])
      .filter((ch) => ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(ch.status))
      .reduce((sum, ch) => sum + ch.amountCents - (ch.refundedCents ?? 0), 0),
  );

  protected readonly sanctionValid = computed(() => {
    if (this.sanctionType() === 'BAN') return true;
    if (this.sanctionDays() !== 'custom') return true;
    const until = new Date(this.sanctionUntil());
    return !Number.isNaN(until.getTime()) && until.getTime() > Date.now();
  });

  // Real time: reloads quietly when this data changes.
  private readonly live = liveReload(['actors', 'bookings', 'payments', 'reviews', 'reports'], () => this.load());

  constructor() {
    // Reacts to :id and not only on creation: jumping from one client to another
    // (Ctrl K) reuses this same component.
    effect(() => {
      const id = Number(this.id());
      untracked(() => {
        this.customerId = id;
        this.customer.set(null);
        this.history.set(null);
        this.tab.set('summary');
        this.load();
      });
    });
  }

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.customer(this.customerId).subscribe({
      next: (c) => {
        this.customer.set(c);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'No se ha podido cargar el cliente.'));
      },
    });
  }

  protected setTab(tab: Tab) {
    this.tab.set(tab);
    if (tab === 'history' && this.history() === null) this.loadHistory();
  }

  protected async copy(text: string, what: string) {
    if (await copyText(text)) this.toast.info(`${what} copiado.`);
  }

  // ----- RESET --------------------

  protected reset() {
    this.resetting.set(true);
    this.api.resetCustomer(this.customerId).subscribe({
      next: () => {
        this.resetting.set(false);
        this.confirmReset.set(false);
        this.toast.success('Cuenta restablecida.');
        this.load();
        this.history.set(null);
      },
      error: (err) => {
        this.resetting.set(false);
        this.confirmReset.set(false);
        this.toast.error(err, 'No se ha podido restablecer la cuenta.');
      },
    });
  }

  // ----- SANCTIONS --------------------

  protected openSanction() {
    this.sanctionType.set('SUSPENSION');
    this.sanctionDays.set(7);
    this.sanctionUntil.set('');
    this.sanctionReason.set('');
    this.sanctionIps.set('');
    this.sanctionOpen.set(true);
  }

  protected submitSanction() {
    if (!this.sanctionValid() || this.sanctioning()) return;

    const ips = this.sanctionIps()
      .split(/[\s,;]+/)
      .map((ip) => ip.trim())
      .filter(Boolean);
    const invalid = ips.find((ip) => !IP_PATTERN.test(ip));
    if (invalid) {
      this.toast.error(`«${invalid}» no parece una IP válida.`);
      return;
    }

    let endsAt: string | null = null;
    if (this.sanctionType() === 'SUSPENSION') {
      const days = this.sanctionDays();
      if (days === 'custom') {
        endsAt = new Date(this.sanctionUntil()).toISOString();
      } else {
        const d = new Date();
        d.setDate(d.getDate() + days);
        endsAt = d.toISOString();
      }
    }

    this.sanctioning.set(true);
    this.api
      .sanctionCustomer(this.customerId, {
        type: this.sanctionType(),
        reason: this.sanctionReason().trim() || null,
        endsAt,
        extraIps: ips.length ? ips : null,
      })
      .subscribe({
        next: () => {
          this.sanctioning.set(false);
          this.sanctionOpen.set(false);
          this.toast.success(this.sanctionType() === 'BAN' ? 'Cliente baneado.' : 'Cliente suspendido.');
          this.tab.set('sanctions');
          this.history.set(null);
          this.load();
        },
        error: (err) => {
          this.sanctioning.set(false);
          this.toast.error(err, 'No se ha podido aplicar la sanción.');
        },
      });
  }

  protected lift() {
    const s = this.liftTarget();
    if (!s) return;
    this.lifting.set(true);
    this.api.liftSanction(this.customerId, s.id).subscribe({
      next: () => {
        this.lifting.set(false);
        this.liftTarget.set(null);
        this.toast.success('Sanción levantada.');
        this.history.set(null);
        this.load();
      },
      error: (err) => {
        this.lifting.set(false);
        this.liftTarget.set(null);
        this.toast.error(err, 'No se ha podido levantar la sanción.');
      },
    });
  }

  protected sanctionState(s: Sanction): Meta {
    if (s.liftedAt) return { label: 'Levantada', tone: 'neutral' };
    if (s.active) return { label: 'En vigor', tone: s.type === 'BAN' ? 'danger' : 'warn' };
    return { label: 'Cumplida', tone: 'neutral' };
  }

  // ----- HISTORY --------------------

  private loadHistory() {
    this.historyUnavailable.set(false);
    this.api.auditLogFor('CUSTOMER', this.customerId).subscribe({
      next: (r) => this.history.set(r.content),
      error: (err) => {
        this.history.set([]);
        if (isNotFound(err)) this.historyUnavailable.set(true);
      },
    });
  }
}
