import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ConfirmModal } from '../../../shared/components/confirm-modal/confirm-modal';
import { ReputationBadge } from '../../../shared/components/reputation-badge/reputation-badge';
import { CustomerDetail, SanctionRequest } from '../models/customer.model';
import { UsersService } from '../users.service';

type Tab = 'perfil' | 'interacciones' | 'sanciones' | 'pagos';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ReputationBadge, ConfirmModal, DatePipe],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.scss',
})
export class UserDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly usersService = inject(UsersService);
  private readonly fb = inject(FormBuilder);

  readonly customerId = Number(this.route.snapshot.paramMap.get('id'));
  readonly customer = signal<CustomerDetail | null>(null);
  readonly loading = signal(true);
  readonly tab = signal<Tab>('perfil');

  readonly showResetConfirm = signal(false);
  readonly resetting = signal(false);

  readonly showSanctionForm = signal(false);
  readonly sanctioning = signal(false);
  readonly liftingSanctionId = signal<number | null>(null);

  readonly sanctionForm = this.fb.nonNullable.group({
    type: 'SUSPENSION' as 'SUSPENSION' | 'BAN',
    reason: '',
    durationPreset: '7',
    customEndsAt: '',
  });

  readonly isSuspension = computed(() => this.sanctionForm.controls.type.value === 'SUSPENSION');

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.usersService.getDetail(this.customerId).subscribe({
      next: (c) => {
        this.customer.set(c);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // === RESTABLECER CUENTA ======================================================

  confirmReset() {
    this.resetting.set(true);
    this.usersService.resetAccount(this.customerId).subscribe({
      next: () => {
        this.showResetConfirm.set(false);
        this.resetting.set(false);
        this.load();
      },
      error: () => this.resetting.set(false),
    });
  }

  // === SANCIONES ===============================================================

  submitSanction() {
    const raw = this.sanctionForm.getRawValue();
    const req: SanctionRequest = {
      type: raw.type,
      reason: raw.reason || null,
      endsAt: raw.type === 'BAN' ? null : this.resolveEndsAt(raw.durationPreset, raw.customEndsAt),
      extraIps: null,
    };
    this.sanctioning.set(true);
    this.usersService.sanction(this.customerId, req).subscribe({
      next: () => {
        this.sanctioning.set(false);
        this.showSanctionForm.set(false);
        this.sanctionForm.reset({ type: 'SUSPENSION', reason: '', durationPreset: '7', customEndsAt: '' });
        this.load();
      },
      error: () => this.sanctioning.set(false),
    });
  }

  private resolveEndsAt(preset: string, customEndsAt: string): string {
    if (preset === 'custom') return new Date(customEndsAt).toISOString();
    const days = Number(preset);
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }

  liftSanction(sanctionId: number) {
    this.liftingSanctionId.set(sanctionId);
    this.usersService.liftSanction(this.customerId, sanctionId).subscribe({
      next: () => {
        this.liftingSanctionId.set(null);
        this.load();
      },
      error: () => this.liftingSanctionId.set(null),
    });
  }

  // === PAGOS ===================================================================

  formatAmount(cents: number, currency: string): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  }
}
