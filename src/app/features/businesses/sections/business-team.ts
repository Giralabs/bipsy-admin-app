import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Invitation, Worker } from '../../../core/models/admin.models';
import { AdminApi } from '../../../core/services/admin-api.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { Avatar } from '../../../shared/components/avatar/avatar';
import { liveReload } from '../../../core/services/live.service';

/** Profesionales del negocio, sus permisos en la app e invitaciones pendientes. */
@Component({
  selector: 'app-business-team',
  imports: [DatePipe, Avatar],
  template: `
    @if (error(); as e) {
      <div class="card"><div class="empty"><span class="material-symbols-rounded">cloud_off</span><p>{{ e }}</p><button type="button" class="btn" (click)="load()">Reintentar</button></div></div>
    } @else if (!workers()) {
      <div class="card"><div class="empty"><span class="spinner"></span></div></div>
    } @else {
      <div class="stack stack--lg">
        <section>
          <p class="group__header overline">Profesionales · {{ workers()!.length }}</p>
          @if (workers()!.length === 0) {
            <div class="card"><div class="empty"><span class="material-symbols-rounded">badge</span><h3>Trabaja solo</h3><p>No tiene profesionales en su equipo.</p></div></div>
          } @else {
            <div class="bt-grid">
              @for (w of workers(); track w.id) {
                <article class="bt-card">
                  <div class="bt-card__head">
                    <app-avatar [name]="w.name" [src]="w.profileImageUrl" [size]="44" />
                    <div class="bt-card__who">
                      <strong>{{ w.name }}</strong>
                      <small>&#64;{{ w.username }}</small>
                    </div>
                    <span class="pill" [class.pill--success]="w.available">{{ w.available ? 'Disponible' : 'No disponible' }}</span>
                  </div>
                  <div class="bt-card__contact">
                    <span><span class="material-symbols-rounded">mail</span>{{ w.email }}</span>
                    @if (w.phone) { <span><span class="material-symbols-rounded">call</span>{{ w.phone }}</span> }
                  </div>
                  <div class="cluster bt-perms">
                    @for (p of perms; track p.key) {
                      <span class="bt-perm" [class.is-on]="w[p.key]">
                        <span class="material-symbols-rounded">{{ w[p.key] ? 'check' : 'close' }}</span>{{ p.label }}
                      </span>
                    }
                  </div>
                </article>
              }
            </div>
          }
        </section>

        <section>
          <p class="group__header overline">Invitaciones sin usar · {{ invitations()!.length }}</p>
          <div class="group__box">
            @for (inv of invitations(); track inv.id) {
              <div class="row">
                <span class="material-symbols-rounded row__icon">forward_to_inbox</span>
                <span class="row__label">{{ inv.email || 'Invitación por enlace' }}<small>{{ isExpired(inv) ? 'Caducada' : 'Caduca' }} el {{ inv.expiresAt | date: "d 'de' MMMM" }}</small></span>
                <span class="row__trail"><span class="pill" [class.pill--warn]="!isExpired(inv)">{{ isExpired(inv) ? 'Caducada' : 'Pendiente' }}</span></span>
              </div>
            } @empty {
              <div class="row t-muted">No tiene invitaciones pendientes.</div>
            }
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    .bt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
    .bt-card { padding: 16px 18px; border-radius: var(--r-md); background: var(--clr-surface); display: flex; flex-direction: column; gap: 12px; }
    .bt-card__head { display: flex; align-items: center; gap: 12px; }
    .bt-card__who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .bt-card__who small { font-size: 0.75rem; color: var(--clr-text-3); }
    .bt-card__contact { display: flex; flex-direction: column; gap: 4px; font-size: 0.8125rem; color: var(--clr-text-2); }
    .bt-card__contact span { display: inline-flex; align-items: center; gap: 8px; }
    .bt-card__contact .material-symbols-rounded { font-size: 16px; color: var(--clr-text-3); }
    .bt-perms { gap: 6px; }
    .bt-perm { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; border-radius: 999px; background: var(--clr-field); font-size: 0.6875rem; font-weight: 700; color: var(--clr-text-3); }
    .bt-perm .material-symbols-rounded { font-size: 13px; }
    .bt-perm.is-on { color: var(--clr-success-text); background: rgba(95, 185, 138, 0.14); }
  `,
})
export class BusinessTeam {
  private readonly api = inject(AdminApi);

  readonly businessId = input.required<number>();

  protected readonly workers = signal<Worker[] | null>(null);
  protected readonly invitations = signal<Invitation[] | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly perms: { key: 'autoAccept' | 'allowOvertime' | 'chatEnabled' | 'waitlistManageEnabled' | 'clockInEnabled'; label: string }[] = [
    { key: 'autoAccept', label: 'Acepta citas solo' },
    { key: 'allowOvertime', label: 'Horas extra' },
    { key: 'chatEnabled', label: 'Chat' },
    { key: 'waitlistManageEnabled', label: 'Lista de espera' },
    { key: 'clockInEnabled', label: 'Fichaje' },
  ];

  /** Tiempo real: recarga en silencio cuando cambian estos datos. */
  private readonly live = liveReload(['businesses', 'actors'], () => this.load());

  constructor() {
    effect(() => {
      this.businessId();
      untracked(() => this.load());
    });
  }

  protected load() {
    this.error.set(null);
    forkJoin({ w: this.api.businessWorkers(this.businessId()), i: this.api.businessInvitations(this.businessId()) }).subscribe({
      next: ({ w, i }) => {
        this.workers.set(w);
        this.invitations.set(i);
      },
      error: (err) => this.error.set(apiErrorMessage(err, 'No se ha podido cargar el equipo.')),
    });
  }

  protected isExpired(inv: Invitation): boolean {
    return !!inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now();
  }
}
