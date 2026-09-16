import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminPaymentDetail, Booking, PageResponse } from '../../../core/models/admin.models';
import { AdminApi } from '../../../core/services/admin-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { formatCents } from '../../../core/utils/format';
import { bookingState } from '../../../core/utils/labels';
import { ChargeDialog } from '../charge-dialog/charge-dialog';
import { ConfirmModal } from '../confirm-modal/confirm-modal';
import { Pagination } from '../pagination/pagination';
import { Pill } from '../pill/pill';
import { liveReload } from '../../../core/services/live.service';

/**
 * Citas de un negocio o de un cliente. Desde aquí se puede cancelar una cita
 * pendiente o confirmada: avisa a las dos partes y suelta la retención de la
 * tarjeta, pero no cobra penalizaciones ni devuelve lo prepagado.
 */
@Component({
  selector: 'app-bookings-table',
  imports: [DatePipe, RouterLink, Pagination, Pill, ConfirmModal, ChargeDialog],
  template: `
    <div class="table-card" [class.is-loading]="loading() && !!data()">
      @if (error(); as e) {
        <div class="empty"><span class="material-symbols-rounded">cloud_off</span><p>{{ e }}</p><button type="button" class="btn" (click)="load()">Reintentar</button></div>
      } @else if (!data()) {
        <div class="empty"><span class="spinner"></span></div>
      } @else if (data()!.totalElements === 0) {
        <div class="empty"><span class="material-symbols-rounded">event_busy</span><h3>Sin citas</h3><p>{{ businessId() ? 'Este negocio aún no tiene reservas.' : 'Este cliente aún no ha reservado.' }}</p></div>
      } @else {
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>{{ businessId() ? 'Cliente' : 'Negocio' }}</th>
                <th>Servicio</th>
                <th>Profesional</th>
                <th>Estado</th>
                <th class="num">Importe</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (b of data()!.content; track b.id) {
                <tr>
                  <td class="nowrap">
                    <strong>{{ b.startDateTime | date: 'd MMM y' }}</strong>
                    <small class="bt-small">{{ b.startDateTime | date: 'HH:mm' }}–{{ b.endDateTime | date: 'HH:mm' }}</small>
                  </td>
                  <td>
                    @if (businessId()) {
                      <a class="bt-link" [routerLink]="['/users', b.customerId]">{{ b.customerName }}</a>
                    } @else {
                      <a class="bt-link" [routerLink]="['/businesses', b.businessId]">{{ b.businessName }}</a>
                    }
                  </td>
                  <td>
                    {{ b.serviceName }}
                    @if (b.notes) { <small class="bt-small" [title]="b.notes">«{{ b.notes }}»</small> }
                  </td>
                  <td class="t-muted">{{ b.workerName || '—' }}</td>
                  <td>
                    <app-pill [meta]="state(b.status)" [icon]="false" />
                    @if (b.cancelReason) { <small class="bt-small" [title]="b.cancelReason">{{ b.cancelReason }}</small> }
                  </td>
                  <td class="num nowrap">{{ b.priceCents != null ? cents(b.priceCents) : '—' }}</td>
                  <td class="num nowrap">
                    <a class="btn btn--sm btn--ghost btn--icon" [routerLink]="['/payments']" [queryParams]="{ bookingId: b.id }" title="Cobros de esta cita" aria-label="Cobros de esta cita">
                      <span class="material-symbols-rounded">receipt_long</span>
                    </a>
                    @if (auth.canManage()) {
                      <button type="button" class="btn btn--sm btn--ghost btn--icon" (click)="chargeTarget.set(b)" title="Cobrar una tarifa de esta cita" aria-label="Cobrar una tarifa de esta cita">
                        <span class="material-symbols-rounded">add_card</span>
                      </button>
                    }
                    @if (auth.canManage() && (b.status === 'PENDING' || b.status === 'CONFIRMED') && isFuture(b)) {
                      <button type="button" class="btn btn--sm" (click)="cancelTarget.set(b)">Cancelar</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [page]="data()!.page" [size]="data()!.size" [total]="data()!.totalElements" [pages]="data()!.totalPages" (pageChange)="goTo($event)" />
      }
    </div>

    <app-confirm-modal
      [open]="!!cancelTarget()"
      [busy]="cancelling()"
      title="¿Cancelar esta cita?"
      [message]="cancelMessage()"
      confirmLabel="Cancelar cita"
      reasonLabel="Motivo (lo verán las dos partes)"
      reasonPlaceholder="Ej.: el negocio ha cerrado temporalmente"
      (confirmed)="cancel($event)"
      (cancelled)="cancelTarget.set(null)"
    />

    <app-charge-dialog
      [open]="!!chargeTarget()"
      [bookingId]="chargeTarget()?.id ?? null"
      [bookingLabel]="chargeTarget() ? 'Cita #' + chargeTarget()!.id + ' · ' + chargeTarget()!.serviceName + ' de ' + chargeTarget()!.customerName + ' en ' + chargeTarget()!.businessName : null"
      (closed)="chargeTarget.set(null)"
      (charged)="onCharged($event)"
    />
  `,
  styles: `
    .bt-small { display: block; margin-top: 2px; font-size: 0.75rem; color: var(--clr-text-3); max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bt-link { color: var(--clr-text); font-weight: 600; text-decoration: none; }
    .bt-link:hover { color: var(--clr-accent-text); text-decoration: underline; }
  `,
})
export class BookingsTable {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  readonly businessId = input<number | null>(null);
  readonly customerId = input<number | null>(null);

  protected readonly data = signal<PageResponse<Booking> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal(0);
  protected readonly cancelTarget = signal<Booking | null>(null);
  protected readonly cancelling = signal(false);
  protected readonly chargeTarget = signal<Booking | null>(null);
  private readonly router = inject(Router);

  protected readonly state = bookingState;
  protected readonly cents = formatCents;

  protected readonly cancelMessage = computed(() => {
    const b = this.cancelTarget();
    if (!b) return '';
    return `${b.serviceName} de ${b.customerName} en ${b.businessName}. Se avisa a los dos y se libera la tarjeta, pero no se cobran penalizaciones ni se devuelve lo prepagado: eso se hace desde Cobros.`;
  });

  /** Tiempo real: recarga en silencio cuando cambian estos datos. */
  private readonly live = liveReload(['bookings', 'payments'], () => this.load());

  constructor() {
    effect(() => {
      this.businessId();
      this.customerId();
      untracked(() => {
        this.page.set(0);
        this.load();
      });
    });
  }

  protected load() {
    const businessId = this.businessId();
    const customerId = this.customerId();
    if (!businessId && !customerId) return;
    this.loading.set(true);
    this.error.set(null);
    const call = businessId ? this.api.businessBookings(businessId, this.page()) : this.api.customerBookings(customerId!, this.page());
    call.subscribe({
      next: (r) => {
        this.data.set(r);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'No se han podido cargar las citas.'));
      },
    });
  }

  protected goTo(page: number) {
    this.page.set(page);
    this.load();
  }

  protected isFuture(b: Booking): boolean {
    return new Date(b.endDateTime).getTime() > Date.now();
  }

  protected onCharged(detail: AdminPaymentDetail) {
    this.chargeTarget.set(null);
    this.router.navigate(['/payments', detail.payment.id]);
  }

  protected cancel(reason: string) {
    const b = this.cancelTarget();
    if (!b) return;
    this.cancelling.set(true);
    this.api.cancelBooking(b.id, reason || null).subscribe({
      next: () => {
        this.cancelling.set(false);
        this.cancelTarget.set(null);
        this.toast.success('Cita cancelada. Se ha avisado al cliente y al negocio.');
        this.load();
      },
      error: (err) => {
        this.cancelling.set(false);
        this.cancelTarget.set(null);
        this.toast.error(err, 'No se ha podido cancelar la cita.');
      },
    });
  }
}
