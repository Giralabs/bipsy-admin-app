import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CustomerListItem, PageResponse, Reputation } from '../../../core/models/admin.models';
import { AdminApi } from '../../../core/services/admin-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { formatInt } from '../../../core/utils/format';
import { reputation } from '../../../core/utils/labels';
import { Avatar } from '../../../shared/components/avatar/avatar';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { Pill } from '../../../shared/components/pill/pill';
import { SegmentOption, Segmented } from '../../../shared/components/segmented/segmented';
import { downloadCsv } from '../../../shared/utils/download';
import { listQuery } from '../../../shared/utils/list-query';
import { liveReload } from '../../../core/services/live.service';

type RepFilter = Reputation | 'ALL';

@Component({
  selector: 'app-users-list',
  imports: [Avatar, Pagination, Pill, Segmented],
  templateUrl: './users-list.html',
})
export class UsersList {
  private readonly api = inject(AdminApi);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly query = listQuery();

  protected readonly data = signal<PageResponse<CustomerListItem> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly exporting = signal(false);

  protected readonly search = signal(this.query.get('q'));
  protected readonly rep = signal<RepFilter>((this.query.get('reputation') as Reputation) || 'ALL');
  protected readonly page = signal(this.query.page());

  protected readonly repOptions: SegmentOption<RepFilter>[] = [
    { value: 'ALL', label: 'Todos' },
    { value: 'GREEN', label: 'Sin incidencias' },
    { value: 'ORANGE', label: 'Atención' },
    { value: 'RED', label: 'Riesgo' },
  ];
  protected readonly reputation = reputation;
  protected readonly int = formatInt;

  private debounce?: ReturnType<typeof setTimeout>;

  /**
   * Panel accounts are stored as clients (there is no Admin type in the
   * backend), so they show up here. They are flagged to avoid confusion.
   */
  protected readonly teamIds = signal<Set<number>>(new Set());

  // Real time: reloads quietly when this data changes.
  private readonly live = liveReload(['actors', 'bookings'], () => this.load());

  constructor() {
    this.load();
    this.api.team().subscribe({ next: (t) => this.teamIds.set(new Set(t.map((m) => m.id))), error: () => {} });
  }

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    this.query.set({ q: this.search().trim(), reputation: this.repValue(), page: this.page() });

    this.api.customers({ search: this.search().trim(), reputation: this.repValue(), page: this.page() }).subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'No se han podido cargar los clientes.'));
      },
    });
  }

  protected onSearch(value: string) {
    this.search.set(value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      this.page.set(0);
      this.load();
    }, 300);
  }

  protected setRep(value: RepFilter) {
    this.rep.set(value);
    this.page.set(0);
    this.load();
  }

  protected goTo(page: number) {
    this.page.set(page);
    this.load();
  }

  protected open(c: CustomerListItem) {
    this.router.navigate(['/users', c.id]);
  }

  protected export() {
    this.exporting.set(true);
    const url = this.api.customersExportUrl({ search: this.search().trim(), reputation: this.repValue() });
    downloadCsv(this.http, url, 'clientes.csv').subscribe({
      next: () => this.exporting.set(false),
      error: (err) => {
        this.exporting.set(false);
        this.toast.error(err, 'No se ha podido exportar.');
      },
    });
  }

  private repValue(): Reputation | '' {
    return this.rep() === 'ALL' ? '' : (this.rep() as Reputation);
  }
}
