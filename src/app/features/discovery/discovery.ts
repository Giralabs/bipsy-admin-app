import { Component, computed, inject, signal } from '@angular/core';
import { DiscoverySettings } from '../../core/models/admin.models';
import { AdminApi } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/utils/api-error';
import { NumberInput } from '../../shared/components/number-input/number-input';
import { liveReload } from '../../core/services/live.service';

type Key = keyof DiscoverySettings;

interface FieldDef {
  key: Key;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  hint: string;
}

/** Mismos topes que UpdateDiscoverySettingsRequest en el backend. */
const FEATURED: FieldDef[] = [
  { key: 'minRating', label: 'Nota mínima', unit: '★', min: 0, max: 5, step: 0.1, hint: 'Media de reseñas que hay que tener.' },
  { key: 'minReviews', label: 'Reseñas mínimas', unit: 'reseñas', min: 0, max: 1000, step: 1, hint: 'Para que un 5,0 de una sola opinión no adelante a un 4,6 de ochenta.' },
  { key: 'minReferrals', label: 'Referidos mínimos', unit: 'clientes', min: 0, max: 1000, step: 1, hint: 'Clientes traídos con su código.' },
];

const DISTANCE: FieldDef[] = [
  { key: 'featuredBandKm', label: 'Ancho de cada franja', unit: 'km', min: 1, max: 500, step: 1, hint: 'Los destacados se ordenan por franjas de distancia; dentro de cada una van primero los de plan Quality.' },
  { key: 'featuredMaxDistanceKm', label: 'Distancia máxima', unit: 'km', min: 1, max: 500, step: 1, hint: 'Hasta dónde se busca un destacado. Alto mientras el catálogo sea pequeño.' },
];

const NEW: FieldDef[] = [
  { key: 'newBusinessDays', label: 'Negocio «nuevo» durante', unit: 'días', min: 1, max: 3650, step: 1, hint: 'Desde el alta, cuánto tiempo sale en la fila de novedades.' },
];

@Component({
  selector: 'app-discovery',
  imports: [NumberInput],
  templateUrl: './discovery.html',
  styleUrl: './discovery.scss',
})
export class Discovery {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly saved = signal<DiscoverySettings | null>(null);
  protected readonly form = signal<DiscoverySettings | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly sections = [
    { title: 'Destacados por méritos', footer: 'Hacen falta las tres cosas a la vez. Los negocios con plan Quality salen destacados igualmente.', fields: FEATURED },
    { title: 'Distancia', footer: null, fields: DISTANCE },
    { title: 'Novedades', footer: null, fields: NEW },
  ];

  protected readonly dirty = computed(() => {
    const a = this.saved();
    const b = this.form();
    return !!a && !!b && (Object.keys(a) as Key[]).some((k) => Number(a[k]) !== Number(b[k]));
  });

  protected readonly invalid = computed(() => {
    const f = this.form();
    if (!f) return true;
    return [...FEATURED, ...DISTANCE, ...NEW].some((d) => {
      const v = Number(f[d.key]);
      return !Number.isFinite(v) || v < d.min || v > d.max;
    });
  });

  protected readonly summary = computed(() => {
    const f = this.form();
    if (!f) return '';
    const rating = Number(f.minRating).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `Sale destacado quien tenga al menos ${rating} ★ con ${f.minReviews} reseñas y ${f.minReferrals} referidos, a menos de ${f.featuredMaxDistanceKm} km del cliente. Es «nuevo» durante ${f.newBusinessDays} días.`;
  });

  /** Tiempo real: recarga en silencio cuando cambian estos datos. */
  private readonly live = liveReload(['discovery'], () => { if (!this.dirty()) this.load(); });

  constructor() {
    this.load();
  }

  protected load() {
    this.error.set(null);
    this.api.discoverySettings().subscribe({
      next: (s) => {
        const normalized = { ...s, minRating: Number(s.minRating) };
        this.saved.set(normalized);
        this.form.set({ ...normalized });
      },
      error: (err) => this.error.set(apiErrorMessage(err, 'No se han podido cargar los ajustes.')),
    });
  }

  protected value(key: Key): number {
    return Number(this.form()?.[key] ?? 0);
  }

  protected setNumber(key: Key, n: number) {
    this.form.update((f) => (f ? { ...f, [key]: n } : f));
  }

  protected reset() {
    const s = this.saved();
    if (s) this.form.set({ ...s });
  }

  protected save() {
    const f = this.form();
    if (!f || this.invalid() || this.saving()) return;
    this.saving.set(true);
    this.api
      .updateDiscoverySettings({
        ...f,
        minRating: Math.round(Number(f.minRating) * 10) / 10,
      })
      .subscribe({
        next: (s) => {
          const normalized = { ...s, minRating: Number(s.minRating) };
          this.saved.set(normalized);
          this.form.set({ ...normalized });
          this.saving.set(false);
          this.toast.success('Ajustes guardados. Explorar los aplica en la siguiente carga.');
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(err, 'No se han podido guardar.');
        },
      });
  }
}
