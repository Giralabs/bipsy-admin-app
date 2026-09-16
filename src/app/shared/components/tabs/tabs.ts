import { Component, input, output } from '@angular/core';

export interface TabOption<T extends string = string> {
  value: T;
  label: string;
  icon?: string;
  count?: number | null;
}

/**
 * Pestañas de una ficha. El segmentado sirve para 2-5 opciones del mismo
 * peso; una ficha con diez apartados necesita pestañas que se desplacen y no
 * se aprieten hasta cortar el texto.
 */
@Component({
  selector: 'app-tabs',
  template: `
    <nav class="tabs" role="tablist">
      @for (t of options(); track t.value) {
        <button type="button" role="tab" class="tab" [class.is-on]="t.value === value()"
          [attr.aria-selected]="t.value === value()" (click)="t.value !== value() && valueChange.emit(t.value)">
          @if (t.icon) { <span class="material-symbols-rounded">{{ t.icon }}</span> }
          {{ t.label }}
          @if (t.count != null) { <span class="tab__count">{{ t.count }}</span> }
        </button>
      }
    </nav>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .tabs {
      display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none;
      padding: 4px; border-radius: 16px; background: var(--clr-band);
    }
    .tabs::-webkit-scrollbar { display: none; }
    .tab {
      flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px;
      height: 38px; padding: 0 14px; border: none; border-radius: 12px; background: none;
      color: var(--clr-text-2); font-size: 0.8125rem; font-weight: 600; white-space: nowrap; cursor: pointer;
      transition: background-color .18s ease, color .18s ease;
    }
    .tab:hover { background: var(--clr-field); color: var(--clr-text); }
    .tab.is-on { background: var(--clr-surface-2); color: var(--clr-accent-text); font-weight: 700; }
    :host-context([data-theme='light']) .tab.is-on { background: #fff; color: var(--clr-text); box-shadow: 0 1px 2px rgba(0,0,0,.06); }
    .tab .material-symbols-rounded { font-size: 18px; }
    .tab__count {
      min-width: 20px; height: 18px; padding: 0 6px; border-radius: 999px; background: var(--clr-subtle);
      font-size: 0.6875rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class Tabs<T extends string = string> {
  readonly options = input.required<TabOption<T>[]>();
  readonly value = input.required<T>();
  readonly valueChange = output<T>();
}
