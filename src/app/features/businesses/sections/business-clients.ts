import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BusinessClient } from '../../../core/models/admin.models';
import { AdminApi } from '../../../core/services/admin-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { Avatar } from '../../../shared/components/avatar/avatar';
import { copyText } from '../../../shared/utils/download';
import { liveReload } from '../../../core/services/live.service';

/** La agenda de clientes de un negocio (lo que ve en «Clientes» de su app). */
@Component({
  selector: 'app-business-clients',
  imports: [DatePipe, RouterLink, Avatar],
  template: `
    <div class="toolbar">
      <label class="search">
        <span class="material-symbols-rounded">search</span>
        <input class="input" type="search" placeholder="Nombre, teléfono o email" [value]="q()" (input)="q.set($any($event.target).value)" />
      </label>
      @if (clients(); as list) {
        <span class="t-caption">{{ list.length }} en su agenda · {{ linked() }} con cuenta en Bipsy</span>
      }
    </div>

    <div class="table-card">
      @if (error(); as e) {
        <div class="empty"><span class="material-symbols-rounded">cloud_off</span><p>{{ e }}</p><button type="button" class="btn" (click)="load()">Reintentar</button></div>
      } @else if (!clients()) {
        <div class="empty"><span class="spinner"></span></div>
      } @else if (visible().length === 0) {
        <div class="empty">
          <span class="material-symbols-rounded">contacts</span>
          <h3>{{ clients()!.length === 0 ? 'Sin clientes en su agenda' : 'Ninguno coincide' }}</h3>
          <p>{{ clients()!.length === 0 ? 'Los clientes aparecen aquí cuando reservan o el negocio los añade o importa de sus contactos.' : 'Prueba con otro nombre o teléfono.' }}</p>
        </div>
      } @else {
        <div class="table-scroll">
          <table class="table">
            <thead><tr><th>Cliente</th><th>Contacto</th><th>Origen</th><th class="num">Citas</th><th>Última cita</th></tr></thead>
            <tbody>
              @for (c of visible(); track c.id) {
                <tr>
                  <td>
                    <div class="cell-main">
                      <app-avatar [name]="c.name" [size]="32" />
                      <span class="cell-main__text">
                        <strong>{{ c.name }}</strong>
                        @if (c.linkedCustomerId) {
                          <small><a class="bc-link" [routerLink]="['/users', c.linkedCustomerId]">Ver su cuenta de Bipsy</a></small>
                        } @else if (c.notes) {
                          <small [title]="c.notes">{{ c.notes }}</small>
                        }
                      </span>
                    </div>
                  </td>
                  <td>
                    @if (c.phone) { <button type="button" class="bc-copy" (click)="copy(c.phone)">{{ c.phone }}</button> }
                    @if (c.email) { <small class="bc-small">{{ c.email }}</small> }
                    @if (!c.phone && !c.email) { <span class="t-faint">—</span> }
                  </td>
                  <td>
                    <span class="pill">{{ c.linkedCustomerId ? 'Reservó en Bipsy' : c.source === 'CONTACTS' ? 'Importado' : 'Añadido a mano' }}</span>
                    @if (c.invitedAt) { <small class="bc-small">Invitado {{ c.invitedAt | date: 'd MMM' }}</small> }
                  </td>
                  <td class="num">{{ c.bookingCount }}</td>
                  <td class="t-muted nowrap">{{ c.lastBookingAt ? (c.lastBookingAt | date: 'd MMM y') : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    .bc-link { color: var(--clr-accent-text); font-weight: 600; text-decoration: none; }
    .bc-link:hover { text-decoration: underline; }
    .bc-small { display: block; margin-top: 2px; font-size: 0.75rem; color: var(--clr-text-3); }
    .bc-copy { border: none; background: none; padding: 0; color: var(--clr-text); font: inherit; cursor: copy; }
    .bc-copy:hover { color: var(--clr-accent-text); }
  `,
})
export class BusinessClients {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);

  readonly businessId = input.required<number>();

  protected readonly clients = signal<BusinessClient[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly q = signal('');

  protected readonly linked = computed(() => (this.clients() ?? []).filter((c) => c.linkedCustomerId).length);
  protected readonly visible = computed(() => {
    const term = this.q().trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    return (this.clients() ?? []).filter(
      (c) =>
        !term ||
        c.name.toLowerCase().includes(term) ||
        (c.email ?? '').toLowerCase().includes(term) ||
        (digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits)),
    );
  });

  /** Tiempo real: recarga en silencio cuando cambian estos datos. */
  private readonly live = liveReload(['actors', 'bookings'], () => this.load());

  constructor() {
    effect(() => {
      this.businessId();
      untracked(() => this.load());
    });
  }

  protected load() {
    this.error.set(null);
    this.api.businessClients(this.businessId()).subscribe({
      next: (c) => this.clients.set(c),
      error: (err) => this.error.set(apiErrorMessage(err, 'No se han podido cargar los clientes.')),
    });
  }

  protected async copy(text: string) {
    if (await copyText(text)) this.toast.info('Teléfono copiado.');
  }
}
