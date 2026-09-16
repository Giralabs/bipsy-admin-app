import { DatePipe, LowerCasePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AdminReview,
  AuditLogEntry,
  DashboardStats,
  DiscoverySettings,
  ReferralStat,
  TeamMember,
  Ticket,
} from '../../core/models/admin.models';
import { NAV_SECTIONS, NavItem } from '../../core/navigation';
import { AdminApi } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { BadgesService } from '../../core/services/badges.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { formatEur, formatInt, pct, timeAgo } from '../../core/utils/format';
import { auditAction, bookingStatus, entityType, ticketPriority } from '../../core/utils/labels';
import { Avatar } from '../../shared/components/avatar/avatar';

interface Tile {
  item: NavItem;
  section: string | null;
  /** Clase de tamaño en la rejilla de 12 columnas. */
  size: 'xl' | 'tall' | 'wide' | 'md' | 'sm';
}

/** Tamaño de cada bloque en el mosaico. Lo que no está aquí es mediano. */
const SIZES: Record<string, Tile['size']> = {
  '/dashboard': 'xl',
  '/tickets': 'tall',
  '/improvements': 'tall',
  '/audit-log': 'wide',
  '/categories': 'sm',
};

/**
 * Inicio del diseño en bloques: un mosaico con lo que pasa en cada sección,
 * no solo un acceso. Cada persona puede ocultar los bloques que no usa
 * («Personalizar»), y se guarda en su navegador.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink, DatePipe, LowerCasePipe, Avatar],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly api = inject(AdminApi);
  protected readonly auth = inject(AuthService);
  protected readonly badges = inject(BadgesService);
  protected readonly prefs = inject(PreferencesService);

  protected readonly now = new Date();
  protected readonly editing = signal(false);

  protected readonly stats = signal<DashboardStats | null>(null);
  protected readonly tickets = signal<Ticket[] | null>(null);
  protected readonly improvements = signal<Ticket[] | null>(null);
  protected readonly review = signal<AdminReview | null>(null);
  protected readonly team = signal<TeamMember[] | null>(null);
  protected readonly activity = signal<AuditLogEntry[] | null>(null);
  protected readonly referrals = signal<ReferralStat[] | null>(null);
  protected readonly discovery = signal<DiscoverySettings | null>(null);

  protected readonly fmt = { int: formatInt, eur: formatEur, ago: timeAgo };
  protected readonly labels = { ticketPriority, auditAction, entityType };

  protected readonly tiles = computed<Tile[]>(() =>
    NAV_SECTIONS.flatMap((s) => s.items.map((item) => ({ item, section: s.title, size: SIZES[item.path] ?? 'md' }))),
  );

  protected readonly visibleTiles = computed(() => {
    const hidden = this.prefs.prefs().hiddenTiles;
    return this.editing() ? this.tiles() : this.tiles().filter((t) => !hidden.includes(t.item.path));
  });

  protected readonly hiddenCount = computed(() => this.prefs.prefs().hiddenTiles.length);

  protected readonly greeting = computed(() => {
    const h = this.now.getHours();
    const hello = h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
    return `${hello}, ${this.auth.displayName().split(' ')[0]}`;
  });

  /** Lo pendiente, para las pastillas de la cabecera. */
  protected readonly focus = computed(() => {
    const c = this.badges.counts();
    return [
      { value: c.tickets, label: c.tickets === 1 ? 'ticket abierto' : 'tickets abiertos', link: '/tickets', icon: 'support_agent' },
      { value: c.improvements, label: c.improvements === 1 ? 'mejora por revisar' : 'mejoras por revisar', link: '/improvements', icon: 'lightbulb' },
      { value: c.reports, label: c.reports === 1 ? 'reporte pendiente' : 'reportes pendientes', link: '/reports', icon: 'flag' },
    ].filter((f) => f.value > 0);
  });

  protected readonly bookingBars = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return ['CONFIRMED', 'PENDING', 'CANCELED', 'NO_SHOW'].map((k) => {
      const meta = bookingStatus(k);
      return { label: meta.label, count: s.bookings.byStatus[k] ?? 0, percent: pct(s.bookings.byStatus[k] ?? 0, s.bookings.total), tone: meta.tone };
    });
  });

  constructor() {
    this.badges.refresh(true);
    const quiet = () => {};
    this.api.dashboard().subscribe({ next: (s) => this.stats.set(s), error: quiet });
    this.api.tickets({ status: 'OPEN', kind: 'SUPPORT', page: 0, size: 3 }).subscribe({ next: (r) => this.tickets.set(r.content), error: () => this.tickets.set([]) });
    this.api.tickets({ status: 'OPEN', kind: 'IMPROVEMENT', page: 0, size: 3 }).subscribe({ next: (r) => this.improvements.set(r.content), error: () => this.improvements.set([]) });
    this.api.reviewsList({ page: 0, size: 1 }).subscribe({ next: (r) => this.review.set(r.content[0] ?? null), error: quiet });
    this.api.team().subscribe({ next: (t) => this.team.set(t), error: quiet });
    this.api.auditLog(0, 3).subscribe({ next: (r) => this.activity.set(r.content), error: () => this.activity.set([]) });
    this.api.referrals().subscribe({
      next: (r) => this.referrals.set([...r].sort((a, b) => b.referredCount - a.referredCount).slice(0, 3)),
      error: quiet,
    });
    this.api.discoverySettings().subscribe({ next: (d) => this.discovery.set(d), error: quiet });
  }

  protected isHidden(path: string): boolean {
    return this.prefs.prefs().hiddenTiles.includes(path);
  }

  protected isHot(item: NavItem): boolean {
    return !!item.badge && this.badges.counts()[item.badge] > 0;
  }

  protected subject(t: Ticket): string {
    return t.subject || (t.description.length > 60 ? t.description.slice(0, 60) + '…' : t.description);
  }

  protected showAll() {
    this.prefs.set('hiddenTiles', []);
  }
}
