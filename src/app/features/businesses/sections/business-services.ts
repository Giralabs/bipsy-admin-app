import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { forkJoin } from 'rxjs';
import { OfferedService, ScheduleEntry } from '../../../core/models/admin.models';
import { AdminApi } from '../../../core/services/admin-api.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { formatEur } from '../../../core/utils/format';
import { WEEK_ORDER, weekday } from '../../../core/utils/labels';
import { liveReload } from '../../../core/services/live.service';

/** Carta de servicios y horario de apertura, tal como los publica el negocio. */
@Component({
  selector: 'app-business-services',
  template: `
    @if (error(); as e) {
      <div class="card"><div class="empty"><span class="material-symbols-rounded">cloud_off</span><p>{{ e }}</p><button type="button" class="btn" (click)="load()">Reintentar</button></div></div>
    } @else if (!services()) {
      <div class="card"><div class="empty"><span class="spinner"></span></div></div>
    } @else {
      <div class="split bs-split">
        <section>
          <p class="group__header overline">Servicios · {{ services()!.length }}</p>
          <div class="table-card">
            @if (services()!.length === 0) {
              <div class="empty"><span class="material-symbols-rounded">content_cut</span><h3>Sin servicios</h3><p>Aún no ha publicado ninguno, así que no se puede reservar.</p></div>
            } @else {
              <div class="table-scroll">
                <table class="table">
                  <thead><tr><th>Servicio</th><th class="num">Duración</th><th class="num">Precio</th><th>Valoración</th><th>Estado</th></tr></thead>
                  <tbody>
                    @for (s of services(); track s.id) {
                      <tr [class.bs-off]="!s.active">
                        <td>
                          <strong>{{ s.name }}</strong>
                          @if (s.description) { <small class="bs-small">{{ s.description }}</small> }
                        </td>
                        <td class="num nowrap">{{ s.duration }} min</td>
                        <td class="num nowrap">{{ eur(s.price) }}</td>
                        <td class="nowrap">
                          @if (s.averageRating != null) {
                            <span class="bs-rating"><span class="material-symbols-rounded fill">star</span>{{ s.averageRating.toFixed(1).replace('.', ',') }}</span>
                            <small class="bs-small">{{ s.reviewCount }} {{ s.reviewCount === 1 ? 'reseña' : 'reseñas' }}</small>
                          } @else { <span class="t-faint">—</span> }
                        </td>
                        <td><span class="pill" [class.pill--success]="s.active">{{ s.active ? 'Publicado' : 'Oculto' }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </section>

        <section>
          <p class="group__header overline">Horario de apertura</p>
          <div class="group__box">
            @for (d of days(); track d.day) {
              <div class="row bs-day">
                <span class="row__label">{{ d.label }}</span>
                <span class="bs-slots">
                  @for (slot of d.slots; track slot) { <span>{{ slot }}</span> } @empty { <span class="t-faint">Cerrado</span> }
                </span>
              </div>
            }
          </div>
          @if (!schedule()!.length) {
            <p class="group__footer">No ha configurado horario de apertura.</p>
          }
        </section>
      </div>
    }
  `,
  styles: `
    .bs-split { grid-template-columns: minmax(0, 1fr) 320px; }
    .bs-small { display: block; margin-top: 2px; font-size: 0.75rem; color: var(--clr-text-3); max-width: 380px; }
    .bs-off td { opacity: .55; }
    .bs-day { align-items: flex-start; }
    .bs-slots { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
      font-size: 0.875rem; font-weight: 500; color: var(--clr-text-2); font-variant-numeric: tabular-nums; }
    .bs-rating { display: inline-flex; align-items: center; gap: 2px; font-weight: 700; }
    .bs-rating .material-symbols-rounded { font-size: 16px; color: #FFB020; }
    @media (max-width: 1100px) { .bs-split { grid-template-columns: minmax(0, 1fr); } }
  `,
})
export class BusinessServices {
  private readonly api = inject(AdminApi);

  readonly businessId = input.required<number>();

  protected readonly services = signal<OfferedService[] | null>(null);
  protected readonly schedule = signal<ScheduleEntry[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly eur = formatEur;

  protected readonly days = computed(() =>
    WEEK_ORDER.map((day) => ({
      day,
      label: weekday[day],
      slots: (this.schedule() ?? [])
        .filter((s) => s.dayOfWeek === day)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((s) => `${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)}`),
    })),
  );

  /** Tiempo real: recarga en silencio cuando cambian estos datos. */
  private readonly live = liveReload(['businesses'], () => this.load());

  constructor() {
    effect(() => {
      this.businessId();
      untracked(() => this.load());
    });
  }

  protected load() {
    this.error.set(null);
    forkJoin({ s: this.api.businessServices(this.businessId()), h: this.api.businessSchedule(this.businessId()) }).subscribe({
      next: ({ s, h }) => {
        this.services.set(s);
        this.schedule.set(h);
      },
      error: (err) => this.error.set(apiErrorMessage(err, 'No se han podido cargar los servicios.')),
    });
  }
}
