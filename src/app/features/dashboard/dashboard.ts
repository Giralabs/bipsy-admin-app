import { DatePipe, LowerCasePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuditLogEntry, DashboardStats, Report, Ticket } from '../../core/models/admin.models';
import { AdminApi } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { BadgesService } from '../../core/services/badges.service';
import { apiErrorMessage } from '../../core/utils/api-error';
import { formatEur, formatInt, pct, timeAgo } from '../../core/utils/format';
import {
  Tone,
  auditAction,
  bookingStatus,
  entityRoute,
  entityType,
  reportReason,
  ticketPriority,
  ticketStatus,
} from '../../core/utils/labels';
import { Pill } from '../../shared/components/pill/pill';
import { liveReload } from '../../core/services/live.service';

interface BarEntry {
  label: string;
  count: number;
  percent: number;
  tone: Tone;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe, LowerCasePipe, Pill],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly api = inject(AdminApi);
  protected readonly auth = inject(AuthService);
  private readonly badges = inject(BadgesService);

  protected readonly stats = signal<DashboardStats | null>(null);
  protected readonly openTickets = signal<Ticket[]>([]);
  protected readonly pendingReports = signal<Report[]>([]);
  protected readonly pendingReportsTotal = signal(0);
  protected readonly activity = signal<AuditLogEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly now = new Date();

  protected readonly fmt = { eur: formatEur, int: formatInt, ago: timeAgo };
  protected readonly labels = { ticketPriority, ticketStatus, auditAction, entityType, reportReason };
  protected readonly entityRoute = entityRoute;

  protected readonly greeting = computed(() => {
    const h = this.now.getHours();
    const first = this.auth.displayName().split(' ')[0];
    const hello = h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
    return `${hello}, ${first}`;
  });

  protected readonly bookingBars = computed<BarEntry[]>(() => {
    const s = this.stats();
    if (!s) return [];
    return ['CONFIRMED', 'PENDING', 'CANCELED', 'NO_SHOW'].map((k) => {
      const meta = bookingStatus(k);
      const count = s.bookings.byStatus[k] ?? 0;
      return { label: meta.label, count, percent: pct(count, s.bookings.total), tone: meta.tone };
    });
  });

  protected readonly ticketBars = computed<BarEntry[]>(() => {
    const s = this.stats();
    if (!s) return [];
    return ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((k) => {
      const meta = ticketStatus(k);
      const count = s.tickets.byStatus[k] ?? 0;
      return { label: meta.label, count, percent: pct(count, s.tickets.total), tone: meta.tone };
    });
  });

  /** What someone on the team should look at today. */
  protected readonly attention = computed(() => {
    const s = this.stats();
    if (!s) return [];
    // Per-kind counters come from BadgesService: the backend dashboard adds
    // support and improvements up into the same figure.
    const { tickets: open, improvements, onboarding } = this.badges.counts();
    return [
      { icon: 'call', value: onboarding, label: onboarding === 1 ? 'negocio nuevo por llamar' : 'negocios nuevos por llamar', link: '/onboarding', query: {}, hot: onboarding > 0 },
      { icon: 'mark_email_unread', value: open, label: open === 1 ? 'ticket sin atender' : 'tickets sin atender', link: '/tickets', query: { status: 'OPEN' }, hot: open > 0 },
      { icon: 'lightbulb', value: improvements, label: improvements === 1 ? 'solicitud de mejora' : 'solicitudes de mejora', link: '/improvements', query: { status: 'OPEN' }, hot: improvements > 0 },
      { icon: 'flag', value: this.pendingReportsTotal(), label: 'reportes pendientes', link: '/reports', query: { status: 'PENDING' }, hot: this.pendingReportsTotal() > 0 },
      { icon: 'pending', value: s.businesses.setupIncomplete, label: 'negocios sin terminar el alta', link: '/businesses', query: {}, hot: false },
      { icon: 'block', value: s.businesses.banned, label: 'negocios baneados', link: '/businesses', query: { banned: 'true' }, hot: false },
    ];
  });

  // Real time: reloads quietly when this data changes.
  private readonly live = liveReload(['actors', 'bookings', 'tickets', 'reports', 'plans', 'payments', 'audit', 'reviews'], () => this.load());

  constructor() {
    this.load();
  }

  protected load() {
    this.loading.set(true);
    this.error.set(null);

    this.api.dashboard().subscribe({
      next: (s) => {
        this.stats.set(s);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'No se han podido cargar las estadísticas.'));
      },
    });

    // Secondary data loads separately: if one of these fails, the summary still shows.
    this.badges.refresh(true);
    this.api.tickets({ status: 'OPEN', kind: 'SUPPORT', page: 0, size: 6 }).subscribe({
      next: (r) => this.openTickets.set(r.content),
      error: () => {},
    });

    this.api.reports({ status: 'PENDING', page: 0, size: 4 }).subscribe({
      next: (r) => {
        this.pendingReports.set(r.content);
        this.pendingReportsTotal.set(r.totalElements);
      },
      error: () => {},
    });

    this.api.auditLog(0, 6).subscribe({ next: (r) => this.activity.set(r.content), error: () => {} });
  }

  protected subject(t: Ticket): string {
    return t.subject || (t.description.length > 70 ? t.description.slice(0, 70) + '…' : t.description);
  }
}
