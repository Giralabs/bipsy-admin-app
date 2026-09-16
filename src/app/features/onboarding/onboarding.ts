import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CallOutcome, OnboardingContact, OnboardingItem, OnboardingResponse } from '../../core/models/admin.models';
import { AdminApi } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { BadgesService } from '../../core/services/badges.service';
import { liveReload } from '../../core/services/live.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/utils/api-error';
import { formatCents, timeAgo } from '../../core/utils/format';
import { callOutcome, onboardingStage } from '../../core/utils/labels';
import { SegmentOption, Segmented } from '../../shared/components/segmented/segmented';
import { Select, SelectOption } from '../../shared/components/select/select';
import { listQuery } from '../../shared/utils/list-query';

type Filter = 'due' | 'free' | 'no-plan' | 'paying' | 'all';
type NextKey = 'none' | 'tomorrow' | '3d' | 'week' | 'custom';

/**
 * Onboarding: the support call list for businesses that have just signed up.
 * What matters is calling them while they are on the welcome period or the
 * free trial, before they have to pay, and never calling the same person
 * twice without knowing what was discussed.
 */
@Component({
  selector: 'app-onboarding',
  imports: [DatePipe, RouterLink, Segmented, Select],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
})
export class Onboarding {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly badges = inject(BadgesService);
  protected readonly auth = inject(AuthService);
  private readonly query = listQuery();

  protected readonly data = signal<OnboardingResponse | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<Filter>((this.query.get('filter') as Filter) || 'due');
  protected readonly days = signal(this.query.get('days') || '60');

  protected readonly history = signal<Record<number, OnboardingContact[] | undefined>>({});
  protected readonly openHistory = signal<number | null>(null);

  // Log call dialog
  protected readonly target = signal<OnboardingItem | null>(null);
  protected readonly outcome = signal<CallOutcome>('CALLED');
  protected readonly note = signal('');
  protected readonly nextKey = signal<NextKey>('none');
  protected readonly nextCustom = signal('');
  protected readonly saving = signal(false);

  protected readonly labels = { onboardingStage, callOutcome };
  protected readonly ago = timeAgo;
  protected readonly cents = formatCents;

  protected readonly filters = computed<SegmentOption<Filter>[]>(() => {
    const s = this.data()?.summary;
    return [
      { value: 'due', label: 'Por llamar', count: s?.due ?? null },
      { value: 'free', label: 'Gratis ahora', count: s ? s.welcome + s.trial : null },
      { value: 'no-plan', label: 'Sin plan', count: s?.noPlan ?? null },
      { value: 'paying', label: 'Ya pagan', count: s?.payingNew ?? null },
      { value: 'all', label: 'Todos', count: s?.total ?? null },
    ];
  });

  protected readonly dayOptions: SelectOption[] = [
    { value: '30', label: 'Altas de los últimos 30 días' },
    { value: '60', label: 'Altas de los últimos 60 días' },
    { value: '90', label: 'Altas de los últimos 90 días' },
    { value: '180', label: 'Altas de los últimos 6 meses' },
  ];

  protected readonly outcomes: CallOutcome[] = ['CALLED', 'NO_ANSWER', 'CALL_BACK', 'WILL_PAY', 'NOT_INTERESTED', 'NOTE'];

  protected readonly nextOptions: { key: NextKey; label: string }[] = [
    { key: 'none', label: 'No hace falta' },
    { key: 'tomorrow', label: 'Mañana' },
    { key: '3d', label: 'En 3 días' },
    { key: 'week', label: 'En una semana' },
    { key: 'custom', label: 'Elegir…' },
  ];

  protected readonly items = computed(() => {
    const all = this.data()?.items ?? [];
    switch (this.filter()) {
      case 'due':
        return all.filter((i) => i.due);
      case 'free':
        return all.filter((i) => i.stage === 'WELCOME' || i.stage === 'TRIAL');
      case 'no-plan':
        return all.filter((i) => i.stage === 'NO_PLAN' || i.stage === 'PAST_DUE');
      case 'paying':
        return all.filter((i) => i.stage === 'PAYING');
      default:
        return all;
    }
  });

  private readonly live = liveReload(['plans', 'actors', 'audit'], () => this.load());

  constructor() {
    this.load();
  }

  protected load() {
    this.error.set(null);
    this.api.onboarding(Number(this.days())).subscribe({
      next: (r) => {
        this.data.set(r);
        const open = this.openHistory();
        if (open) this.loadHistory(open);
      },
      error: (err) => this.error.set(apiErrorMessage(err, 'No se ha podido cargar la lista.')),
    });
  }

  protected setFilter(f: Filter) {
    this.filter.set(f);
    this.query.set({ filter: f === 'due' ? '' : f, days: this.days() === '60' ? '' : this.days() });
  }

  protected setDays(d: string) {
    this.days.set(d);
    this.query.set({ filter: this.filter() === 'due' ? '' : this.filter(), days: d === '60' ? '' : d });
    this.load();
  }

  /** Short phrase with how much free time is left, which is what drives urgency. */
  protected countdown(i: OnboardingItem): string | null {
    if (i.daysLeft == null) return null;
    const d = i.daysLeft;
    const what = i.stage === 'WELCOME' ? 'de cortesía' : i.stage === 'TRIAL' ? 'de prueba' : 'de plan';
    if (d <= 0) return `Último día ${what}`;
    return d === 1 ? `Le queda 1 día ${what}` : `Le quedan ${d} días ${what}`;
  }

  protected urgent(i: OnboardingItem): boolean {
    return (i.stage === 'WELCOME' || i.stage === 'TRIAL') && i.daysLeft != null && i.daysLeft <= 3;
  }

  protected tel(phone: string | null): string {
    return 'tel:' + (phone ?? '').replace(/[^\d+]/g, '');
  }

  protected toggleHistory(i: OnboardingItem) {
    if (this.openHistory() === i.businessId) {
      this.openHistory.set(null);
      return;
    }
    this.openHistory.set(i.businessId);
    this.loadHistory(i.businessId);
  }

  private loadHistory(businessId: number) {
    this.api.onboardingContacts(businessId).subscribe({
      next: (c) => this.history.update((h) => ({ ...h, [businessId]: c })),
      error: () => this.history.update((h) => ({ ...h, [businessId]: [] })),
    });
  }

  protected openCall(i: OnboardingItem) {
    this.target.set(i);
    this.outcome.set('CALLED');
    this.note.set('');
    this.nextKey.set('none');
    this.nextCustom.set('');
  }

  protected setOutcome(o: CallOutcome) {
    this.outcome.set(o);
    // Sensible default suggestion; it can be changed.
    if (o === 'NO_ANSWER') this.nextKey.set('tomorrow');
    else if (o === 'CALL_BACK') this.nextKey.set('3d');
    else if (o === 'WILL_PAY' || o === 'NOT_INTERESTED') this.nextKey.set('none');
  }

  private nextCallAt(): string | null {
    const at = new Date();
    switch (this.nextKey()) {
      case 'tomorrow':
        at.setDate(at.getDate() + 1);
        at.setHours(10, 0, 0, 0);
        return at.toISOString();
      case '3d':
        at.setDate(at.getDate() + 3);
        at.setHours(10, 0, 0, 0);
        return at.toISOString();
      case 'week':
        at.setDate(at.getDate() + 7);
        at.setHours(10, 0, 0, 0);
        return at.toISOString();
      case 'custom':
        return this.nextCustom() ? new Date(this.nextCustom()).toISOString() : null;
      default:
        return null;
    }
  }

  protected readonly canSave = computed(
    () => !(this.nextKey() === 'custom' && !this.nextCustom()) && !(this.outcome() === 'NOTE' && !this.note().trim()),
  );

  protected saveCall() {
    const t = this.target();
    if (!t || !this.canSave()) return;
    this.saving.set(true);
    this.api
      .addOnboardingContact(t.businessId, { outcome: this.outcome(), note: this.note().trim() || null, nextCallAt: this.nextCallAt() })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.target.set(null);
          this.toast.success('Llamada registrada.');
          this.history.update((h) => ({ ...h, [t.businessId]: undefined }));
          if (this.openHistory() === t.businessId) this.loadHistory(t.businessId);
          this.load();
          this.badges.refresh(true);
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(err, 'No se ha podido guardar la llamada.');
        },
      });
  }
}
