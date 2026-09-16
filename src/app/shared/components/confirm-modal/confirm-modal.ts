import { Component, effect, input, output, signal } from '@angular/core';

/**
 * Confirmation dialog. The parent controls visibility with `open`.
 * With `reasonLabel` it also asks for a text (ban reason, note…) and
 * returns it in `confirmed`.
 */
@Component({
  selector: 'app-confirm-modal',
  host: { '(document:keydown.escape)': 'open() && !busy() && cancelled.emit()' },
  template: `
    @if (open()) {
      <div class="scrim" (click)="!busy() && cancelled.emit()">
        <div class="dialog" role="alertdialog" aria-modal="true" (click)="$event.stopPropagation()">
          <h2 class="dialog__title">{{ title() }}</h2>
          <p class="dialog__text">{{ message() }}</p>

          @if (reasonLabel()) {
            <div class="dialog__body">
              <label class="field">
                <span class="field__label">{{ reasonLabel() }}</span>
                <textarea class="input" rows="3" [value]="reason()" (input)="reason.set($any($event.target).value)"
                  [placeholder]="reasonPlaceholder()" maxlength="1000"></textarea>
              </label>
            </div>
          }

          <div class="dialog__actions">
            <button type="button" class="btn btn--ghost" (click)="cancelled.emit()" [disabled]="busy()">Cancelar</button>
            <button type="button" class="btn" [class.btn--danger]="tone() === 'danger'" [class.btn--primary]="tone() !== 'danger'"
              (click)="confirmed.emit(reason().trim())" [disabled]="busy() || (reasonRequired() && !reason().trim())">
              @if (busy()) { <span class="spinner"></span> }
              {{ confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmModal {
  readonly open = input.required<boolean>();
  readonly title = input('¿Estás seguro?');
  readonly message = input('Esta acción no se puede deshacer.');
  readonly confirmLabel = input('Confirmar');
  readonly tone = input<'danger' | 'primary'>('danger');
  readonly busy = input(false);
  readonly reasonLabel = input<string | null>(null);
  readonly reasonPlaceholder = input('');
  readonly reasonRequired = input(false);

  readonly confirmed = output<string>();
  readonly cancelled = output<void>();

  protected readonly reason = signal('');

  constructor() {
    // Every time it opens, the text starts empty.
    effect(() => {
      if (this.open()) this.reason.set('');
    });
  }
}
