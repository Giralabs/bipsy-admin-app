import { Component, effect, inject, input, output, signal } from '@angular/core';
import { AdminApi } from '../../../core/services/admin-api.service';
import { ToastService } from '../../../core/services/toast.service';

/** Push notification to the phones of a client or a business. */
@Component({
  selector: 'app-notify-dialog',
  host: { '(document:keydown.escape)': 'open() && !sending() && closed.emit()' },
  template: `
    @if (open()) {
      <div class="scrim" (click)="!sending() && closed.emit()">
        <form class="dialog" (click)="$event.stopPropagation()" (submit)="$event.preventDefault(); send()">
          <h2 class="dialog__title">Enviar un aviso a {{ name() }}</h2>
          <p class="dialog__text">Le llega como notificación en su móvil, en la app de {{ audience() }}. Úsalo para algo que tenga que saber ya.</p>
          <div class="dialog__body">
            <label class="field">
              <span class="field__label">Título</span>
              <input class="input" maxlength="80" [value]="title()" (input)="title.set($any($event.target).value)" placeholder="Ej.: Revisa tu cuenta" />
            </label>
            <label class="field">
              <span class="field__label">Mensaje</span>
              <textarea class="input" rows="3" maxlength="300" [value]="body()" (input)="body.set($any($event.target).value)"></textarea>
              <span class="field__hint">{{ body().length }}/300</span>
            </label>
          </div>
          <div class="dialog__actions">
            <button type="button" class="btn btn--ghost" (click)="closed.emit()" [disabled]="sending()">Cancelar</button>
            <button type="submit" class="btn btn--primary" [disabled]="sending() || !title().trim() || !body().trim()">
              @if (sending()) { <span class="spinner"></span> } @else { <span class="material-symbols-rounded">send</span> }
              Enviar aviso
            </button>
          </div>
        </form>
      </div>
    }
  `,
})
export class NotifyDialog {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);

  readonly open = input.required<boolean>();
  readonly actorId = input.required<number>();
  readonly name = input.required<string>();
  readonly audience = input<'Bipsy' | 'Bipsy Business'>('Bipsy');
  readonly closed = output<void>();

  protected readonly title = signal('');
  protected readonly body = signal('');
  protected readonly sending = signal(false);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.title.set('');
        this.body.set('');
      }
    });
  }

  protected send() {
    if (!this.title().trim() || !this.body().trim() || this.sending()) return;
    this.sending.set(true);
    this.api.notifyActor(this.actorId(), this.title().trim(), this.body().trim()).subscribe({
      next: (r) => {
        this.sending.set(false);
        this.toast.success(
          r.devices > 0
            ? `Aviso enviado a ${r.devices} ${r.devices === 1 ? 'dispositivo' : 'dispositivos'}.`
            : 'No tiene ningún móvil registrado: el aviso no le llegará.',
        );
        this.closed.emit();
      },
      error: (err) => {
        this.sending.set(false);
        this.toast.error(err, 'No se ha podido enviar el aviso.');
      },
    });
  }
}
