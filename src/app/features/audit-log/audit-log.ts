import { DatePipe, LowerCasePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuditLogEntry, PageResponse } from '../../core/models/admin.models';
import { AdminApi } from '../../core/services/admin-api.service';
import { apiErrorMessage } from '../../core/utils/api-error';
import { auditAction, entityRoute, entityType } from '../../core/utils/labels';
import { Pagination } from '../../shared/components/pagination/pagination';
import { Select, SelectOption } from '../../shared/components/select/select';
import { listQuery } from '../../shared/utils/list-query';
import { liveReload } from '../../core/services/live.service';

interface DayGroup {
  day: string;
  entries: AuditLogEntry[];
}

@Component({
  selector: 'app-audit-log',
  imports: [RouterLink, DatePipe, LowerCasePipe, Pagination, Select],
  templateUrl: './audit-log.html',
  styleUrl: './audit-log.scss',
})
export class AuditLog {
  private readonly api = inject(AdminApi);
  private readonly query = listQuery();

  protected readonly data = signal<PageResponse<AuditLogEntry> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal(this.query.page());
  protected readonly admin = signal('');

  protected readonly labels = { auditAction, entityType };
  protected readonly entityRoute = entityRoute;

  /** Admins que aparecen en esta página, para filtrar por persona. */
  protected readonly admins = computed(() => [...new Set((this.data()?.content ?? []).map((e) => e.adminName))].sort());
  protected readonly adminOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Todo el equipo', icon: 'groups' },
    ...this.admins().map((a) => ({ value: a, label: a, icon: 'person' })),
  ]);

  protected readonly groups = computed<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    for (const e of this.data()?.content ?? []) {
      if (this.admin() && e.adminName !== this.admin()) continue;
      const day = e.createdAt.slice(0, 10);
      let g = groups.find((x) => x.day === day);
      if (!g) groups.push((g = { day, entries: [] }));
      g.entries.push(e);
    }
    return groups;
  });

  /** Tiempo real: recarga en silencio cuando cambian estos datos. */
  private readonly live = liveReload(['audit'], () => this.load());

  constructor() {
    this.load();
  }

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    this.query.set({ page: this.page() });
    this.api.auditLog(this.page(), 40).subscribe({
      next: (r) => {
        this.data.set(r);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'No se ha podido cargar la auditoría.'));
      },
    });
  }

  protected goTo(page: number) {
    this.page.set(page);
    this.load();
  }

  protected dayLabel(day: string): string {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (day === today) return 'Hoy';
    if (day === yesterday) return 'Ayer';
    return new Date(day + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
}
