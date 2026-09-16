import { Component, computed, inject, signal } from '@angular/core';
import { Category } from '../../core/models/admin.models';
import { AdminApi } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/utils/api-error';
import { SegmentOption, Segmented } from '../../shared/components/segmented/segmented';
import { liveReload } from '../../core/services/live.service';

type Filter = 'ALL' | 'ACTIVE' | 'INACTIVE';

@Component({
  selector: 'app-categories',
  imports: [Segmented],
  templateUrl: './categories.html',
  styles: `
    .cat-code { font-family: ui-monospace, 'Cascadia Code', Consolas, monospace; font-size: 0.8125rem; color: var(--clr-text-2); }
    .cat-desc { max-width: 380px; color: var(--clr-text-2); }
    .cat-off td { opacity: .55; }
    .cat-off td:last-child { opacity: 1; }
  `,
})
export class Categories {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly categories = signal<Category[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<Filter>('ALL');
  protected readonly search = signal('');
  protected readonly togglingId = signal<number | null>(null);

  // Diálogo de crear / editar
  protected readonly editing = signal<Category | 'new' | null>(null);
  protected readonly formCode = signal('');
  protected readonly formName = signal('');
  protected readonly formDesc = signal('');
  protected readonly saving = signal(false);

  protected readonly options = computed<SegmentOption<Filter>[]>(() => {
    const list = this.categories() ?? [];
    return [
      { value: 'ALL', label: 'Todas', count: list.length },
      { value: 'ACTIVE', label: 'Activas', count: list.filter((c) => c.active).length },
      { value: 'INACTIVE', label: 'Inactivas', count: list.filter((c) => !c.active).length },
    ];
  });

  protected readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    return (this.categories() ?? []).filter(
      (c) =>
        (this.filter() === 'ALL' || (this.filter() === 'ACTIVE') === c.active) &&
        (!term || c.name.toLowerCase().includes(term) || c.code.toLowerCase().includes(term)),
    );
  });

  protected readonly codeValid = computed(() => /^[A-Z0-9_]{2,50}$/.test(this.formCode()));
  protected readonly formValid = computed(
    () => !!this.formName().trim() && (this.editing() !== 'new' || this.codeValid()),
  );

  /** Tiempo real: recarga en silencio cuando cambian estos datos. */
  private readonly live = liveReload(['categories'], () => this.load());

  constructor() {
    this.load();
  }

  protected load() {
    this.error.set(null);
    this.api.categories().subscribe({
      next: (c) => this.categories.set([...c].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'es'))),
      error: (err) => this.error.set(apiErrorMessage(err, 'No se han podido cargar las categorías.')),
    });
  }

  protected openNew() {
    this.formCode.set('');
    this.formName.set('');
    this.formDesc.set('');
    this.editing.set('new');
  }

  protected openEdit(c: Category) {
    this.formCode.set(c.code);
    this.formName.set(c.name);
    this.formDesc.set(c.description ?? '');
    this.editing.set(c);
  }

  /** El código se escribe como se guarda: MAYÚSCULAS_Y_GUIONES. */
  protected onCode(value: string) {
    this.formCode.set(
      value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_'),
    );
  }

  protected save() {
    const target = this.editing();
    if (!target || !this.formValid() || this.saving()) return;
    this.saving.set(true);
    const description = this.formDesc().trim() || null;

    const call =
      target === 'new'
        ? this.api.createCategory({ code: this.formCode(), name: this.formName().trim(), description })
        : this.api.updateCategory(target.id, { name: this.formName().trim(), description, active: target.active });

    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.toast.success(target === 'new' ? 'Categoría creada.' : 'Categoría guardada.');
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err, 'No se ha podido guardar.');
      },
    });
  }

  protected toggle(c: Category) {
    this.togglingId.set(c.id);
    this.api.updateCategory(c.id, { name: c.name, description: c.description, active: !c.active }).subscribe({
      next: (updated) => {
        this.togglingId.set(null);
        this.categories.update((list) => list?.map((x) => (x.id === updated.id ? updated : x)) ?? null);
        this.toast.success(updated.active ? `«${c.name}» vuelve a verse en las apps.` : `«${c.name}» ya no se muestra en las apps.`);
      },
      error: (err) => {
        this.togglingId.set(null);
        this.toast.error(err, 'No se ha podido cambiar.');
      },
    });
  }
}
