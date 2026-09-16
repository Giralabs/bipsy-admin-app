import { Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SearchResults } from '../../../core/models/admin.models';
import { NAV_ITEMS } from '../../../core/navigation';
import { AdminApi } from '../../../core/services/admin-api.service';
import { ticketStatus } from '../../../core/utils/labels';

interface PaletteItem {
  id: string;
  group: string;
  icon: string;
  label: string;
  hint?: string;
  route: string[];
}

const PAGES: PaletteItem[] = [
  ...NAV_ITEMS.map((i) => ({ id: 'p' + i.path, group: 'Ir a', icon: i.icon, label: i.label, route: [i.path] })),
  { id: 'p-home', group: 'Ir a', icon: 'apps', label: 'Inicio en bloques', route: ['/home'] },
  { id: 'p-account', group: 'Ir a', icon: 'tune', label: 'Mi cuenta, diseño y accesibilidad', route: ['/account'] },
];

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Global search (Ctrl K or "/"). Searches clients, businesses and tickets in
 * the backend, jumps to a section by name and opens by id: "#42" opens
 * ticket 42 directly, which is how an issue usually arrives.
 */
@Component({
  selector: 'app-command-palette',
  host: { '(document:keydown.escape)': 'open() && closed.emit()' },
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.scss',
})
export class CommandPalette {
  readonly open = input.required<boolean>();
  readonly closed = output<void>();

  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('queryInput');

  protected readonly q = signal('');
  protected readonly results = signal<SearchResults | null>(null);
  protected readonly searching = signal(false);
  protected readonly active = signal(0);

  private debounce?: ReturnType<typeof setTimeout>;
  private pending?: Subscription;

  protected readonly items = computed<PaletteItem[]>(() => {
    const term = normalize(this.q().trim());
    const out: PaletteItem[] = [];

    const idMatch = term.match(/^#?(\d{1,9})$/);
    if (idMatch) {
      const id = idMatch[1];
      out.push(
        { id: `id-t${id}`, group: 'Abrir por id', icon: 'confirmation_number', label: `Ticket #${id}`, route: ['/tickets', id] },
        { id: `id-c${id}`, group: 'Abrir por id', icon: 'person', label: `Cliente ${id}`, route: ['/users', id] },
        { id: `id-b${id}`, group: 'Abrir por id', icon: 'storefront', label: `Negocio ${id}`, route: ['/businesses', id] },
      );
    }

    const r = this.results();
    if (r) {
      for (const c of r.customers) {
        out.push({ id: `c${c.id}`, group: 'Clientes', icon: 'person', label: c.name, hint: c.email, route: ['/users', String(c.id)] });
      }
      for (const b of r.businesses) {
        out.push({ id: `b${b.id}`, group: 'Negocios', icon: 'storefront', label: b.name, hint: b.email, route: ['/businesses', String(b.id)] });
      }
      for (const t of r.tickets) {
        out.push({
          id: `t${t.id}`, group: 'Tickets', icon: 'confirmation_number',
          label: t.subject || `Ticket #${t.id}`, hint: ticketStatus(t.status).label, route: ['/tickets', String(t.id)],
        });
      }
    }

    const pages = term ? PAGES.filter((p) => normalize(p.label).includes(term)) : PAGES;
    out.push(...pages);
    return out;
  });

  /** Groups in the order they appear, to render the headers. */
  protected readonly groups = computed(() => {
    const list = this.items();
    const groups: { name: string; items: { item: PaletteItem; index: number }[] }[] = [];
    list.forEach((item, index) => {
      let g = groups.find((x) => x.name === item.group);
      if (!g) groups.push((g = { name: item.group, items: [] }));
      g.items.push({ item, index });
    });
    return groups;
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.q.set('');
        this.results.set(null);
        this.active.set(0);
        setTimeout(() => this.inputRef()?.nativeElement.focus());
      }
    });
  }

  protected onInput(value: string) {
    this.q.set(value);
    this.active.set(0);
    clearTimeout(this.debounce);
    this.pending?.unsubscribe();

    const term = value.trim();
    if (term.length < 2 || /^#?\d+$/.test(term)) {
      this.results.set(null);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    this.debounce = setTimeout(() => {
      this.pending = this.api.search(term).subscribe({
        next: (res) => {
          this.results.set(res);
          this.searching.set(false);
        },
        error: () => this.searching.set(false),
      });
    }, 220);
  }

  protected onKeydown(event: KeyboardEvent) {
    const count = this.items().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.active.set(count ? (this.active() + 1) % count : 0);
      this.scrollActive();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.active.set(count ? (this.active() - 1 + count) % count : 0);
      this.scrollActive();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = this.items()[this.active()];
      if (item) this.go(item);
    }
  }

  protected go(item: PaletteItem) {
    this.closed.emit();
    this.router.navigate(item.route);
  }

  private scrollActive() {
    setTimeout(() => document.querySelector('.palette__item.is-active')?.scrollIntoView({ block: 'nearest' }));
  }
}
