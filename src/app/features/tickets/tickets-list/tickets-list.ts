import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { downloadCsv } from '../../../shared/utils/download';
import { TicketListItem, TicketStatus } from '../models/ticket.model';
import { TicketsService } from '../tickets.service';

@Component({
  selector: 'app-tickets-list',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './tickets-list.html',
  styleUrl: './tickets-list.scss',
})
export class TicketsList {
  private readonly http = inject(HttpClient);

  readonly tickets = signal<TicketListItem[]>([]);
  readonly loading = signal(false);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  statusFilter: TicketStatus | '' = '';
  businessIdFilter = '';

  constructor(private ticketsService: TicketsService) {
    this.load();
  }

  load() {
    this.loading.set(true);
    const businessId = this.businessIdFilter.trim() ? Number(this.businessIdFilter.trim()) : null;
    this.ticketsService.list(this.statusFilter || null, businessId, this.page()).subscribe({
      next: (res) => {
        this.tickets.set(res.content);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onFilterChange() {
    this.page.set(0);
    this.load();
  }

  goToPage(delta: number) {
    const next = this.page() + delta;
    if (next < 0 || next >= this.totalPages()) return;
    this.page.set(next);
    this.load();
  }

  displaySubject(t: TicketListItem): string {
    if (t.subject) return t.subject;
    return t.description.length > 60 ? t.description.slice(0, 60) + '…' : t.description;
  }

  export() {
    const businessId = this.businessIdFilter.trim() ? Number(this.businessIdFilter.trim()) : null;
    const url = this.ticketsService.exportUrl(this.statusFilter || null, businessId);
    downloadCsv(this.http, url, 'tickets.csv');
  }
}
