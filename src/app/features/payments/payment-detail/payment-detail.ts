import { DatePipe, LowerCasePipe, TitleCasePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminPaymentDetail, AuditLogEntry, RefundMethod } from '../../../core/models/admin.models';
import { AdminApi } from '../../../core/services/admin-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { apiErrorMessage, isNotFound } from '../../../core/utils/api-error';
import { formatCents, timeAgo } from '../../../core/utils/format';
import { auditAction, chargeKind, chargeStatus, refundMethod, refundStatus } from '../../../core/utils/labels';
import { ChargeDialog } from '../../../shared/components/charge-dialog/charge-dialog';
import { ConfirmModal } from '../../../shared/components/confirm-modal/confirm-modal';
import { NumberInput } from '../../../shared/components/number-input/number-input';
import { Pill } from '../../../shared/components/pill/pill';
import { liveReload } from '../../../core/services/live.service';

/** Ficha de un cobro: de dónde sale, qué se ha devuelto y qué se puede hacer. */
@Component({
  selector: 'app-payment-detail',
  imports: [DatePipe, LowerCasePipe, TitleCasePipe, RouterLink, ChargeDialog, ConfirmModal, NumberInput, Pill],
  templateUrl: './payment-detail.html',
  styleUrl: './payment-detail.scss',
})
export class PaymentDetailPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  readonly id = input.required<string>();

  protected readonly detail = signal<AdminPaymentDetail | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notFound = signal(false);
  protected readonly history = signal<AuditLogEntry[] | null>(null);

  // Devolver
  protected readonly refundOpen = signal(false);
  protected readonly refundMethodSel = signal<RefundMethod>('STRIPE');
  protected readonly refundAll = signal(true);
  protected readonly refundEuros = signal(0);
  protected readonly refundReason = signal('');
  protected readonly refundFee = signal(false);
  protected readonly refunding = signal(false);
  protected readonly refundError = signal<string | null>(null);

  // Cobrar / reintentar
  protected readonly retryOpen = signal(false);
  protected readonly retrying = signal(false);
  protected readonly chargeOpen = signal(false);

  protected readonly cents = formatCents;
  protected readonly ago = timeAgo;
  protected readonly labels = { chargeKind, chargeStatus, refundStatus, refundMethod, auditAction };

  protected readonly p = computed(() => this.detail()?.payment ?? null);

  protected readonly refundableEuros = computed(() => (this.p()?.refundableCents ?? 0) / 100);

  protected readonly refundCents = computed(() =>
    this.refundAll() ? (this.p()?.refundableCents ?? 0) : Math.round((Number.isFinite(this.refundEuros()) ? this.refundEuros() : 0) * 100),
  );

  protected readonly methodBlock = computed(() => {
    const d = this.detail();
    if (!d) return null;
    return this.refundMethodSel() === 'STRIPE' ? d.stripeRefundBlockedReason : d.manualRefundBlockedReason;
  });

  protected readonly canSubmitRefund = computed(() => {
    const c = this.refundCents();
    return !this.methodBlock() && c > 0 && c <= (this.p()?.refundableCents ?? 0) && this.refundReason().trim().length >= 3;
  });

  protected readonly canRefundAny = computed(() => !!this.detail()?.canRefundStripe || !!this.detail()?.canRefundManual);

  /** Tiempo real: recarga en silencio cuando cambian estos datos. */
  private readonly live = liveReload(['payments', 'audit'], () => this.load());

  constructor() {
    effect(() => {
      this.id();
      untracked(() => this.load());
    });
  }

  protected load() {
    const id = Number(this.id());
    this.error.set(null);
    this.notFound.set(false);
    this.api.payment(id).subscribe({
      next: (d) => this.detail.set(d),
      error: (err) => {
        if (isNotFound(err)) this.notFound.set(true);
        else this.error.set(apiErrorMessage(err, 'No se ha podido cargar el cobro.'));
      },
    });
    this.loadHistory(id);
  }

  private loadHistory(id: number) {
    this.api.auditLogFor('PAYMENT', id).subscribe({
      next: (r) => this.history.set(r.content),
      error: () => this.history.set([]),
    });
  }

  protected openRefund() {
    const d = this.detail();
    if (!d) return;
    this.refundMethodSel.set(d.canRefundStripe ? 'STRIPE' : 'MANUAL');
    this.refundAll.set(true);
    this.refundEuros.set(this.refundableEuros());
    this.refundReason.set('');
    this.refundFee.set(false);
    this.refundError.set(null);
    this.refundOpen.set(true);
  }

  protected submitRefund() {
    const d = this.detail();
    if (!d || !this.canSubmitRefund()) return;
    this.refunding.set(true);
    this.refundError.set(null);
    this.api
      .refundPayment(d.payment.id, {
        amountCents: this.refundAll() ? null : this.refundCents(),
        reason: this.refundReason().trim(),
        method: this.refundMethodSel(),
        refundApplicationFee: this.refundMethodSel() === 'STRIPE' && this.refundFee(),
      })
      .subscribe({
        next: (updated) => {
          this.refunding.set(false);
          const last = updated.refunds[0];
          if (last?.status === 'FAILED') {
            this.refundError.set(last.failureReason ?? 'Stripe no ha aceptado la devolución.');
            this.detail.set(updated);
            this.loadHistory(updated.payment.id);
            return;
          }
          this.refundOpen.set(false);
          this.detail.set(updated);
          this.loadHistory(updated.payment.id);
          this.toast.success(
            this.refundMethodSel() === 'STRIPE' ? 'Devolución enviada. Llega a la tarjeta en unos días.' : 'Devolución registrada.',
          );
        },
        error: (err) => {
          this.refunding.set(false);
          this.refundError.set(apiErrorMessage(err, 'No se ha podido devolver.'));
        },
      });
  }

  protected retry() {
    const d = this.detail();
    if (!d) return;
    this.retrying.set(true);
    this.api.retryPayment(d.payment.id).subscribe({
      next: (created) => {
        this.retrying.set(false);
        this.retryOpen.set(false);
        if (created.payment.status === 'SUCCEEDED') this.toast.success('Cobrado a la segunda.');
        else this.toast.error(created.payment.failureReason ?? 'El banco lo ha vuelto a rechazar.', 'No se ha podido cobrar');
        this.router.navigate(['/payments', created.payment.id]);
      },
      error: (err) => {
        this.retrying.set(false);
        this.retryOpen.set(false);
        this.toast.error(err, 'No se ha podido reintentar el cobro.');
      },
    });
  }

  protected onCharged(created: AdminPaymentDetail) {
    this.chargeOpen.set(false);
    this.router.navigate(['/payments', created.payment.id]);
  }
}
