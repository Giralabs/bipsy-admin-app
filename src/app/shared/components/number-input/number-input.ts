import { Component, computed, input, output } from '@angular/core';

/**
 * Campo numérico con botones − y +. Las flechas del <input type=number>
 * nativo son diminutas, cambian de aspecto en cada navegador y no respetan
 * el tema; estas se pueden pulsar con el dedo.
 *
 * Mantener pulsado no repite a propósito: los topes de estos ajustes son
 * grandes (hasta 3650) y se escriben antes que se pulsan.
 */
@Component({
  selector: 'app-number-input',
  template: `
    <span class="num" [class.is-bad]="outOfRange()" [class.is-disabled]="disabled()">
      <button type="button" class="num__btn" (click)="bump(-1)" [disabled]="disabled() || atMin()"
        [attr.aria-label]="'Menos ' + (unit() || '')" tabindex="-1">
        <span class="material-symbols-rounded">remove</span>
      </button>
      <input class="num__input" type="text" inputmode="decimal" [value]="display()" [disabled]="disabled()"
        [attr.aria-label]="ariaLabel()" role="spinbutton"
        [attr.aria-valuemin]="min()" [attr.aria-valuemax]="max()" [attr.aria-valuenow]="value()"
        (input)="onInput($any($event.target).value)" (blur)="onBlur($any($event.target))"
        (keydown.arrowup)="$event.preventDefault(); bump(1)" (keydown.arrowdown)="$event.preventDefault(); bump(-1)" />
      <button type="button" class="num__btn" (click)="bump(1)" [disabled]="disabled() || atMax()"
        [attr.aria-label]="'Más ' + (unit() || '')" tabindex="-1">
        <span class="material-symbols-rounded">add</span>
      </button>
      @if (unit()) { <span class="num__unit">{{ unit() }}</span> }
    </span>
  `,
  styles: `
    :host { display: inline-flex; flex-shrink: 0; }
    .num {
      display: inline-flex; align-items: center; gap: 2px; height: 42px; padding: 3px;
      border-radius: 14px; background: var(--clr-field); transition: box-shadow .18s ease;
    }
    .num:focus-within { box-shadow: inset 0 0 0 1.5px var(--clr-accent); }
    .num.is-bad { box-shadow: inset 0 0 0 1.5px var(--clr-danger); }
    .num.is-disabled { opacity: .55; }
    .num__btn {
      width: 36px; height: 36px; border: none; border-radius: 11px; background: transparent;
      color: var(--clr-text-2); display: grid; place-items: center; cursor: pointer;
      transition: background-color .15s ease, color .15s ease, transform .1s ease;
    }
    .num__btn:hover:not(:disabled) { background: var(--clr-subtle); color: var(--clr-text); }
    .num__btn:active:not(:disabled) { transform: scale(.92); }
    .num__btn:disabled { opacity: .35; cursor: not-allowed; }
    .num__btn .material-symbols-rounded { font-size: 18px; }
    .num__input {
      width: 58px; height: 100%; border: none; background: none; outline: none; text-align: center;
      color: var(--clr-text); font-size: 0.9375rem; font-weight: 700; font-variant-numeric: tabular-nums;
    }
    /* Ancho fijo: con unidades de distinto largo ("km", "reseñas") los campos
       de una misma lista quedaban desalineados. */
    .num__unit { padding: 0 10px 0 4px; font-size: 0.8125rem; font-weight: 600; color: var(--clr-text-3); width: 72px; }
  `,
})
export class NumberInput {
  readonly value = input.required<number>();
  readonly min = input(0);
  readonly max = input(Number.MAX_SAFE_INTEGER);
  readonly step = input(1);
  readonly unit = input<string | null>(null);
  readonly disabled = input(false);
  readonly ariaLabel = input<string | null>(null);
  /** Decimales a mostrar. Por defecto, los del paso (paso 0,5 → uno). */
  readonly places = input<number | null>(null);

  readonly valueChange = output<number>();

  private readonly decimals = computed(() => this.places() ?? (String(this.step()).split('.')[1] ?? '').length);

  protected readonly display = computed(() => {
    const v = this.value();
    if (!Number.isFinite(v)) return '';
    return this.decimals() ? v.toFixed(this.decimals()).replace('.', ',') : String(v);
  });
  protected readonly outOfRange = computed(() => {
    const v = this.value();
    return !Number.isFinite(v) || v < this.min() || v > this.max();
  });
  protected readonly atMin = computed(() => Number.isFinite(this.value()) && this.value() <= this.min());
  protected readonly atMax = computed(() => Number.isFinite(this.value()) && this.value() >= this.max());

  protected bump(direction: 1 | -1) {
    const base = Number.isFinite(this.value()) ? this.value() : this.min();
    const next = this.clamp(this.round(base + direction * this.step()));
    if (next !== this.value()) this.valueChange.emit(next);
  }

  protected onInput(raw: string) {
    const cleaned = raw.replace(',', '.').replace(/[^\d.-]/g, '');
    const n = cleaned === '' ? NaN : Number(cleaned);
    this.valueChange.emit(n);
  }

  /** Al salir, lo escrito se ajusta a los topes y a los decimales del paso. */
  protected onBlur(el: HTMLInputElement) {
    const v = this.value();
    if (!Number.isFinite(v)) {
      this.valueChange.emit(this.min());
      return;
    }
    const fixed = this.clamp(this.round(v));
    if (fixed !== v) this.valueChange.emit(fixed);
    else el.value = this.display();
  }

  private clamp(n: number) {
    return Math.min(this.max(), Math.max(this.min(), n));
  }

  private round(n: number) {
    const f = 10 ** this.decimals();
    return Math.round(n * f) / f;
  }
}
