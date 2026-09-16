import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { AdminPaymentDetail } from '../../../core/models/admin.models';
import { AdminApi } from '../../../core/services/admin-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { formatCents } from '../../../core/utils/format';
import { NumberInput } from '../number-input/number-input';
import { SegmentOption, Segmented } from '../segmented/segmented';
import { Select, SelectOption } from '../select/select';

type Method = 'CARD' | 'MANUAL';

/**
 * Charges a client a booking fee, or records a payment that was made outside
 * the app.
 *
 * By card it uses the same path as the backend when the client cancels late:
 * the saved card, without the client present. If the bank requires
 * authentication or declines it, the charge is recorded as such.
 */
@Component({
  selector: 'app-charge-dialog',
  imports: [NumberInput, Segmented, Select],
  host: { '(document:keydown.escape)': 'open() && !saving() && closed.emit()' },
  template: `
    @if (open()) {
      <div class="scrim" (click)="!saving() && closed.emit()">
        <form class="dialog dialog--wide" (click)="$event.stopPropagation()" (submit)="$event.preventDefault(); save()">
          <h2 class="dialog__title">Cobrar a un cliente</h2>
          <p class="dialog__text">
            @if (bookingLabel()) { {{ bookingLabel() }}. }
            Queda en el registro de cobros y en la auditoría.
          </p>

          <div class="dialog__body">
            <div class="field">
              <span class="field__label">Cómo</span>
              <app-segmented [options]="methods" [value]="method()" (valueChange)="setMethod($event)" />
              <span class="field__hint">
                @if (method() === 'CARD') {
                  Se carga en la tarjeta guardada del cliente, en la cuenta del negocio. Si el banco pide verificación o la rechaza, queda como fallido.
                } @else {
                  No se mueve dinero: solo se registra algo que el cliente ya pagó por otra vía (en el local, Bizum, transferencia…).
                }
              </span>
            </div>

            @if (!bookingId()) {
              <label class="field">
                <span class="field__label">Nº de reserva</span>
                <input class="input" inputmode="numeric" placeholder="Ej.: 128" [value]="typedBooking()" (input)="typedBooking.set($any($event.target).value)" />
                <span class="field__hint">Lo ves en la pestaña Citas de la ficha del cliente o del negocio.</span>
              </label>
            }

            <div class="form-grid cd-grid">
              <div class="field">
                <span class="field__label">Concepto</span>
                <app-select ariaLabel="Concepto" [options]="kindOptions()" [value]="kind()" (valueChange)="kind.set($event)" />
              </div>
              <div class="field">
                <span class="field__label">Importe</span>
                <app-number-input ariaLabel="Importe en euros" [value]="euros()" (valueChange)="euros.set($event)" [min]="0.5" [max]="1000" [step]="1" [places]="2" unit="€" />
              </div>
            </div>

            <label class="field">
              <span class="field__label">Nota interna <span class="t-faint">(opcional)</span></span>
              <input class="input" maxlength="200" placeholder="Ej.: no se presentó y no avisó" [value]="note()" (input)="note.set($any($event.target).value)" />
            </label>

            @if (error(); as e) { <p class="notice notice--danger"><span class="material-symbols-rounded">error</span>{{ e }}</p> }
          </div>

          <div class="dialog__actions">
            <button type="button" class="btn btn--ghost" (click)="closed.emit()" [disabled]="saving()">Cancelar</button>
            <button type="submit" class="btn btn--primary" [disabled]="!canSave() || saving()">
              @if (saving()) { <span class="spinner"></span> }
              {{ method() === 'CARD' ? 'Cobrar ' + amountLabel() : 'Registrar ' + amountLabel() }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
  styles: `.cd-grid { grid-template-columns: minmax(0, 1fr) auto; align-items: end; }`,
})
export class ChargeDialog {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);

  readonly open = input(false);
  /** Booking already chosen (from the bookings table). Without it, the number is requested. */
  readonly bookingId = input<number | null>(null);
  readonly bookingLabel = input<string | null>(null);

  readonly closed = output<void>();
  readonly charged = output<AdminPaymentDetail>();

  protected readonly method = signal<Method>('CARD');
  protected readonly kind = signal('NO_SHOW_FEE');
  protected readonly euros = signal(10);
  protected readonly note = signal('');
  protected readonly typedBooking = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly methods: SegmentOption<Method>[] = [
    { value: 'CARD', label: 'Tarjeta guardada' },
    { value: 'MANUAL', label: 'Ya pagado, registrar' },
  ];

  protected readonly kindOptions = computed<SelectOption[]>(() => [
    { value: 'NO_SHOW_FEE', label: 'No acudió', icon: 'do_not_disturb_on' },
    { value: 'CANCELLATION_FEE', label: 'Cancelación fuera de plazo', icon: 'event_busy' },
    { value: 'RESCHEDULE_FEE', label: 'Cambio de hora fuera de plazo', icon: 'update' },
    {
      value: 'BOOKING_PAYMENT',
      label: 'Pago de la cita',
      icon: 'payments',
      hint: this.method() === 'CARD' ? 'Solo a mano: el cliente lo paga desde la app' : undefined,
      disabled: this.method() === 'CARD',
    },
  ]);

  private readonly resolvedBooking = computed(() => {
    const fixed = this.bookingId();
    if (fixed) return fixed;
    const n = Number(this.typedBooking().replace('#', '').trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  });

  protected readonly amountLabel = computed(() => (Number.isFinite(this.euros()) ? formatCents(Math.round(this.euros() * 100)) : ''));

  protected readonly canSave = computed(
    () => !!this.resolvedBooking() && Number.isFinite(this.euros()) && this.euros() >= 0.5 && this.euros() <= 1000,
  );

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.error.set(null);
        this.note.set('');
        this.typedBooking.set('');
      });
    });
  }

  protected setMethod(m: Method) {
    this.method.set(m);
    if (m === 'CARD' && this.kind() === 'BOOKING_PAYMENT') this.kind.set('NO_SHOW_FEE');
  }

  protected save() {
    const bookingId = this.resolvedBooking();
    if (!bookingId || !this.canSave()) return;
    this.saving.set(true);
    this.error.set(null);
    this.api
      .chargeBooking({
        bookingId,
        kind: this.kind(),
        amountCents: Math.round(this.euros() * 100),
        method: this.method(),
        note: this.note().trim() || null,
      })
      .subscribe({
        next: (detail) => {
          this.saving.set(false);
          const st = detail.payment.status;
          if (st === 'SUCCEEDED') this.toast.success(this.method() === 'CARD' ? 'Cobro hecho.' : 'Pago registrado.');
          else this.toast.error(detail.payment.failureReason ?? 'El banco no lo ha aceptado.', 'El cobro no se ha completado');
          this.charged.emit(detail);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(err, 'No se ha podido cobrar.'));
        },
      });
  }
}
