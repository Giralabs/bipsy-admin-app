import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageResponse, Report, ReportStatus } from '../../core/models/admin.models';
import { AdminApi } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage, isNotFound } from '../../core/utils/api-error';
import { timeAgo } from '../../core/utils/format';
import { reportReason, reportStatus } from '../../core/utils/labels';
import { Avatar } from '../../shared/components/avatar/avatar';
import { Pagination } from '../../shared/components/pagination/pagination';
import { Pill } from '../../shared/components/pill/pill';
import { SegmentOption, Segmented } from '../../shared/components/segmented/segmented';
import { listQuery } from '../../shared/utils/list-query';
import { liveReload } from '../../core/services/live.service';

type Filter = ReportStatus | 'ALL';

@Component({
  selector: 'app-reports',
  imports: [RouterLink, DatePipe, Avatar, Pagination, Pill, Segmented],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);
  private readonly query = listQuery();

  protected readonly data = signal<PageResponse<Report> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<Filter>((this.query.get('status') as ReportStatus) || 'PENDING');
  protected readonly page = signal(this.query.page());
  protected readonly busyId = signal<number | null>(null);
  protected readonly expanded = signal<number | null>(null);

  protected readonly options: SegmentOption<Filter>[] = [
    { value: 'PENDING', label: 'Pendientes' },
    { value: 'REVIEWED', label: 'Revisados' },
    { value: 'DISMISSED', label: 'Descartados' },
    { value: 'ALL', label: 'Todos' },
  ];
  protected readonly labels = { reportReason, reportStatus };
  protected readonly ago = timeAgo;

  // Real time: reloads quietly when this data changes.
  private readonly live = liveReload(['reports'], () => this.load());

  constructor() {
    this.load();
  }

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    const status = this.status() === 'ALL' ? '' : (this.status() as ReportStatus);
    this.query.set({ status: this.status() === 'PENDING' ? '' : this.status(), page: this.page() });

    this.api.reports({ status, page: this.page() }).subscribe({
      next: (r) => {
        this.data.set(r);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'No se han podido cargar los reportes.'));
      },
    });
  }

  protected setStatus(value: Filter) {
    this.status.set(value);
    this.page.set(0);
    this.load();
  }

  protected goTo(page: number) {
    this.page.set(page);
    this.load();
  }

  protected route(r: Report): string[] {
    return r.targetType === 'BUSINESS' ? ['/businesses', String(r.reportedId)] : ['/users', String(r.reportedId)];
  }

  protected resolve(r: Report, status: ReportStatus) {
    this.busyId.set(r.id);
    this.api.updateReportStatus(r.id, status).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        const filter = this.status();
        // If it no longer matches the filter, remove it from the list; otherwise update it in place.
        this.data.update((d) =>
          d && {
            ...d,
            content:
              filter === 'ALL'
                ? d.content.map((x) => (x.id === updated.id ? updated : x))
                : d.content.filter((x) => x.id !== updated.id),
            totalElements: filter === 'ALL' ? d.totalElements : Math.max(0, d.totalElements - 1),
          },
        );
        this.toast.success(
          status === 'REVIEWED' ? 'Reporte marcado como revisado.' : status === 'DISMISSED' ? 'Reporte descartado.' : 'Reporte reabierto.',
        );
      },
      error: (err) => {
        this.busyId.set(null);
        this.toast.error(
          isNotFound(err) ? 'Resolver reportes necesita la versión nueva del backend (PUT /admin/reports/{id}/status).' : err,
          'No se ha podido actualizar el reporte.',
        );
      },
    });
  }
}
