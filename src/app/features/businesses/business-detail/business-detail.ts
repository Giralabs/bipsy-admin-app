import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmModal } from '../../../shared/components/confirm-modal/confirm-modal';
import { BusinessDetail } from '../models/business.model';
import { BusinessSubscription, Plan } from '../models/subscription.model';
import { BusinessesService } from '../businesses.service';

@Component({
  selector: 'app-business-detail',
  standalone: true,
  imports: [RouterLink, ConfirmModal, DatePipe, FormsModule],
  templateUrl: './business-detail.html',
  styleUrl: './business-detail.scss',
})
export class BusinessDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly businessesService = inject(BusinessesService);
  protected readonly auth = inject(AuthService);

  readonly businessId = Number(this.route.snapshot.paramMap.get('id'));
  readonly business = signal<BusinessDetail | null>(null);
  readonly loading = signal(true);

  readonly showBanConfirm = signal(false);
  readonly working = signal(false);

  readonly subscriptions = signal<BusinessSubscription[]>([]);
  readonly plans = signal<Plan[]>([]);
  readonly loadingSubscriptions = signal(false);
  readonly assigningPlan = signal(false);
  readonly cancellingId = signal<number | null>(null);
  selectedPlanCode = '';

  constructor() {
    this.load();
    this.loadSubscriptions();
    this.businessesService.listPlans().subscribe((plans) => this.plans.set(plans));
  }

  load() {
    this.loading.set(true);
    this.businessesService.getDetail(this.businessId).subscribe({
      next: (b) => {
        this.business.set(b);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  confirmBan() {
    this.working.set(true);
    this.businessesService.ban(this.businessId).subscribe({
      next: () => {
        this.showBanConfirm.set(false);
        this.working.set(false);
        this.load();
      },
      error: () => this.working.set(false),
    });
  }

  unban() {
    this.working.set(true);
    this.businessesService.unban(this.businessId).subscribe({
      next: () => {
        this.working.set(false);
        this.load();
      },
      error: () => this.working.set(false),
    });
  }

  // === SUSCRIPCIONES ============================================================

  loadSubscriptions() {
    this.loadingSubscriptions.set(true);
    this.businessesService.listSubscriptions(this.businessId).subscribe({
      next: (subs) => {
        this.subscriptions.set(subs);
        this.loadingSubscriptions.set(false);
      },
      error: () => this.loadingSubscriptions.set(false),
    });
  }

  assignPlan() {
    if (!this.selectedPlanCode) return;
    this.assigningPlan.set(true);
    this.businessesService.assignPlan(this.businessId, this.selectedPlanCode).subscribe({
      next: () => {
        this.assigningPlan.set(false);
        this.selectedPlanCode = '';
        this.loadSubscriptions();
      },
      error: () => this.assigningPlan.set(false),
    });
  }

  cancelSubscription(id: number) {
    this.cancellingId.set(id);
    this.businessesService.cancelSubscription(id).subscribe({
      next: () => {
        this.cancellingId.set(null);
        this.loadSubscriptions();
      },
      error: () => this.cancellingId.set(null),
    });
  }
}
