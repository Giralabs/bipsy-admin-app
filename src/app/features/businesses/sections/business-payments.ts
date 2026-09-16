import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Charge, PageResponse } from '../../../core/models/admin.models';
import { AdminApi } from '../../../core/services/admin-api.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { formatCents } from '../../../core/utils/format';
import { chargeKind, chargeStatus } from '../../../core/utils/labels';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { Pill } from '../../../shared/components/pill/pill';
import { liveReload } from '../../../core/services/live.service';

/** Charges the business has made to its clients through Bipsy (card). */
@Component({
  selector: 'app-business-payments',
  imports: [DatePipe, RouterLink, Pagination, Pill],
  template: `
    <div class="cluster bpay-head">
      <a class="btn btn--sm" [routerLink]="['/payments']" [queryParams]="{ businessId: businessId() }">
        <span class="material-symbols-rounded">payments</span>Abrir en Cobros: devolver o cobrar
      </a>
    </div>
    <div class="table-card">
      @if (error(); as e) {
        <div class="empty"><span class="material-symbols-rounded">cloud_off</span><p>{{ e }}</p><button type="button" class="btn" (click)="load()">Reintentar</button></div>
      } @else if (!data()) {
        <div class="empty"><span class="spinner"></span></div>
      } @else if (data()!.totalElements === 0) {
        <div class="empty"><span class="material-symbols-rounded">receipt_long</span><h3>Sin cobros</h3><p>No ha cobrado nada a sus clientes a través de Bipsy.</p></div>
      } @else {
        <div class="table-scroll">
          <table class="table">
            <thead><tr><th>Concepto</th><th class="num">Importe</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>
              @for (ch of data()!.content; track ch.id) {
                <tr class="is-link" [routerLink]="['/payments', ch.id]" tabindex="0">
                  <td>
                    <strong>{{ kind(ch.kind).label }}</strong>
                    @if (ch.description) { <small class="bpay-small">{{ ch.description }}</small> }
                  </td>
                  <td class="num nowrap">
                    {{ cents(ch.amountCents, ch.currency) }}
                    @if (ch.refundedCents > 0) { <small class="bpay-small">−{{ cents(ch.refundedCents, ch.currency) }} devuelto</small> }
                  </td>
                  <td>
                    <app-pill [meta]="status(ch.status)" [icon]="false" />
                    @if (ch.failureReason) { <small class="bpay-small t-danger">{{ ch.failureReason }}</small> }
                  </td>
                  <td class="t-muted nowrap">{{ ch.createdAt | date: 'd MMM y, HH:mm' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [page]="data()!.page" [size]="data()!.size" [total]="data()!.totalElements" [pages]="data()!.totalPages" (pageChange)="goTo($event)" />
      }
    </div>
  `,
  styles: `.bpay-head { margin-bottom: 12px; } .bpay-small { display: block; margin-top: 2px; font-size: 0.75rem; color: var(--clr-text-3); }`,
})
export class BusinessPayments {
  private readonly api = inject(AdminApi);

  readonly businessId = input.required<number>();

  protected readonly data = signal<PageResponse<Charge> | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal(0);
  protected readonly cents = formatCents;
  protected readonly kind = chargeKind;
  protected readonly status = chargeStatus;

  // Real time: reloads quietly when this data changes.
  private readonly live = liveReload(['payments'], () => this.load());

  constructor() {
    effect(() => {
      this.businessId();
      untracked(() => {
        this.page.set(0);
        this.load();
      });
    });
  }

  protected load() {
    this.error.set(null);
    this.api.businessPayments(this.businessId(), this.page()).subscribe({
      next: (r) => this.data.set(r),
      error: (err) => this.error.set(apiErrorMessage(err, 'No se han podido cargar los cobros.')),
    });
  }

  protected goTo(page: number) {
    this.page.set(page);
    this.load();
  }
}
