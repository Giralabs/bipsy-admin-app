import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { DashboardStats } from './models/dashboard.model';
import { DashboardService } from './dashboard.service';

const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendientes',
  CONFIRMED: 'Confirmadas',
  CANCELED: 'Canceladas',
  NO_SHOW: 'No presentados',
};

const TICKET_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abiertos',
  IN_PROGRESS: 'En curso',
  RESOLVED: 'Resueltos',
  CLOSED: 'Cerrados',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly dashboardService = inject(DashboardService);

  readonly stats = signal<DashboardStats | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.dashboardService.get().subscribe({
      next: (s) => {
        this.stats.set(s);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(
          err.status === 0
            ? 'No se pudo conectar con el servidor. ¿Está el backend arrancado?'
            : `Error ${err.status}: ${err.error?.message || err.message || 'no se pudieron cargar las estadísticas.'}`,
        );
      },
    });
  }

  statusEntries(byStatus: Record<string, number>, labels: Record<string, string>) {
    return Object.entries(byStatus).map(([status, count]) => ({
      label: labels[status] ?? status,
      count,
    }));
  }

  bookingStatusEntries(byStatus: Record<string, number>) {
    return this.statusEntries(byStatus, BOOKING_STATUS_LABELS);
  }

  ticketStatusEntries(byStatus: Record<string, number>) {
    return this.statusEntries(byStatus, TICKET_STATUS_LABELS);
  }

  formatEur(value: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
