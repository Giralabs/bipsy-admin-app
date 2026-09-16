import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminInvoice, AdminPayment, AdminPaymentDetail, AdminRefund, PageResponse, PaymentSummary } from '../../core/models/admin.models';
import { AdminApi } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { apiErrorMessage } from '../../core/utils/api-error';
import { formatCents, timeAgo } from '../../core/utils/format';
import { chargeKind, chargeStatus, refundMethod, refundStatus } from '../../core/utils/labels';
import { ChargeDialog } from '../../shared/components/charge-dialog/charge-dialog';
import { Pagination } from '../../shared/components/pagination/pagination';
import { Pill } from '../../shared/components/pill/pill';
import { Select, SelectOption } from '../../shared/components/select/select';
import { TabOption, Tabs } from '../../shared/components/tabs/tabs';
import { listQuery } from '../../shared/utils/list-query';
import { liveReload } from '../../core/services/live.service';

type View = 'charges' | 'refunds' | 'invoices';

/**
 * Ledger of all the money that goes through Bipsy: what customers are
 * charged (cancellation, reschedule and no-show fees, and booking payments),
 * what is refunded to them and what businesses pay for their plan.
 */
@Component({
  selector: 'app-payments',
  imports: [DatePipe, RouterLink, ChargeDialog, Pagination, Pill, Select, Tabs],
  templateUrl: './payments.html',
  styleUrl: './payments.scss',
})
export class Payments {
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  private readonly query = listQuery();

  protected readonly view = signal<View>((this.query.get('view') as View) || 'charges');
  protected readonly summary = signal<PaymentSummary | null>(null);

  // Charge list filters (mirrored in the URL).
  protected readonly q = signal(this.query.get('q'));
  protected readonly kind = signal(this.query.get('kind'));
  protected readonly status = signal(this.query.get('status'));
  protected readonly from = signal(this.query.get('from'));
  protected readonly to = signal(this.query.get('to'));
  protected readonly businessId = signal(this.query.get('businessId'));
  protected readonly customerId = signal(this.query.get('customerId'));
  protected readonly bookingId = signal(this.query.get('bookingId'));
  protected readonly page = signal(this.query.page());

  protected readonly charges = signal<PageResponse<AdminPayment> | null>(null);
  protected readonly refunds = signal<PageResponse<AdminRefund> | null>(null);
  protected readonly invoices = signal<PageResponse<AdminInvoice> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly chargeOpen = signal(false);

  protected readonly cents = formatCents;
  protected readonly ago = timeAgo;
  protected readonly labels = { chargeKind, chargeStatus, refundStatus, refundMethod };

  protected readonly tabs = computed<TabOption<View>[]>(() => [
    { value: 'charges', label: 'Cobros', icon: 'receipt_long', count: this.summary()?.count ?? null },
    { value: 'refunds', label: 'Devoluciones', icon: 'currency_exchange' },
    { value: 'invoices', label: 'Planes de negocios', icon: 'workspace_premium' },
  ]);

  protected readonly kindOptions: SelectOption[] = [
    { value: '', label: 'Todos los conceptos' },
    { value: 'CANCELLATION_FEE', label: 'Cancelación', icon: 'event_busy' },
    { value: 'RESCHEDULE_FEE', label: 'Cambio de hora', icon: 'update' },
    { value: 'NO_SHOW_FEE', label: 'No acudió', icon: 'do_not_disturb_on' },
    { value: 'BOOKING_PAYMENT', label: 'Pago de cita', icon: 'payments' },
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: 'Todos los estados' },
    { value: 'SUCCEEDED', label: 'Cobrado', tone: 'success' },
    { value: 'PARTIALLY_REFUNDED', label: 'Devuelto en parte', tone: 'info' },
    { value: 'REFUNDED', label: 'Devuelto', tone: 'neutral' },
    { value: 'FAILED', label: 'Fallido', tone: 'danger' },
    { value: 'REQUIRES_ACTION', label: 'Requiere acción', tone: 'warn' },
    { value: 'PENDING', label: 'Pendiente', tone: 'warn' },
    { value: 'AUTHORIZED', label: 'Autorizado', tone: 'info' },
  ];

  /** Filters coming from a detail page (business, customer, booking) that have no control of their own. */
  protected readonly scopeChips = computed(() => {
    const chips: { key: 'businessId' | 'customerId' | 'bookingId'; label: string }[] = [];
    const first = this.charges()?.content[0];
    if (this.businessId()) chips.push({ key: 'businessId', label: first?.businessName ?? `Negocio #${this.businessId()}` });
    if (this.customerId()) chips.push({ key: 'customerId', label: first?.customerName ?? `Cliente #${this.customerId()}` });
    if (this.bookingId()) chips.push({ key: 'bookingId', label: `Reserva #${this.bookingId()}` });
    return chips;
  });

  protected readonly hasFilters = computed(
    () => !!(this.q() || this.kind() || this.status() || this.from() || this.to() || this.scopeChips().length),
  );

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // Real time: reloads quietly when this data changes.
  private readonly live = liveReload(['payments'], () => { this.load(); this.loadSummary(); });

  constructor() {
    this.loadSummary();
    this.load();
  }

  protected loadSummary() {
    this.api.paymentsSummary().subscribe({ next: (s) => this.summary.set(s), error: () => {} });
  }

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    const done = () => this.loading.set(false);
    const fail = (err: unknown) => {
      this.loading.set(false);
      this.error.set(apiErrorMessage(err, 'No se han podido cargar los cobros.'));
    };

    this.query.set({
      view: this.view() === 'charges' ? '' : this.view(),
      q: this.q(),
      kind: this.kind(),
      status: this.status(),
      from: this.from(),
      to: this.to(),
      businessId: this.businessId(),
      customerId: this.customerId(),
      bookingId: this.bookingId(),
      page: this.page(),
    });

    switch (this.view()) {
      case 'charges':
        this.api
          .payments({
            q: this.q(),
            kind: this.kind(),
            status: this.status(),
            from: this.from() ? new Date(this.from() + 'T00:00:00').toISOString() : '',
            to: this.to() ? new Date(new Date(this.to() + 'T00:00:00').getTime() + 86400000).toISOString() : '',
            businessId: this.businessId() ? Number(this.businessId()) : null,
            customerId: this.customerId() ? Number(this.customerId()) : null,
            bookingId: this.bookingId() ? Number(this.bookingId()) : null,
            page: this.page(),
          })
          .subscribe({ next: (r) => (this.charges.set(r), done()), error: fail });
        break;
      case 'refunds':
        this.api.paymentRefunds(this.page(), this.businessId() ? Number(this.businessId()) : null).subscribe({
          next: (r) => (this.refunds.set(r), done()),
          error: fail,
        });
        break;
      case 'invoices':
        this.api.subscriptionInvoices(this.page(), this.businessId() ? Number(this.businessId()) : null).subscribe({
          next: (r) => (this.invoices.set(r), done()),
          error: fail,
        });
        break;
    }
  }

  protected setView(v: View) {
    this.view.set(v);
    this.page.set(0);
    this.load();
  }

  protected onSearch(value: string) {
    this.q.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(0);
      this.load();
    }, 300);
  }

  protected setFilter(which: 'kind' | 'status' | 'from' | 'to', value: string) {
    this[which].set(value);
    this.page.set(0);
    this.load();
  }

  /** Summary shortcuts: tapping «Fallidos» filters the failed charges. */
  protected quickStatus(value: string) {
    this.view.set('charges');
    this.status.set(this.status() === value ? '' : value);
    this.page.set(0);
    this.load();
  }

  protected removeScope(key: 'businessId' | 'customerId' | 'bookingId') {
    this[key].set('');
    this.page.set(0);
    this.load();
  }

  protected clearFilters() {
    for (const s of [this.q, this.kind, this.status, this.from, this.to, this.businessId, this.customerId, this.bookingId]) s.set('');
    this.page.set(0);
    this.load();
  }

  protected goTo(page: number) {
    this.page.set(page);
    this.load();
  }

  protected open(p: AdminPayment) {
    this.router.navigate(['/payments', p.id]);
  }

  protected onCharged(detail: AdminPaymentDetail) {
    this.chargeOpen.set(false);
    this.router.navigate(['/payments', detail.payment.id]);
  }
}
