import { DatePipe } from '@angular/common';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmModal } from '../../../shared/components/confirm-modal/confirm-modal';
import { BusinessDetail, TicketAttachment, TicketDetail, TicketPriority, TicketStatus } from '../models/ticket.model';
import { TicketsService } from '../tickets.service';

interface AttachmentPreview {
  attachment: TicketAttachment;
  objectUrl: string | null;
  kind: 'image' | 'video' | 'file';
  loading: boolean;
}

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, ConfirmModal, DatePipe],
  templateUrl: './ticket-detail.html',
  styleUrl: './ticket-detail.scss',
})
export class TicketDetailPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly ticketsService = inject(TicketsService);
  protected readonly auth = inject(AuthService);

  readonly ticketId = Number(this.route.snapshot.paramMap.get('id'));
  readonly ticket = signal<TicketDetail | null>(null);
  readonly loading = signal(true);

  readonly previews = signal<AttachmentPreview[]>([]);

  replyBody = '';
  readonly sendingReply = signal(false);

  readonly showCloseConfirm = signal(false);
  readonly updatingStatus = signal(false);
  readonly updatingPriority = signal(false);

  readonly showBusinessPanel = signal(false);
  readonly businessDetail = signal<BusinessDetail | null>(null);
  readonly loadingBusiness = signal(false);

  constructor() {
    this.load();
  }

  ngOnDestroy() {
    this.revokePreviews();
  }

  load() {
    this.loading.set(true);
    this.ticketsService.getDetail(this.ticketId).subscribe({
      next: (t) => {
        this.ticket.set(t);
        this.loading.set(false);
        this.loadAttachmentPreviews(t.attachments);
      },
      error: () => this.loading.set(false),
    });
  }

  private revokePreviews() {
    for (const p of this.previews()) {
      if (p.objectUrl) URL.revokeObjectURL(p.objectUrl);
    }
  }

  private loadAttachmentPreviews(attachments: TicketAttachment[]) {
    this.revokePreviews();
    this.previews.set(
      attachments.map((a) => ({ attachment: a, objectUrl: null, kind: this.kindOf(a.contentType), loading: true })),
    );

    for (const a of attachments) {
      this.ticketsService.downloadAttachment(this.ticketId, a.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.previews.update((list) =>
            list.map((p) => (p.attachment.id === a.id ? { ...p, objectUrl: url, loading: false } : p)),
          );
        },
        error: () => {
          this.previews.update((list) =>
            list.map((p) => (p.attachment.id === a.id ? { ...p, loading: false } : p)),
          );
        },
      });
    }
  }

  private kindOf(contentType: string): 'image' | 'video' | 'file' {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    return 'file';
  }

  downloadFile(preview: AttachmentPreview) {
    if (!preview.objectUrl) return;
    const link = document.createElement('a');
    link.href = preview.objectUrl;
    link.download = preview.attachment.filename;
    link.click();
  }

  sendReply() {
    const body = this.replyBody.trim();
    if (!body) return;
    this.sendingReply.set(true);
    this.ticketsService.reply(this.ticketId, body).subscribe({
      next: (t) => {
        this.ticket.set(t);
        this.replyBody = '';
        this.sendingReply.set(false);
      },
      error: () => this.sendingReply.set(false),
    });
  }

  setStatus(status: TicketStatus) {
    this.updatingStatus.set(true);
    this.ticketsService.updateStatus(this.ticketId, status).subscribe({
      next: (t) => {
        this.ticket.set(t);
        this.updatingStatus.set(false);
        this.showCloseConfirm.set(false);
      },
      error: () => this.updatingStatus.set(false),
    });
  }

  setPriority(priority: TicketPriority) {
    this.updatingPriority.set(true);
    this.ticketsService.updatePriority(this.ticketId, priority).subscribe({
      next: (t) => {
        this.ticket.set(t);
        this.updatingPriority.set(false);
      },
      error: () => this.updatingPriority.set(false),
    });
  }

  displaySubject(t: TicketDetail): string {
    return t.subject || t.description;
  }

  toggleBusinessPanel() {
    this.showBusinessPanel.set(!this.showBusinessPanel());
    if (this.showBusinessPanel() && !this.businessDetail()) {
      this.loadBusinessDetail();
    }
  }

  private loadBusinessDetail() {
    const businessId = this.ticket()?.businessId;
    if (!businessId) return;
    this.loadingBusiness.set(true);
    this.ticketsService.getBusinessDetail(businessId).subscribe({
      next: (b) => {
        this.businessDetail.set(b);
        this.loadingBusiness.set(false);
      },
      error: () => this.loadingBusiness.set(false),
    });
  }
}
