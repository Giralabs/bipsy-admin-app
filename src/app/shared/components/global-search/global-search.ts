import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SearchResults, SearchService } from '../../../core/services/search.service';

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './global-search.html',
  styleUrl: './global-search.scss',
})
export class GlobalSearch {
  private readonly searchService = inject(SearchService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  q = '';
  readonly results = signal<SearchResults | null>(null);
  readonly open = signal(false);
  private debounceHandle?: ReturnType<typeof setTimeout>;

  onInput() {
    clearTimeout(this.debounceHandle);
    const term = this.q.trim();
    if (term.length < 2) {
      this.results.set(null);
      this.open.set(false);
      return;
    }
    this.debounceHandle = setTimeout(() => {
      this.searchService.search(term).subscribe((res) => {
        this.results.set(res);
        this.open.set(true);
      });
    }, 250);
  }

  goTo(path: string[]) {
    this.open.set(false);
    this.q = '';
    this.results.set(null);
    this.router.navigate(path);
  }

  hasResults(): boolean {
    const r = this.results();
    return !!r && (r.customers.length > 0 || r.businesses.length > 0 || r.tickets.length > 0);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
