import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MaintenanceSettings, MaintenanceSite } from '../../core/models/admin.models';
import { AdminApi } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { liveReload } from '../../core/services/live.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage, isNotFound } from '../../core/utils/api-error';
import { Meta } from '../../core/utils/labels';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';
import { Pill } from '../../shared/components/pill/pill';

/** What the form edits: the two switches and their notes. The password goes apart. */
interface Form {
  customerWebEnabled: boolean;
  customerWebMessage: string;
  businessWebEnabled: boolean;
  businessWebMessage: string;
}

interface SiteDef {
  site: MaintenanceSite;
  enabledKey: 'customerWebEnabled' | 'businessWebEnabled';
  messageKey: 'customerWebMessage' | 'businessWebMessage';
  title: string;
  /** Name used mid-sentence: «la web de clientes». */
  name: string;
  repo: string;
  icon: string;
  hint: string;
}

const SITES: SiteDef[] = [
  {
    site: 'CUSTOMER_WEB',
    enabledKey: 'customerWebEnabled',
    messageKey: 'customerWebMessage',
    title: 'Web de clientes',
    name: 'la web de clientes',
    repo: 'bipsy-web-app',
    icon: 'public',
    hint: 'Donde los clientes buscan negocios y reservan.',
  },
  {
    site: 'BUSINESS_WEB',
    enabledKey: 'businessWebEnabled',
    messageKey: 'businessWebMessage',
    title: 'Web de negocios',
    name: 'la web de negocios',
    repo: 'bipsy-business-web-app',
    icon: 'storefront',
    hint: 'El panel web desde el que los negocios llevan su agenda.',
  },
];

// Same limits as UpdateMaintenanceSettingsRequest and MaintenanceService in the backend.
const MESSAGE_MAX = 280;
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 72;

const OPEN: Meta = { label: 'Abierta', tone: 'success', icon: 'check_circle' };
const CLOSED: Meta = { label: 'En mantenimiento', tone: 'warn', icon: 'construction' };

function toForm(s: MaintenanceSettings): Form {
  return {
    customerWebEnabled: s.customerWebEnabled,
    customerWebMessage: s.customerWebMessage ?? '',
    businessWebEnabled: s.businessWebEnabled,
    businessWebMessage: s.businessWebMessage ?? '',
  };
}

/**
 * Maintenance mode of the two public websites. It is a flag the websites read,
 * not a block on the API: the mobile apps keep working either way.
 */
@Component({
  selector: 'app-maintenance',
  imports: [DatePipe, Pill, ConfirmModal],
  templateUrl: './maintenance.html',
  styleUrl: './maintenance.scss',
})
export class Maintenance {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly saved = signal<MaintenanceSettings | null>(null);
  protected readonly form = signal<Form | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Backend without /admin/maintenance yet. */
  protected readonly unavailable = signal(false);
  protected readonly saving = signal(false);

  protected readonly newPassword = signal('');
  protected readonly showPassword = signal(false);

  /** Websites that this save would close, waiting for the confirmation. */
  protected readonly confirming = signal<SiteDef[] | null>(null);

  protected readonly sites = SITES;
  protected readonly messageMax = MESSAGE_MAX;
  protected readonly passwordMin = PASSWORD_MIN;
  protected readonly passwordMax = PASSWORD_MAX;

  protected readonly passwordTooShort = computed(() => {
    const p = this.newPassword();
    return p.trim().length > 0 && p.length < PASSWORD_MIN;
  });

  /** A blank password means «keep the current one», same as in the backend. */
  private readonly changesPassword = computed(() => this.newPassword().trim().length > 0);

  protected readonly dirty = computed(() => {
    const a = this.saved();
    const b = this.form();
    if (!a || !b) return false;
    const before = toForm(a);
    return (
      this.changesPassword() ||
      before.customerWebEnabled !== b.customerWebEnabled ||
      before.businessWebEnabled !== b.businessWebEnabled ||
      before.customerWebMessage !== b.customerWebMessage.trim() ||
      before.businessWebMessage !== b.businessWebMessage.trim()
    );
  });

  protected readonly invalid = computed(() => {
    const f = this.form();
    if (!f) return true;
    return (
      this.passwordTooShort() ||
      f.customerWebMessage.trim().length > MESSAGE_MAX ||
      f.businessWebMessage.trim().length > MESSAGE_MAX
    );
  });

  /** Closing a website with no password leaves the team outside too. */
  protected readonly lockedOut = computed(() => {
    const s = this.saved();
    const f = this.form();
    if (!s || !f) return false;
    return (f.customerWebEnabled || f.businessWebEnabled) && !s.passwordSet && !this.changesPassword();
  });

  protected readonly confirmTitle = computed(() => {
    const list = this.confirming() ?? [];
    return list.length > 1
      ? '¿Poner las dos webs en mantenimiento?'
      : `¿Poner ${list[0]?.name ?? 'la web'} en mantenimiento?`;
  });

  protected readonly confirmMessage = computed(() => {
    const both = (this.confirming() ?? []).length > 1;
    const out = this.lockedOut()
      ? ' No hay contraseña de acceso: tampoco el equipo podrá entrar hasta que la abras de nuevo.'
      : ' El equipo podrá seguir entrando por /admin con la contraseña de acceso.';
    return (
      (both
        ? 'Quien las visite verá la pantalla de mantenimiento en lugar de las webs.'
        : 'Quien la visite verá la pantalla de mantenimiento en lugar de la web.') +
      ' Las apps móviles siguen funcionando.' +
      out
    );
  });

  // Real time: reloads quietly when this data changes.
  private readonly live = liveReload(['maintenance'], () => { if (!this.dirty()) this.load(); });

  constructor() {
    this.load();
  }

  protected load() {
    this.error.set(null);
    this.api.maintenance().subscribe({
      next: (s) => {
        this.unavailable.set(false);
        this.saved.set(s);
        this.form.set(toForm(s));
      },
      error: (err) => {
        if (isNotFound(err)) this.unavailable.set(true);
        else this.error.set(apiErrorMessage(err, 'No se ha podido cargar el modo mantenimiento.'));
      },
    });
  }

  /** What is live right now, not what the form says. */
  protected status(d: SiteDef): Meta {
    return this.saved()?.[d.enabledKey] ? CLOSED : OPEN;
  }

  protected setEnabled(d: SiteDef, enabled: boolean) {
    this.form.update((f) => (f ? { ...f, [d.enabledKey]: enabled } : f));
  }

  protected setMessage(d: SiteDef, message: string) {
    this.form.update((f) => (f ? { ...f, [d.messageKey]: message } : f));
  }

  protected reset() {
    const s = this.saved();
    if (s) this.form.set(toForm(s));
    this.newPassword.set('');
    this.showPassword.set(false);
  }

  /** Opening a website or editing a note saves directly; closing one asks first. */
  protected save() {
    const s = this.saved();
    const f = this.form();
    if (!s || !f || this.invalid() || this.saving() || !this.dirty()) return;
    const closing = SITES.filter((d) => f[d.enabledKey] && !s[d.enabledKey]);
    if (closing.length) this.confirming.set(closing);
    else this.commit();
  }

  protected commit() {
    const f = this.form();
    if (!f || this.invalid() || this.saving()) return;
    const changesPassword = this.changesPassword();
    this.saving.set(true);
    this.api
      .updateMaintenance({
        customerWebEnabled: f.customerWebEnabled,
        customerWebMessage: f.customerWebMessage.trim() || null,
        businessWebEnabled: f.businessWebEnabled,
        businessWebMessage: f.businessWebMessage.trim() || null,
        newPassword: changesPassword ? this.newPassword() : null,
      })
      .subscribe({
        next: (s) => {
          this.saved.set(s);
          this.form.set(toForm(s));
          this.newPassword.set('');
          this.showPassword.set(false);
          this.saving.set(false);
          this.confirming.set(null);
          this.toast.success(
            changesPassword
              ? 'Guardado. La contraseña nueva ya está activa y los accesos anteriores han dejado de valer.'
              : 'Guardado. Las webs lo aplican en la siguiente carga.',
          );
        },
        error: (err) => {
          this.saving.set(false);
          this.confirming.set(null);
          this.toast.error(
            isNotFound(err) ? 'Esto necesita la versión nueva del backend (AdminMaintenanceController).' : err,
            'No se ha podido guardar.',
          );
        },
      });
  }
}
