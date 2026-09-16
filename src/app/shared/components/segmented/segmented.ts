import { Component, computed, input, output } from '@angular/core';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  count?: number | null;
}

/**
 * Selector segmentado, port de GipsiSegmented (bipsy-web-app). El pulgar es
 * un peldaño de luminosidad, no el acento: con el pulgar de color ningún
 * texto se lee bien en los dos temas durante la animación.
 */
@Component({
  selector: 'app-segmented',
  template: `
    <div class="seg" role="tablist">
      <span class="seg__thumb" [style.width]="thumbWidth()" [style.transform]="thumbTransform()" aria-hidden="true"></span>
      @for (o of options(); track o.value) {
        <button type="button" role="tab" class="seg__item" [class.seg__item--on]="o.value === value()"
          [attr.aria-selected]="o.value === value()" (click)="o.value !== value() && valueChange.emit(o.value)">
          {{ o.label }}
          @if (o.count != null) { <span class="seg__count">{{ o.count }}</span> }
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    /* Rejilla de columnas iguales (1fr) y no flex: con flex, cada opción medía
       lo que su texto y el pulgar, que se calcula como un hueco igual, no
       coincidía con la opción elegida. Así todas miden lo que la más larga. */
    .seg {
      position: relative; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr);
      height: 38px; padding: 3px; border-radius: 12px; background: var(--clr-subtle); isolation: isolate;
    }
    .seg__thumb {
      position: absolute; top: 3px; bottom: 3px; left: 3px; border-radius: 9px;
      background: var(--clr-surface-2); z-index: 0; transition: transform .22s cubic-bezier(.4,0,.2,1);
    }
    :host-context([data-theme='light']) .seg__thumb { background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
    .seg__item {
      position: relative; z-index: 1; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      border: none; background: none; padding: 0 12px; border-radius: 9px; cursor: pointer;
      font-size: 0.8125rem; font-weight: 600; color: var(--clr-text-2); white-space: nowrap;
      transition: color .2s ease;
    }
    .seg__item:focus-visible { outline: 2px solid var(--clr-accent); outline-offset: -2px; border-radius: 9px; }
    .seg__item--on { color: var(--clr-accent-text); font-weight: 700; }
    :host-context([data-theme='light']) .seg__item--on { color: var(--clr-text); }
    .seg__count { font-size: 0.6875rem; font-weight: 700; color: var(--clr-text-3); font-variant-numeric: tabular-nums; }
  `,
})
export class Segmented<T extends string = string> {
  readonly options = input.required<SegmentOption<T>[]>();
  readonly value = input.required<T>();
  readonly valueChange = output<T>();

  private readonly index = computed(() => Math.max(0, this.options().findIndex((o) => o.value === this.value())));
  // La pista tiene 3 px de relleno a cada lado: el pulgar mide un hueco de lo que queda.
  protected readonly thumbWidth = computed(() => `calc((100% - 6px) / ${Math.max(1, this.options().length)})`);
  protected readonly thumbTransform = computed(() => `translateX(${this.index() * 100}%)`);
}
