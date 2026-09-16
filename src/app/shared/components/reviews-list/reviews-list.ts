import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminReview, PageResponse } from '../../../core/models/admin.models';
import { AdminApi } from '../../../core/services/admin-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { Avatar } from '../avatar/avatar';
import { ConfirmModal } from '../confirm-modal/confirm-modal';
import { Pagination } from '../pagination/pagination';
import { liveReload } from '../../../core/services/live.service';

/**
 * Reseñas publicadas: todas, las de un negocio o las de un cliente. Retirar
 * una es un borrado lógico, igual que cuando la borra su autor: deja de verse
 * en la app, en la web y en la media del negocio.
 */
@Component({
  selector: 'app-reviews-list',
  imports: [DatePipe, RouterLink, Avatar, Pagination, ConfirmModal],
  template: `
    @if (showFilter()) {
      <div class="toolbar">
        <div class="cluster">
          @for (r of ratingFilters; track r.value) {
            <button type="button" class="chip" [class.is-on]="minMax() === r.value" (click)="minMax.set(r.value)">{{ r.label }}</button>
          }
        </div>
        <span class="t-caption">El filtro se aplica a la página cargada.</span>
      </div>
    }

    @if (error(); as e) {
      <div class="card"><div class="empty"><span class="material-symbols-rounded">cloud_off</span><p>{{ e }}</p><button type="button" class="btn" (click)="load()">Reintentar</button></div></div>
    } @else if (!data()) {
      <div class="card"><div class="empty"><span class="spinner"></span></div></div>
    } @else if (visible().length === 0) {
      <div class="card"><div class="empty"><span class="material-symbols-rounded">reviews</span><h3>Sin reseñas</h3><p>{{ data()!.totalElements === 0 ? 'Todavía no hay ninguna publicada.' : 'Ninguna en esta página con ese filtro.' }}</p></div></div>
    } @else {
      <div class="stack" [style.opacity]="loading() ? 0.55 : 1">
        @for (r of visible(); track r.id) {
          <article class="rv">
            <div class="rv__head">
              <app-avatar [name]="r.customerName" [size]="38" />
              <div class="rv__who">
                <a class="rv__name" [routerLink]="['/users', r.customerId]">{{ r.customerName }}</a>
                <span class="t-caption">
                  @if (!businessId()) { en <a class="rv__biz" [routerLink]="['/businesses', r.businessId]">{{ r.businessName }}</a> · }
                  {{ r.serviceName || 'Servicio' }} · {{ r.createdAt | date: 'd MMM y' }}
                </span>
              </div>
              <span class="rv__stars" [attr.aria-label]="r.rating + ' de 5 estrellas'">
                @for (s of [1, 2, 3, 4, 5]; track s) {
                  <span class="material-symbols-rounded" [class.fill]="s <= r.rating" [class.is-on]="s <= r.rating">star</span>
                }
              </span>
            </div>
            @if (r.comment) { <p class="rv__text">{{ r.comment }}</p> }
            @if (r.reply) {
              <div class="rv__reply">
                <span class="material-symbols-rounded">reply</span>
                <span><strong>Respuesta del negocio</strong> {{ r.reply }}</span>
              </div>
            }
            @if (auth.canManage()) {
              <div class="rv__actions">
                <button type="button" class="btn btn--ghost btn--sm" (click)="target.set(r)">
                  <span class="material-symbols-rounded">comments_disabled</span>Retirar reseña
                </button>
              </div>
            }
          </article>
        }
        @if (data()!.totalPages > 1) {
          <div class="table-card"><app-pagination [page]="data()!.page" [size]="data()!.size" [total]="data()!.totalElements" [pages]="data()!.totalPages" (pageChange)="goTo($event)" /></div>
        }
      </div>
    }

    <app-confirm-modal
      [open]="!!target()"
      [busy]="deleting()"
      title="¿Retirar esta reseña?"
      message="Deja de verse en la app y en la web, y ya no cuenta en la media del negocio. El cliente no podrá volver a opinar hasta su próxima visita."
      confirmLabel="Retirar"
      reasonLabel="Motivo (queda en la auditoría)"
      reasonPlaceholder="Ej.: lenguaje ofensivo, reseña falsa…"
      [reasonRequired]="true"
      (confirmed)="remove($event)"
      (cancelled)="target.set(null)"
    />
  `,
  styles: `
    .rv { padding: 18px 20px; border-radius: var(--r-md); background: var(--clr-surface); }
    .rv__head { display: flex; align-items: center; gap: 12px; }
    .rv__who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .rv__name { font-weight: 700; color: var(--clr-text); text-decoration: none; }
    .rv__name:hover, .rv__biz:hover { text-decoration: underline; }
    .rv__biz { color: var(--clr-accent-text); font-weight: 600; text-decoration: none; }
    .rv__stars { display: inline-flex; }
    .rv__stars .material-symbols-rounded { font-size: 18px; color: var(--clr-text-3); }
    .rv__stars .is-on { color: #FFB020; }
    .rv__text { margin-top: 12px; font-size: 0.9375rem; line-height: 1.6; white-space: pre-wrap; }
    .rv__reply { display: flex; gap: 8px; margin-top: 12px; padding: 10px 12px; border-radius: 12px; background: var(--clr-field); font-size: 0.8125rem; color: var(--clr-text-2); }
    .rv__reply strong { color: var(--clr-text); margin-right: 4px; }
    .rv__reply .material-symbols-rounded { font-size: 18px; color: var(--clr-text-3); }
    .rv__actions { display: flex; justify-content: flex-end; margin-top: 8px; }
  `,
})
export class ReviewsList {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  readonly businessId = input<number | null>(null);
  readonly customerId = input<number | null>(null);
  readonly showFilter = input(false);

  protected readonly data = signal<PageResponse<AdminReview> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal(0);
  protected readonly target = signal<AdminReview | null>(null);
  protected readonly deleting = signal(false);
  protected readonly minMax = signal<'all' | 'low' | 'high'>('all');

  protected readonly ratingFilters = [
    { value: 'all' as const, label: 'Todas' },
    { value: 'low' as const, label: '1-2 estrellas' },
    { value: 'high' as const, label: '4-5 estrellas' },
  ];

  protected readonly visible = computed(() => {
    const list = this.data()?.content ?? [];
    switch (this.minMax()) {
      case 'low':
        return list.filter((r) => r.rating <= 2);
      case 'high':
        return list.filter((r) => r.rating >= 4);
      default:
        return list;
    }
  });

  /** Tiempo real: recarga en silencio cuando cambian estos datos. */
  private readonly live = liveReload(['reviews'], () => this.load());

  constructor() {
    effect(() => {
      this.businessId();
      this.customerId();
      untracked(() => {
        this.page.set(0);
        this.load();
      });
    });
  }

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.reviewsList({ businessId: this.businessId(), customerId: this.customerId(), page: this.page() }).subscribe({
      next: (r) => {
        this.data.set(r);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'No se han podido cargar las reseñas.'));
      },
    });
  }

  protected goTo(page: number) {
    this.page.set(page);
    this.load();
  }

  protected remove(reason: string) {
    const r = this.target();
    if (!r) return;
    this.deleting.set(true);
    this.api.deleteReview(r.id, reason || null).subscribe({
      next: () => {
        this.deleting.set(false);
        this.target.set(null);
        this.toast.success('Reseña retirada.');
        this.load();
      },
      error: (err) => {
        this.deleting.set(false);
        this.target.set(null);
        this.toast.error(err, 'No se ha podido retirar la reseña.');
      },
    });
  }
}
