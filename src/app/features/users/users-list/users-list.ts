import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReputationBadge } from '../../../shared/components/reputation-badge/reputation-badge';
import { downloadCsv } from '../../../shared/utils/download';
import { CustomerListItem, Reputation } from '../models/customer.model';
import { UsersService } from '../users.service';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [FormsModule, RouterLink, ReputationBadge],
  templateUrl: './users-list.html',
  styleUrl: './users-list.scss',
})
export class UsersList {
  private readonly http = inject(HttpClient);
  readonly customers = signal<CustomerListItem[]>([]);
  readonly loading = signal(false);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  search = '';
  reputationFilter: Reputation | '' = '';

  constructor(private usersService: UsersService) {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.usersService.list(this.search.trim(), this.reputationFilter || null, this.page()).subscribe({
      next: (res) => {
        this.customers.set(res.content);
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

  export() {
    const url = this.usersService.exportUrl(this.search.trim(), this.reputationFilter || null);
    downloadCsv(this.http, url, 'usuarios.csv');
  }
}
