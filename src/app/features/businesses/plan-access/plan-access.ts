import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { BusinessAccess, BusinessSubscription, Plan } from '../../../core/models/admin.models';
import { AdminApi } from '../../../core/services/admin-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { apiErrorMessage, isNotFound } from '../../../core/utils/api-error';
import { formatEur } from '../../../core/utils/format';
import { accessState, billingInterval, subscriptionSource, subscriptionStatus } from '../../../core/utils/labels';
import { ConfirmModal } from '../../../shared/components/confirm-modal/confirm-modal';
import { Pill } from '../../../shared/components/pill/pill';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { liveReload } from '../../../core/services/live.service';

type Duration = { key: string; label: string; months: number | null };

/** null = no end date; 'date' = pick a day. */
const DURATIONS: Duration[] = [
  { key: '1m', label: '1 mes', months: 1 },
  { key: '3m', label: '3 meses', months: 3 },
  { key: '6m', label: '6 meses', months: 6 },
  { key: '1y', label: '1 año', months: 12 },
  { key: 'none', label: 'Sin fecha de fin', months: null },
  { key: 'date', label: 'Hasta un día…', months: null },
];

/** Sources that do not go through a payment gateway, so they can be changed from the panel. */
const FREE_SOURCES = ['ADMIN', 'WELCOME'];

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Plan and access of a business: what its app shows and the team's levers.
 * Gift a plan for as long as needed, extend it, remove it (so the business
 * has to pay) or leave the account permanently open.
 */
@Component({
  selector: 'app-plan-access',
  imports: [DatePipe, Pill, ConfirmModal, Select],
  templateUrl: './plan-access.html',
  styleUrl: './plan-access.scss',
})
export class PlanAccess {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  readonly businessId = input.required<number>();
  readonly businessName = input.required<string>();
  readonly plans = input<Plan[]>([]);
  readonly subscriptions = input<BusinessSubscription[] | null>(null);
  /** Something changed: the parent reloads the history and the header. */
  readonly changed = output<void>();

  protected readonly access = signal<BusinessAccess | null>(null);
  protected readonly accessError = signal<string | null>(null);
  protected readonly accessUnavailable = signal(false);

  // Gift / change end date dialog
  protected readonly dialog = signal<'grant' | 'extend' | null>(null);
  protected readonly planCode = signal('');
  protected readonly durationKey = signal('3m');
  protected readonly customDate = signal('');
  protected readonly saving = signal(false);

  protected readonly confirmRevoke = signal(false);
  protected readonly revoking = signal(false);
  protected readonly togglingSuper = signal(false);

  protected readonly durations = DURATIONS;
  protected readonly labels = { accessState, subscriptionSource, subscriptionStatus, billingInterval };
  protected readonly eur = formatEur;

  /** The gifted plan currently granting access, if any. */
  protected readonly liveFree = computed(() => {
    const now = Date.now();
    return (
      (this.subscriptions() ?? []).find(
        (s) =>
          s.status === 'ACTIVE' &&
          FREE_SOURCES.includes(s.source) &&
          (!s.currentPeriodEnd || new Date(s.currentPeriodEnd).getTime() > now),
      ) ?? null
    );
  });

  protected readonly livePaid = computed(() => {
    const now = Date.now();
    return (
      (this.subscriptions() ?? []).find(
        (s) =>
          (s.status === 'ACTIVE' || s.status === 'PAST_DUE') &&
          !FREE_SOURCES.includes(s.source) &&
          (!s.currentPeriodEnd || new Date(s.currentPeriodEnd).getTime() > now),
      ) ?? null
    );
  });

  /** End date that would result from the choices in the dialog. */
  protected readonly resultingEnd = computed<Date | null | 'invalid'>(() => {
    const key = this.durationKey();
    if (key === 'none') return null;
    if (key === 'date') {
      if (!this.customDate()) return 'invalid';
      const d = new Date(this.customDate() + 'T23:59:59');
      return d.getTime() > Date.now() ? d : 'invalid';
    }
    const months = DURATIONS.find((d) => d.key === key)?.months ?? 1;
    // When extending, time is added to what was already left, not to today.
    const current = this.liveFree()?.currentPeriodEnd;
    const base =
      this.dialog() === 'extend' && current && new Date(current).getTime() > Date.now() ? new Date(current) : new Date();
    return addMonths(base, months);
  });

  protected readonly canSave = computed(
    () => this.resultingEnd() !== 'invalid' && (this.dialog() === 'extend' || !!this.planCode()),
  );

  protected readonly selectedPlan = computed(() => this.plans().find((p) => p.code === this.planCode()) ?? null);

  protected readonly planOptions = computed<SelectOption[]>(() =>
    this.plans().map((p) => ({
      value: p.code,
      label: p.name,
      hint: p.priceCents ? `Normalmente ${formatEur(p.price)} ${billingInterval(p.billingInterval).label}` : 'Gratis',
      icon: 'workspace_premium',
    })),
  );

  // Real time: reloads quietly when this data changes.
  private readonly live = liveReload(['plans'], () => this.loadAccess());

  constructor() {
    effect(() => {
      this.businessId();
      untracked(() => this.loadAccess());
    });
  }

  protected loadAccess() {
    this.accessError.set(null);
    this.api.businessAccess(this.businessId()).subscribe({
      next: (a) => {
        this.access.set(a);
        this.accessUnavailable.set(false);
      },
      error: (err) => {
        if (isNotFound(err)) this.accessUnavailable.set(true);
        else this.accessError.set(apiErrorMessage(err, 'No se ha podido leer el acceso.'));
      },
    });
  }

  // ----- DIALOG --------------------

  protected openGrant() {
    this.planCode.set(this.plans().find((p) => p.code !== 'FREE' && p.selectable)?.code ?? this.plans()[0]?.code ?? '');
    this.durationKey.set('3m');
    this.customDate.set('');
    this.dialog.set('grant');
  }

  protected openExtend() {
    this.durationKey.set('1m');
    this.customDate.set('');
    this.dialog.set('extend');
  }

  protected save() {
    const end = this.resultingEnd();
    if (end === 'invalid' || this.saving()) return;
    const iso = end ? end.toISOString() : null;
    this.saving.set(true);

    const call =
      this.dialog() === 'extend' && this.liveFree()
        ? this.api.updateSubscriptionEnd(this.liveFree()!.id, iso)
        : this.api.grantFreePlan(this.businessId(), this.planCode(), iso);

    const wasExtend = this.dialog() === 'extend';
    call.subscribe({
      next: (a) => {
        this.access.set(a);
        this.saving.set(false);
        this.dialog.set(null);
        this.toast.success(
          wasExtend
            ? iso ? 'Fecha de fin actualizada.' : 'El plan regalado ya no caduca.'
            : `${this.selectedPlan()?.name ?? 'Plan'} regalado a ${this.businessName()}.`,
        );
        this.changed.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(
          isNotFound(err) ? 'Esto necesita la versión nueva del backend (AdminAccessController).' : err,
          'No se ha podido guardar.',
        );
      },
    });
  }

  // ----- REVOKE AND PERMANENT ACCESS --------------------

  protected revoke() {
    this.revoking.set(true);
    this.api.revokeFreeAccess(this.businessId()).subscribe({
      next: (res) => {
        this.revoking.set(false);
        this.confirmRevoke.set(false);
        this.access.set(res.access);
        const blocked = res.access.status.blocked;
        this.toast.success(
          res.canceled === 0
            ? 'No tenía nada regalado que quitar.'
            : blocked
              ? 'Acceso gratis retirado. Verá el muro de pago hasta que pague.'
              : 'Acceso gratis retirado.',
        );
        this.changed.emit();
      },
      error: (err) => {
        this.revoking.set(false);
        this.confirmRevoke.set(false);
        this.toast.error(err, 'No se ha podido quitar el acceso.');
      },
    });
  }

  protected toggleSuper(enabled: boolean) {
    this.togglingSuper.set(true);
    this.api.setSuperAccess(this.businessId(), enabled).subscribe({
      next: (a) => {
        this.togglingSuper.set(false);
        this.access.set(a);
        this.toast.success(enabled ? 'Cuenta con acceso permanente.' : 'Acceso permanente retirado.');
        this.changed.emit();
      },
      error: (err) => {
        this.togglingSuper.set(false);
        this.toast.error(err, 'No se ha podido cambiar.');
      },
    });
  }

  protected isFree(source: string): boolean {
    return FREE_SOURCES.includes(source);
  }
}
