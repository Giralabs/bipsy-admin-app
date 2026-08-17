import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { downloadCsv } from '../../../shared/utils/download';
import { BusinessListItem } from '../models/business.model';
import { BusinessesService } from '../businesses.service';

@Component({
  selector: 'app-businesses-list',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './businesses-list.html',
  styleUrl: './businesses-list.scss',
})
export class BusinessesList {
  private readonly http = inject(HttpClient);

  readonly businesses = signal<BusinessListItem[]>([]);
  readonly loading = signal(false);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  search = '';
  bannedFilter: '' | 'true' | 'false' = '';

  constructor(private businessesService: BusinessesService) {
    this.load();
  }

  load() {
    this.loading.set(true);
    const banned = this.bannedFilter === '' ? null : this.bannedFilter === 'true';
    this.businessesService.list(this.search.trim(), banned, this.page()).subscribe({
      next: (res) => {
        this.businesses.set(res.content);
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
    const banned = this.bannedFilter === '' ? null : this.bannedFilter === 'true';
    const url = this.businessesService.exportUrl(this.search.trim(), banned);
    downloadCsv(this.http, url, 'establecimientos.csv');
  }
}
