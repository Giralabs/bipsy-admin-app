import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AdminScope, TeamMember } from '../../core/models/admin.models';
import { AdminApi } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/utils/api-error';
import { adminScope } from '../../core/utils/labels';
import { Avatar } from '../../shared/components/avatar/avatar';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';
import { Pill } from '../../shared/components/pill/pill';
import { liveReload } from '../../core/services/live.service';

type Dialog = { mode: 'create' } | { mode: 'edit'; member: TeamMember } | { mode: 'password'; member: TeamMember };

const SCOPES: { value: AdminScope; label: string; icon: string; can: string[]; cannot: string[] }[] = [
  {
    value: 'FULL',
    label: 'Acceso completo',
    icon: 'shield_person',
    can: ['Todo el panel', 'Banear, sancionar y cancelar citas', 'Planes, ofertas y ajustes', 'Crear cuentas del panel'],
    cannot: [],
  },
  {
    value: 'SUPPORT',
    label: 'Soporte',
    icon: 'support_agent',
    can: ['Consultar todo', 'Responder tickets y solicitudes', 'Cambiar estado, prioridad y notas'],
    cannot: ['Banear, sancionar ni tocar planes'],
  },
  {
    value: 'READONLY',
    label: 'Solo lectura',
    icon: 'visibility',
    can: ['Consultar todo el panel'],
    cannot: ['Cualquier cambio'],
  },
];

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/;

@Component({
  selector: 'app-team',
  imports: [DatePipe, Avatar, Pill, ConfirmModal],
  templateUrl: './team.html',
  styleUrl: './team.scss',
})
export class Team {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly members = signal<TeamMember[] | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly fName = signal('');
  protected readonly fEmail = signal('');
  protected readonly fUsername = signal('');
  protected readonly fPassword = signal('');
  protected readonly fScope = signal<AdminScope>('SUPPORT');
  protected readonly showPassword = signal(false);
  protected readonly saving = signal(false);

  protected readonly toggleTarget = signal<TeamMember | null>(null);
  protected readonly toggling = signal(false);

  protected readonly scopes = SCOPES;
  protected readonly scopeLabel = adminScope;

  protected readonly counts = computed(() => {
    const list = this.members() ?? [];
    return {
      active: list.filter((m) => m.enabled).length,
      full: list.filter((m) => m.enabled && m.scope === 'FULL').length,
    };
  });

  protected readonly passwordOk = computed(() => PASSWORD_RULE.test(this.fPassword()));
  protected readonly formValid = computed(() => {
    const d = this.dialog();
    if (!d) return false;
    if (d.mode === 'password') return this.passwordOk();
    const nameOk = !!this.fName().trim();
    if (d.mode === 'edit') return nameOk;
    return (
      nameOk &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.fEmail().trim()) &&
      /^[a-zA-Z0-9._-]{3,50}$/.test(this.fUsername().trim()) &&
      this.passwordOk()
    );
  });

  // Real time: reloads quietly when this data changes.
  private readonly live = liveReload(['actors'], () => this.load());

  constructor() {
    this.load();
  }

  protected load() {
    this.error.set(null);
    this.api.team().subscribe({
      next: (m) => this.members.set(m),
      error: (err) => this.error.set(apiErrorMessage(err, 'No se ha podido cargar el equipo.')),
    });
  }

  // ----- DIALOGS --------------------

  protected openCreate() {
    this.fName.set('');
    this.fEmail.set('');
    this.fUsername.set('');
    this.fPassword.set(generatePassword());
    this.fScope.set('SUPPORT');
    this.showPassword.set(true);
    this.dialog.set({ mode: 'create' });
  }

  protected openEdit(member: TeamMember) {
    this.fName.set(member.name);
    this.fScope.set(member.scope);
    this.dialog.set({ mode: 'edit', member });
  }

  protected openPassword(member: TeamMember) {
    this.fPassword.set(generatePassword());
    this.showPassword.set(true);
    this.dialog.set({ mode: 'password', member });
  }

  protected regenerate() {
    this.fPassword.set(generatePassword());
    this.showPassword.set(true);
  }

  /** Suggests the username from the email, as the apps do. */
  protected onEmail(value: string) {
    const before = this.fEmail().split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '');
    this.fEmail.set(value);
    if (!this.fUsername() || this.fUsername() === before) {
      this.fUsername.set(value.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 50));
    }
  }

  protected async copyPassword() {
    try {
      await navigator.clipboard.writeText(this.fPassword());
      this.toast.info('Contraseña copiada. Pásasela por un canal seguro.');
    } catch {
      // no clipboard available
    }
  }

  protected save() {
    const d = this.dialog();
    if (!d || !this.formValid() || this.saving()) return;
    this.saving.set(true);

    const done = (message: string) => {
      this.saving.set(false);
      this.dialog.set(null);
      this.toast.success(message);
      this.load();
    };
    const fail = (err: unknown) => {
      this.saving.set(false);
      this.toast.error(err, 'No se ha podido guardar.');
    };

    if (d.mode === 'create') {
      this.api
        .createTeamMember({
          name: this.fName().trim(),
          email: this.fEmail().trim(),
          username: this.fUsername().trim(),
          password: this.fPassword(),
          scope: this.fScope(),
        })
        .subscribe({ next: (m) => done(`${m.name} ya puede entrar al panel como «${m.username}».`), error: fail });
    } else if (d.mode === 'edit') {
      this.api
        .updateTeamMember(d.member.id, { name: this.fName().trim(), scope: this.fScope() })
        .subscribe({ next: () => done('Cambios guardados.'), error: fail });
    } else {
      this.api
        .resetTeamPassword(d.member.id, this.fPassword())
        .subscribe({ next: () => done(`Contraseña de ${d.member.name} cambiada. Sus sesiones abiertas se han cerrado.`), error: fail });
    }
  }

  protected toggleEnabled() {
    const m = this.toggleTarget();
    if (!m) return;
    this.toggling.set(true);
    this.api.setTeamMemberEnabled(m.id, !m.enabled).subscribe({
      next: (updated) => {
        this.toggling.set(false);
        this.toggleTarget.set(null);
        this.toast.success(updated.enabled ? `${m.name} puede volver a entrar.` : `${m.name} ya no puede entrar al panel.`);
        this.load();
      },
      error: (err) => {
        this.toggling.set(false);
        this.toggleTarget.set(null);
        this.toast.error(err, 'No se ha podido cambiar.');
      },
    });
  }
}

// 14 readable characters (no 0/O or 1/l), guaranteed to include letters and digits.
function generatePassword(): string {
  const letters = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => all[b % all.length]);
  chars[3] = digits[bytes[3] % digits.length];
  chars[9] = letters[bytes[9] % letters.length];
  return chars.join('');
}
