import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AuditLogEntry } from './audit-log.model';
import { AuditLogService } from './audit-log.service';

const ACTION_LABELS: Record<string, string> = {
  BAN: 'Baneó',
  UNBAN: 'Desbaneó',
  RESET_ACCOUNT: 'Restableció la cuenta de',
  SANCTION: 'Sancionó a',
  LIFT_SANCTION: 'Levantó la sanción de',
  TICKET_STATUS: 'Cambió el estado de',
  TICKET_PRIORITY: 'Cambió la prioridad de',
  TICKET_REPLY: 'Respondió a',
  CREATE_SUBSCRIPTION: 'Asignó una suscripción a',
  CANCEL_SUBSCRIPTION: 'Canceló la suscripción de',
  CREATE_GRANT: 'Creó un grant para',
  REVOKE_GRANT: 'Revocó un grant de',
  CREATE_CATEGORY: 'Creó la categoría',
  UPDATE_CATEGORY: 'Actualizó la categoría',
  DEACTIVATE_CATEGORY: 'Desactivó la categoría',
};

const ENTITY_LABELS: Record<string, string> = {
  CUSTOMER: 'cliente',
  BUSINESS: 'negocio',
  TICKET: 'ticket',
  CATEGORY: 'categoría',
};

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './audit-log.html',
  styleUrl: './audit-log.scss',
})
export class AuditLog {
  private readonly auditLogService = inject(AuditLogService);

  readonly entries = signal<AuditLogEntry[]>([]);
  readonly loading = signal(false);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.auditLogService.list(this.page()).subscribe({
      next: (res) => {
        this.entries.set(res.content);
        this.totalPages.set(res.totalPages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  goToPage(delta: number) {
    const next = this.page() + delta;
    if (next < 0 || next >= this.totalPages()) return;
    this.page.set(next);
    this.load();
  }

  actionLabel(entry: AuditLogEntry): string {
    return ACTION_LABELS[entry.action] ?? entry.action;
  }

  entityLabel(entry: AuditLogEntry): string {
    return ENTITY_LABELS[entry.entityType] ?? entry.entityType.toLowerCase();
  }
}
