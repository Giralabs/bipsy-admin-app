import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { Feature, GrantTargetType, Plan } from '../../core/models/admin.models';
import { AdminApi } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import { SegmentOption, Segmented } from '../../shared/components/segmented/segmented';
import { Select, SelectOption } from '../../shared/components/select/select';

/**
 * Conceder acceso gratis: un plan entero o una función suelta, a un negocio
 * (`businessId`) o a todos (sin `businessId`). POST /admin/grants.
 */
@Component({
  selector: 'app-grant-dialog',
  imports: [Segmented, Select],
  host: { '(document:keydown.escape)': 'open() && !saving() && cancelled.emit()' },
  template: `
    @if (open()) {
      <div class="scrim" (click)="!saving() && cancelled.emit()">
        <form class="dialog dialog--wide" (click)="$event.stopPropagation()" (submit)="$event.preventDefault(); save()">
          <h2 class="dialog__title">{{ businessId() ? 'Oferta para ' + businessName() : 'Oferta para todos los negocios' }}</h2>
          <p class="dialog__text">
            {{ businessId() ? 'Acceso gratis solo para este negocio.' : 'Se aplica a todos los negocios de Bipsy Business a la vez.' }}
            No genera cobros ni toca su suscripción.
          </p>

          <div class="dialog__body">
            <app-segmented [options]="targetOptions" [value]="target()" (valueChange)="target.set($event)" />

            @if (target() === 'PLAN') {
              <div class="field">
                <span class="field__label">Plan</span>
                <app-select ariaLabel="Plan" placeholder="Elige un plan…" [options]="planOptions()" [value]="planCode()" (valueChange)="planCode.set($event)" />
              </div>
            } @else {
              <div class="field">
                <span class="field__label">Función</span>
                @if (features().length) {
                  <app-select ariaLabel="Función" placeholder="Elige una función…" [options]="featureOptions()" [value]="featureCode()" (valueChange)="featureCode.set($event)" />
                } @else {
                  <span class="field__hint">No se ha podido leer el catálogo (GET /admin/features). Escribe el código:</span>
                  <input class="input t-mono" placeholder="PRIORITY_REQUESTS" [value]="featureCode()" (input)="featureCode.set($any($event.target).value.toUpperCase())" />
                }
              </div>
            }

            <div class="form-grid">
              <label class="field">
                <span class="field__label">Desde</span>
                <input class="input" type="date" [value]="from()" (input)="from.set($any($event.target).value)" />
              </label>
              <label class="field">
                <span class="field__label">Hasta</span>
                <input class="input" type="date" [value]="until()" (input)="until.set($any($event.target).value)" [min]="from()" />
                <span class="field__hint">Vacío = sin fecha de fin.</span>
              </label>
            </div>

            <label class="field">
              <span class="field__label">Nota interna</span>
              <input class="input" maxlength="500" placeholder="Ej.: acuerdo con la franquicia, campaña de verano…" [value]="note()" (input)="note.set($any($event.target).value)" />
            </label>
          </div>

          <div class="dialog__actions">
            <button type="button" class="btn btn--ghost" (click)="cancelled.emit()" [disabled]="saving()">Cancelar</button>
            <button type="submit" class="btn btn--primary" [disabled]="!valid() || saving()">
              @if (saving()) { <span class="spinner"></span> }
              Conceder
            </button>
          </div>
        </form>
      </div>
    }
  `,
})
export class GrantDialog {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly businessId = input<number | null>(null);
  readonly businessName = input<string | null>(null);
  readonly plans = input<Plan[]>([]);
  readonly features = input<Feature[]>([]);

  readonly created = output<void>();
  readonly cancelled = output<void>();

  protected readonly target = signal<GrantTargetType>('PLAN');
  protected readonly planCode = signal('');
  protected readonly featureCode = signal('');
  protected readonly from = signal('');
  protected readonly until = signal('');
  protected readonly note = signal('');
  protected readonly saving = signal(false);

  protected readonly targetOptions: SegmentOption<GrantTargetType>[] = [
    { value: 'PLAN', label: 'Un plan entero' },
    { value: 'FEATURE', label: 'Una función' },
  ];

  protected readonly planOptions = computed<SelectOption[]>(() =>
    this.plans().map((p) => ({ value: p.code, label: p.name, hint: p.description ?? undefined, icon: 'workspace_premium' })),
  );
  protected readonly featureOptions = computed<SelectOption[]>(() =>
    this.features().map((f) => ({ value: f.code, label: f.name, hint: f.description ?? undefined })),
  );

  protected readonly valid = computed(() => {
    const hasTarget = this.target() === 'PLAN' ? !!this.planCode() : !!this.featureCode().trim();
    const rangeOk = !this.until() || !this.from() || this.until() >= this.from();
    return hasTarget && rangeOk;
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.target.set('PLAN');
        this.planCode.set('');
        this.featureCode.set('');
        this.from.set(new Date().toISOString().slice(0, 10));
        this.until.set('');
        this.note.set('');
      }
    });
  }

  protected save() {
    if (!this.valid() || this.saving()) return;
    const today = new Date().toISOString().slice(0, 10);
    const businessId = this.businessId();

    this.saving.set(true);
    this.api
      .createGrant({
        scope: businessId ? 'BUSINESS' : 'GLOBAL',
        businessId,
        targetType: this.target(),
        planCode: this.target() === 'PLAN' ? this.planCode() : null,
        featureCode: this.target() === 'FEATURE' ? this.featureCode().trim() : null,
        // Hoy = desde ya (el backend pone "ahora"); otro día, desde su medianoche.
        validFrom: this.from() && this.from() !== today ? new Date(this.from() + 'T00:00:00').toISOString() : null,
        validUntil: this.until() ? new Date(this.until() + 'T23:59:59').toISOString() : null,
        note: this.note().trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success('Oferta concedida.');
          this.created.emit();
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(err, 'No se ha podido conceder la oferta.');
        },
      });
  }
}
