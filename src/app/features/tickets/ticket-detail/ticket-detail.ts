import { DatePipe } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BusinessDetail, Ticket, TicketAttachment, TicketPriority, TicketStatus } from '../../../core/models/admin.models';
import { AdminApi } from '../../../core/services/admin-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { timeAgo } from '../../../core/utils/format';
import { businessState, ticketKind, ticketPriority, ticketStatus } from '../../../core/utils/labels';
import { Avatar } from '../../../shared/components/avatar/avatar';
import { ConfirmModal } from '../../../shared/components/confirm-modal/confirm-modal';
import { Pill } from '../../../shared/components/pill/pill';
import { Select, SelectOption } from '../../../shared/components/select/select';
import { copyText, saveBlob } from '../../../shared/utils/download';
import { liveReload } from '../../../core/services/live.service';

interface AttachmentPreview {
  attachment: TicketAttachment;
  objectUrl: string | null;
  blob: Blob | null;
  kind: 'image' | 'video' | 'file';
  loading: boolean;
}

// Canned replies. They are inserted into the composer and can be edited before sending.
const QUICK_REPLIES: { label: string; body: string }[] = [
  {
    label: 'Lo estamos mirando',
    body: 'Hola, gracias por escribirnos. Ya estamos revisando lo que nos cuentas y te respondemos por aquí en cuanto lo tengamos.',
  },
  {
    label: 'Necesitamos más datos',
    body: 'Hola, para poder ayudarte necesitamos un poco más de información: ¿nos indicas los pasos que seguiste, el dispositivo y, si puedes, una captura de pantalla?',
  },
  {
    label: 'Solucionado',
    body: 'Hola, ya está solucionado. Si vuelve a pasarte o ves cualquier otra cosa, responde a este ticket y lo revisamos.',
  },
  {
    label: 'Mejora anotada',
    body: 'Hola, gracias por la propuesta. La hemos anotado para el equipo de producto y te avisaremos por aquí si entra en una próxima versión.',
  },
];

@Component({
  selector: 'app-ticket-detail',
  imports: [RouterLink, DatePipe, Pill, Avatar, ConfirmModal, Select],
  templateUrl: './ticket-detail.html',
  styleUrl: './ticket-detail.scss',
})
export class TicketDetailPage implements OnDestroy {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  /** Route parameter :id (withComponentInputBinding). */
  readonly id = input.required<string>();
  private ticketId = 0;

  protected readonly ticket = signal<Ticket | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly previews = signal<AttachmentPreview[]>([]);
  protected readonly business = signal<BusinessDetail | null>(null);

  protected readonly reply = signal('');
  protected readonly sending = signal(false);
  protected readonly notes = signal('');
  protected readonly savingNotes = signal(false);
  protected readonly updating = signal(false);
  protected readonly confirmClose = signal(false);
  protected readonly showTemplates = signal(false);

  protected readonly quickReplies = QUICK_REPLIES;
  protected readonly labels = { ticketKind, ticketPriority, ticketStatus };
  protected readonly businessState = businessState;
  protected readonly ago = timeAgo;
  protected readonly statusOptions: SelectOption<TicketStatus>[] = (['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as TicketStatus[]).map(
    (s) => ({ value: s, label: ticketStatus(s).label, tone: ticketStatus(s).tone }),
  );
  protected readonly priorityOptions: SelectOption<TicketPriority>[] = (['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as TicketPriority[]).map(
    (p) => ({ value: p, label: ticketPriority(p).label, tone: ticketPriority(p).tone }),
  );

  protected readonly notesDirty = computed(() => (this.ticket()?.adminNotes ?? '') !== this.notes());
  protected readonly canWrite = computed(() => this.auth.canSupport());

  // Real time: reloads quietly when this data changes.
  private readonly live = liveReload(['tickets'], () => this.refreshQuietly());

  constructor() {
    // React to :id changes, since opening another ticket from the search reuses the component.
    effect(() => {
      const id = Number(this.id());
      untracked(() => {
        this.ticketId = id;
        this.ticket.set(null);
        this.business.set(null);
        this.reply.set('');
        this.load();
      });
    });
  }

  ngOnDestroy() {
    this.revokePreviews();
  }

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.ticket(this.ticketId).subscribe({
      next: (t) => {
        this.setTicket(t);
        this.loading.set(false);
        this.loadAttachments(t.attachments);
        if (t.businessId) {
          this.api.business(t.businessId).subscribe({ next: (b) => this.business.set(b), error: () => {} });
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'No se ha podido cargar el ticket.'));
      },
    });
  }

  protected title(t: Ticket): string {
    if (t.subject) return t.subject;
    return t.description.length > 90 ? t.description.slice(0, 90) + '…' : t.description;
  }

  // ----- REPLY --------------------

  protected useTemplate(body: string) {
    const current = this.reply().trim();
    this.reply.set(current ? `${current}\n\n${body}` : body);
    this.showTemplates.set(false);
  }

  protected onComposerKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.send(false);
    }
  }

  /** With `andResolve`, replies and marks the ticket as resolved in a single step. */
  protected send(andResolve: boolean) {
    const body = this.reply().trim();
    if (!body || this.sending()) return;
    this.sending.set(true);
    this.api.replyTicket(this.ticketId, body).subscribe({
      next: (t) => {
        this.reply.set('');
        this.setTicket(t);
        if (andResolve && t.status !== 'RESOLVED') {
          this.changeStatus('RESOLVED', 'Respuesta enviada y ticket resuelto.');
          this.sending.set(false);
        } else {
          this.sending.set(false);
          this.toast.success('Respuesta enviada. El negocio recibe un aviso.');
        }
      },
      error: (err) => {
        this.sending.set(false);
        this.toast.error(err, 'No se ha podido enviar la respuesta.');
      },
    });
  }

  // ----- STATUS, PRIORITY AND NOTES --------------------

  protected changeStatus(status: TicketStatus, successMessage?: string) {
    const t = this.ticket();
    if (!t || t.status === status) return;
    this.updating.set(true);
    // Passing null keeps the saved notes, as the backend only touches them if they are sent.
    this.api.updateTicketStatus(this.ticketId, status, null).subscribe({
      next: (updated) => {
        this.setTicket(updated, true);
        this.updating.set(false);
        this.confirmClose.set(false);
        this.toast.success(successMessage ?? `Ticket marcado como «${ticketStatus(status).label.toLowerCase()}».`);
      },
      error: (err) => {
        this.updating.set(false);
        this.confirmClose.set(false);
        this.toast.error(err, 'No se ha podido cambiar el estado.');
      },
    });
  }

  protected requestStatus(status: TicketStatus) {
    if (status === 'CLOSED') this.confirmClose.set(true);
    else this.changeStatus(status);
  }

  protected changePriority(priority: TicketPriority) {
    const t = this.ticket();
    if (!t || t.priority === priority) return;
    this.updating.set(true);
    this.api.updateTicketPriority(this.ticketId, priority).subscribe({
      next: (updated) => {
        this.setTicket(updated, true);
        this.updating.set(false);
        this.toast.success(`Prioridad: ${ticketPriority(priority).label.toLowerCase()}.`);
      },
      error: (err) => {
        this.updating.set(false);
        this.toast.error(err, 'No se ha podido cambiar la prioridad.');
      },
    });
  }

  protected saveNotes() {
    const t = this.ticket();
    if (!t) return;
    this.savingNotes.set(true);
    // Notes are sent along with the current status because it is the same endpoint.
    this.api.updateTicketStatus(this.ticketId, t.status, this.notes().trim()).subscribe({
      next: (updated) => {
        this.setTicket(updated);
        this.savingNotes.set(false);
        this.toast.success('Notas internas guardadas.');
      },
      error: (err) => {
        this.savingNotes.set(false);
        this.toast.error(err, 'No se han podido guardar las notas.');
      },
    });
  }

  protected async copy(text: string, what: string) {
    if (await copyText(text)) this.toast.info(`${what} copiado.`);
  }

  // ----- ATTACHMENTS --------------------

  protected download(p: AttachmentPreview) {
    if (p.blob) saveBlob(p.blob, p.attachment.filename);
  }

  protected openInTab(p: AttachmentPreview) {
    if (p.objectUrl) window.open(p.objectUrl, '_blank', 'noopener');
  }

  protected size(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Real time: fetches new replies and changes without overwriting half-written notes.
  private refreshQuietly() {
    this.api.ticket(this.ticketId).subscribe({ next: (t) => this.setTicket(t, true), error: () => {} });
  }

  // With `keepNotes`, changing status or priority does not overwrite notes being typed.
  private setTicket(t: Ticket, keepNotes = false) {
    const hadDraft = keepNotes && this.notesDirty();
    this.ticket.set(t);
    if (!hadDraft) this.notes.set(t.adminNotes ?? '');
  }

  private loadAttachments(attachments: TicketAttachment[]) {
    this.revokePreviews();
    this.previews.set(
      attachments.map((a) => ({ attachment: a, objectUrl: null, blob: null, kind: this.kindOf(a.contentType), loading: true })),
    );
    for (const a of attachments) {
      this.api.ticketAttachment(this.ticketId, a.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.previews.update((list) =>
            list.map((p) => (p.attachment.id === a.id ? { ...p, objectUrl: url, blob, loading: false } : p)),
          );
        },
        error: () => {
          this.previews.update((list) => list.map((p) => (p.attachment.id === a.id ? { ...p, loading: false } : p)));
        },
      });
    }
  }

  private revokePreviews() {
    for (const p of this.previews()) if (p.objectUrl) URL.revokeObjectURL(p.objectUrl);
  }

  private kindOf(contentType: string): AttachmentPreview['kind'] {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    return 'file';
  }
}
