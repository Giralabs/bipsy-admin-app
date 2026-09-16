import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Tone } from '../../../core/utils/labels';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** Segunda línea en gris, dentro del menú. */
  hint?: string;
  icon?: string;
  /** Punto de color delante (estados, prioridades). */
  tone?: Tone;
  disabled?: boolean;
}

let nextId = 0;

/**
 * Desplegable propio. El <select> nativo pinta el menú del sistema (azul en
 * Windows, ignora el tema y la tipografía) y no se puede estilar; este se ve
 * como el resto del panel y se maneja igual con teclado:
 *
 *  - Flechas, Inicio/Fin para moverse; Enter o Espacio para elegir.
 *  - Escape cierra solo el menú, no el diálogo que lo contiene.
 *  - Una letra salta a la primera opción que empieza por ella.
 *  - Con muchas opciones aparece un buscador arriba.
 *
 * El menú va en position: fixed calculado desde el disparador, así no lo
 * recorta el overflow de una tarjeta o de un diálogo, y se abre hacia arriba
 * si abajo no cabe.
 */
@Component({
  selector: 'app-select',
  host: {
    '(document:mousedown)': 'onDocumentDown($event)',
    '(window:resize)': 'close()',
    '(window:scroll)': 'onScroll($event)',
    '[class.is-block]': 'block()',
  },
  templateUrl: './select.html',
  styleUrl: './select.scss',
})
export class Select<T extends string = string> {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly options = input.required<SelectOption<T>[]>();
  readonly value = input<T | '' | null>(null);
  readonly placeholder = input('Elige una opción…');
  readonly disabled = input(false);
  readonly size = input<'md' | 'sm'>('md');
  /** Ocupa todo el ancho de su contenedor (en formularios). */
  readonly block = input(true);
  readonly ariaLabel = input<string | null>(null);
  /** null = automático (más de 8 opciones). */
  readonly searchable = input<boolean | null>(null);

  readonly valueChange = output<T>();

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('search');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly id = `sel-${++nextId}`;
  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  protected readonly query = signal('');
  protected readonly panelStyle = signal<Record<string, string>>({});
  protected readonly dropUp = signal(false);

  protected readonly selected = computed(() => this.options().find((o) => o.value === this.value()) ?? null);
  protected readonly showSearch = computed(() => this.searchable() ?? this.options().length > 8);

  protected readonly filtered = computed(() => {
    const q = normalize(this.query().trim());
    if (!q) return this.options();
    return this.options().filter((o) => normalize(o.label).includes(q) || normalize(o.hint ?? '').includes(q));
  });

  private typeBuffer = '';
  private typeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Si cambian las opciones con el menú abierto, el activo no puede quedar fuera.
    effect(() => {
      const count = this.filtered().length;
      untracked(() => {
        if (this.active() >= count) this.active.set(count - 1);
      });
    });
  }

  // === ABRIR Y CERRAR ========================================================

  protected toggle() {
    if (this.open()) this.close();
    else this.openMenu();
  }

  protected openMenu() {
    if (this.disabled() || this.open()) return;
    this.query.set('');
    this.position();
    const idx = this.filtered().findIndex((o) => o.value === this.value());
    this.active.set(idx >= 0 ? idx : this.firstEnabled(0, 1));
    this.open.set(true);
    setTimeout(() => {
      if (this.showSearch()) this.searchInput()?.nativeElement.focus();
      else this.list()?.nativeElement.focus();
      this.scrollActive();
    });
  }

  close(refocus = false) {
    if (!this.open()) return;
    this.open.set(false);
    if (refocus) this.trigger()?.nativeElement.focus();
  }

  protected choose(option: SelectOption<T>) {
    if (option.disabled) return;
    this.close(true);
    if (option.value !== this.value()) this.valueChange.emit(option.value);
  }

  protected onDocumentDown(event: MouseEvent) {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  protected onScroll(event: Event) {
    // Desplazarse dentro del propio menú no lo cierra; la página, sí.
    if (!this.open()) return;
    const listEl = this.list()?.nativeElement;
    if (listEl && event.target instanceof Node && listEl.contains(event.target)) return;
    this.close();
  }

  // === TECLADO ===============================================================

  protected onTriggerKeydown(event: KeyboardEvent) {
    if (this.disabled()) return;
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      this.openMenu();
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      // Escribir con el menú cerrado cambia directamente, como el nativo.
      const match = this.matchTyped(event.key);
      if (match) this.valueChange.emit(match.value);
    }
  }

  protected onMenuKeydown(event: KeyboardEvent) {
    const count = this.filtered().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.active.set(this.firstEnabled(this.active() + 1, 1));
        this.scrollActive();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.active.set(this.firstEnabled(this.active() - 1, -1));
        this.scrollActive();
        break;
      case 'Home':
        if (event.target === this.searchInput()?.nativeElement) return;
        event.preventDefault();
        this.active.set(this.firstEnabled(0, 1));
        this.scrollActive();
        break;
      case 'End':
        if (event.target === this.searchInput()?.nativeElement) return;
        event.preventDefault();
        this.active.set(this.firstEnabled(count - 1, -1));
        this.scrollActive();
        break;
      case 'Enter': {
        event.preventDefault();
        const option = this.filtered()[this.active()];
        if (option) this.choose(option);
        break;
      }
      case ' ':
        if (event.target === this.searchInput()?.nativeElement) return;
        event.preventDefault();
        if (this.filtered()[this.active()]) this.choose(this.filtered()[this.active()]);
        break;
      case 'Escape':
        // Que el Escape no llegue al diálogo que envuelve al desplegable.
        event.preventDefault();
        event.stopPropagation();
        this.close(true);
        break;
      case 'Tab':
        this.close();
        break;
      default:
        if (!this.showSearch() && event.key.length === 1 && /\S/.test(event.key)) {
          const match = this.matchTyped(event.key);
          if (match) {
            this.active.set(this.filtered().indexOf(match));
            this.scrollActive();
          }
        }
    }
  }

  protected onSearch(value: string) {
    this.query.set(value);
    this.active.set(this.firstEnabled(0, 1));
  }

  // === HELPERS ===============================================================

  private position() {
    const el = this.trigger()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuHeight = Math.min(320, this.options().length * 44 + (this.showSearch() ? 56 : 0) + 12);
    const below = window.innerHeight - rect.bottom;
    const up = below < menuHeight + 12 && rect.top > below;
    this.dropUp.set(up);
    const width = Math.max(rect.width, 200);
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    this.panelStyle.set({
      left: `${Math.max(8, left)}px`,
      width: `${width}px`,
      ...(up ? { bottom: `${window.innerHeight - rect.top + 6}px` } : { top: `${rect.bottom + 6}px` }),
    });
  }

  private firstEnabled(from: number, step: 1 | -1): number {
    const list = this.filtered();
    if (!list.length) return -1;
    let i = Math.max(0, Math.min(list.length - 1, from));
    for (let n = 0; n < list.length; n++) {
      if (!list[i].disabled) return i;
      i = (i + step + list.length) % list.length;
    }
    return -1;
  }

  private matchTyped(key: string): SelectOption<T> | undefined {
    clearTimeout(this.typeTimer);
    this.typeBuffer += normalize(key);
    this.typeTimer = setTimeout(() => (this.typeBuffer = ''), 600);
    return this.filtered().find((o) => !o.disabled && normalize(o.label).startsWith(this.typeBuffer));
  }

  private scrollActive() {
    setTimeout(() => {
      this.list()?.nativeElement.querySelector<HTMLElement>(`#${this.id}-opt-${this.active()}`)?.scrollIntoView({ block: 'nearest' });
    });
  }
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
