import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { PortfolioImage } from '../../../core/models/admin.models';
import { AdminApi } from '../../../core/services/admin-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { ConfirmModal } from '../../../shared/components/confirm-modal/confirm-modal';
import { liveReload } from '../../../core/services/live.service';

/** Public portfolio of the business, with the option to remove a photo. */
@Component({
  selector: 'app-business-photos',
  imports: [ConfirmModal],
  template: `
    @if (error(); as e) {
      <div class="card"><div class="empty"><span class="material-symbols-rounded">cloud_off</span><p>{{ e }}</p><button type="button" class="btn" (click)="load()">Reintentar</button></div></div>
    } @else if (!images()) {
      <div class="card"><div class="empty"><span class="spinner"></span></div></div>
    } @else if (images()!.length === 0) {
      <div class="card"><div class="empty"><span class="material-symbols-rounded">photo_library</span><h3>Sin fotos</h3><p>No ha subido nada a su portfolio.</p></div></div>
    } @else {
      <div class="bp-grid">
        @for (img of images(); track img.id) {
          <figure class="bp">
            @if (img.url) {
              <a [href]="img.url" target="_blank" rel="noopener" class="bp__img"><img [src]="img.url" [alt]="img.caption || 'Foto del portfolio'" loading="lazy" /></a>
            } @else {
              <span class="bp__img bp__img--missing material-symbols-rounded">broken_image</span>
            }
            <figcaption class="bp__cap">
              <span class="t-clip">{{ img.caption || img.serviceName || 'Sin descripción' }}</span>
              @if (auth.canManage()) {
                <button type="button" class="btn btn--ghost btn--icon btn--sm" (click)="target.set(img)" aria-label="Retirar foto" title="Retirar foto">
                  <span class="material-symbols-rounded">delete</span>
                </button>
              }
            </figcaption>
          </figure>
        }
      </div>
    }

    <app-confirm-modal
      [open]="!!target()"
      [busy]="deleting()"
      title="¿Retirar esta foto?"
      message="Se borra de su portfolio y del almacenamiento. No se puede deshacer; el negocio tendría que volver a subirla."
      confirmLabel="Retirar foto"
      reasonLabel="Motivo (queda en la auditoría)"
      [reasonRequired]="true"
      (confirmed)="remove($event)"
      (cancelled)="target.set(null)"
    />
  `,
  styles: `
    .bp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .bp { margin: 0; border-radius: var(--r-md); background: var(--clr-surface); overflow: hidden; }
    .bp__img { display: block; aspect-ratio: 1; background: var(--clr-field); }
    .bp__img img { width: 100%; height: 100%; object-fit: cover; }
    .bp__img--missing { display: grid; place-items: center; font-size: 36px; color: var(--clr-text-3); }
    .bp__cap { display: flex; align-items: center; gap: 6px; padding: 6px 6px 6px 12px; font-size: 0.8125rem; color: var(--clr-text-2); }
    .bp__cap .t-clip { flex: 1; min-width: 0; }
  `,
})
export class BusinessPhotos {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  readonly businessId = input.required<number>();

  protected readonly images = signal<PortfolioImage[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly target = signal<PortfolioImage | null>(null);
  protected readonly deleting = signal(false);

  // Real time: reloads quietly when this data changes.
  private readonly live = liveReload(['businesses'], () => this.load());

  constructor() {
    effect(() => {
      this.businessId();
      untracked(() => this.load());
    });
  }

  protected load() {
    this.error.set(null);
    this.api.businessPortfolio(this.businessId()).subscribe({
      next: (i) => this.images.set(i),
      error: (err) => this.error.set(apiErrorMessage(err, 'No se han podido cargar las fotos.')),
    });
  }

  protected remove(reason: string) {
    const img = this.target();
    if (!img) return;
    this.deleting.set(true);
    this.api.deletePortfolioImage(img.id, reason || null).subscribe({
      next: () => {
        this.deleting.set(false);
        this.target.set(null);
        this.images.update((list) => list?.filter((i) => i.id !== img.id) ?? null);
        this.toast.success('Foto retirada del portfolio.');
      },
      error: (err) => {
        this.deleting.set(false);
        this.target.set(null);
        this.toast.error(err, 'No se ha podido retirar la foto.');
      },
    });
  }
}
