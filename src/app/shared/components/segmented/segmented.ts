import { Component, computed, input, output } from '@angular/core';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  count?: number | null;
}

/**
 * Segmented control, ported from GipsiSegmented (bipsy-web-app). The thumb is
 * a lightness step, not the accent: with a coloured thumb no text reads well
 * in both themes during the animation.
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
    /* Grid of equal columns (1fr) instead of flex: with flex, each option was
       as wide as its text and the thumb, calculated as an equal slot, did not
       match the chosen option. This way all of them are as wide as the longest. */
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
  // The track has 3 px of padding on each side: the thumb is one slot of what remains.
  protected readonly thumbWidth = computed(() => `calc((100% - 6px) / ${Math.max(1, this.options().length)})`);
  protected readonly thumbTransform = computed(() => `translateX(${this.index() * 100}%)`);
}
