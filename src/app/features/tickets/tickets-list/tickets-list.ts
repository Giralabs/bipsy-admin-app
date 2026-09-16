import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PageResponse, Ticket, TicketKind, TicketStatus } from '../../../core/models/admin.models';
import { AdminApi } from '../../../core/services/admin-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { formatInt, timeAgo } from '../../../core/utils/format';
import { ticketKind, ticketPriority, ticketStatus } from '../../../core/utils/labels';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { Pill } from '../../../shared/components/pill/pill';
import { SegmentOption, Segmented } from '../../../shared/components/segmented/segmented';
import { downloadCsv } from '../../../shared/utils/download';
import { listQuery } from '../../../shared/utils/list-query';
import { liveReload } from '../../../core/services/live.service';

type StatusFilter = TicketStatus | 'ALL';

@Component({
  selector: 'app-tickets-list',
  imports: [Pagination, Pill, Segmented, RouterLink],
  templateUrl: './tickets-list.html',
  styles: `
    .ticket-subject { display: flex; flex-direction: column; min-width: 0; max-width: 420px; }
    .ticket-subject strong { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ticket-subject small { font-size: 0.75rem; color: var(--clr-text-2); display: flex; gap: 8px; align-items: center; }
    .ticket-subject small .material-symbols-rounded { font-size: 14px; }
    .ticket-id { color: var(--clr-text-3); font-variant-numeric: tabular-nums; font-size: 0.8125rem; }
    .filter-chip { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 8px 0 14px;
      border-radius: 999px; background: var(--clr-surface); font-size: 0.8125rem; font-weight: 600; }
    .filter-chip button { border: none; background: none; color: var(--clr-text-3); cursor: pointer; display: grid; place-items: center; }
    .filter-chip button:hover { color: var(--clr-text); }
    .filter-chip .material-symbols-rounded { font-size: 18px; }
  `,
})
export class TicketsList implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly query = listQuery();

  protected readonly data = signal<PageResponse<Ticket> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly exporting = signal(false);

  protected readonly status = signal<StatusFilter>((this.query.get('status') as TicketStatus) || 'ALL');
  protected readonly businessId = signal<number | null>(Number(this.query.get('businessId')) || null);
  protected readonly page = signal(this.query.page());

  protected readonly statusOptions: SegmentOption<StatusFilter>[] = [
    { value: 'ALL', label: 'Todos' },
    { value: 'OPEN', label: 'Abiertos' },
    { value: 'IN_PROGRESS', label: 'En curso' },
    { value: 'RESOLVED', label: 'Resueltos' },
    { value: 'CLOSED', label: 'Cerrados' },
  ];
  protected readonly labels = { ticketKind, ticketPriority, ticketStatus };
  protected readonly ago = timeAgo;
  protected readonly int = formatInt;

  /**
   * SUPPORT on /tickets and IMPROVEMENT on /improvements (route data). It is
   * the same inbox: statuses, replies and attachments work the same way.
   */
  readonly kind = input<TicketKind>('SUPPORT');
  protected readonly isImprovement = computed(() => this.kind() === 'IMPROVEMENT');

  // Load in ngOnInit rather than the constructor, because the route `kind` has not arrived there yet.
  ngOnInit() {
    this.load();
  }

  // Real time: reloads quietly when this data changes.
  private readonly live = liveReload(['tickets'], () => this.load());

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    this.query.set({ status: this.statusValue(), businessId: this.businessId(), page: this.page() });

    this.api.tickets({ status: this.statusValue(), kind: this.kind(), businessId: this.businessId(), page: this.page() }).subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'No se han podido cargar los tickets.'));
      },
    });
  }

  protected setStatus(value: StatusFilter) {
    this.status.set(value);
    this.page.set(0);
    this.load();
  }

  protected clearBusiness() {
    this.businessId.set(null);
    this.page.set(0);
    this.load();
  }

  protected goTo(page: number) {
    this.page.set(page);
    this.load();
  }

  protected open(t: Ticket) {
    this.router.navigate(['/tickets', t.id]);
  }

  protected subject(t: Ticket): string {
    if (t.subject) return t.subject;
    return t.description.length > 80 ? t.description.slice(0, 80) + '…' : t.description;
  }

  protected export() {
    this.exporting.set(true);
    const url = this.api.ticketsExportUrl({ status: this.statusValue(), businessId: this.businessId() });
    downloadCsv(this.http, url, 'tickets.csv').subscribe({
      next: () => this.exporting.set(false),
      error: (err) => {
        this.exporting.set(false);
        this.toast.error(err, 'No se ha podido exportar.');
      },
    });
  }

  private statusValue(): TicketStatus | '' {
    return this.status() === 'ALL' ? '' : (this.status() as TicketStatus);
  }
}
