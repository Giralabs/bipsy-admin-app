import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BusinessListItem, PageResponse } from '../../../core/models/admin.models';
import { AdminApi } from '../../../core/services/admin-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { formatInt } from '../../../core/utils/format';
import { businessState } from '../../../core/utils/labels';
import { Avatar } from '../../../shared/components/avatar/avatar';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { Pill } from '../../../shared/components/pill/pill';
import { SegmentOption, Segmented } from '../../../shared/components/segmented/segmented';
import { downloadCsv } from '../../../shared/utils/download';
import { listQuery } from '../../../shared/utils/list-query';
import { liveReload } from '../../../core/services/live.service';

type BanFilter = 'ALL' | 'ACTIVE' | 'BANNED';

@Component({
  selector: 'app-businesses-list',
  imports: [Avatar, Pagination, Pill, Segmented, DatePipe],
  templateUrl: './businesses-list.html',
})
export class BusinessesList {
  private readonly api = inject(AdminApi);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly query = listQuery();

  protected readonly data = signal<PageResponse<BusinessListItem> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly exporting = signal(false);

  protected readonly search = signal(this.query.get('q'));
  protected readonly ban = signal<BanFilter>(this.initialBan());
  protected readonly page = signal(this.query.page());

  protected readonly banOptions: SegmentOption<BanFilter>[] = [
    { value: 'ALL', label: 'Todos' },
    { value: 'ACTIVE', label: 'Sin banear' },
    { value: 'BANNED', label: 'Baneados' },
  ];
  protected readonly state = businessState;
  protected readonly int = formatInt;

  private debounce?: ReturnType<typeof setTimeout>;

  // Real time: reloads quietly when this data changes.
  private readonly live = liveReload(['actors', 'plans'], () => this.load());

  constructor() {
    this.load();
  }

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    const banned = this.bannedValue();
    this.query.set({ q: this.search().trim(), banned: banned === null ? '' : String(banned), page: this.page() });

    this.api.businesses({ search: this.search().trim(), banned, page: this.page() }).subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'No se han podido cargar los negocios.'));
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

  protected setBan(value: BanFilter) {
    this.ban.set(value);
    this.page.set(0);
    this.load();
  }

  protected goTo(page: number) {
    this.page.set(page);
    this.load();
  }

  protected open(b: BusinessListItem) {
    this.router.navigate(['/businesses', b.id]);
  }

  protected export() {
    this.exporting.set(true);
    const url = this.api.businessesExportUrl({ search: this.search().trim(), banned: this.bannedValue() });
    downloadCsv(this.http, url, 'negocios.csv').subscribe({
      next: () => this.exporting.set(false),
      error: (err) => {
        this.exporting.set(false);
        this.toast.error(err, 'No se ha podido exportar.');
      },
    });
  }

  private bannedValue(): boolean | null {
    return this.ban() === 'ALL' ? null : this.ban() === 'BANNED';
  }

  private initialBan(): BanFilter {
    const v = this.query.get('banned');
    return v === 'true' ? 'BANNED' : v === 'false' ? 'ACTIVE' : 'ALL';
  }
}
