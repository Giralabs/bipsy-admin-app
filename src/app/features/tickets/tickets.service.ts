import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../core/models/page.model';
import { BusinessDetail, TicketDetail, TicketListItem, TicketPriority, TicketStatus } from './models/ticket.model';

@Injectable({ providedIn: 'root' })
export class TicketsService {
  private readonly base = `${environment.apiUrl}/admin/support/tickets`;
  private readonly businessesBase = `${environment.apiUrl}/admin/businesses`;

  constructor(private http: HttpClient) {}

  list(status: TicketStatus | null, businessId: number | null, page: number, size = 20) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status) params = params.set('status', status);
    if (businessId) params = params.set('businessId', businessId);
    return this.http.get<PageResponse<TicketListItem>>(this.base, { params });
  }

  getDetail(id: number) {
    return this.http.get<TicketDetail>(`${this.base}/${id}`);
  }

  reply(id: number, body: string) {
    return this.http.post<TicketDetail>(`${this.base}/${id}/replies`, { body });
  }

  updateStatus(id: number, status: TicketStatus, adminNotes: string | null = null) {
    return this.http.put<TicketDetail>(`${this.base}/${id}/status`, { status, adminNotes });
  }

  updatePriority(id: number, priority: TicketPriority) {
    return this.http.put<TicketDetail>(`${this.base}/${id}/priority`, { priority });
  }

  exportUrl(status: TicketStatus | null, businessId: number | null): string {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (businessId) params.set('businessId', String(businessId));
    const qs = params.toString();
    return `${this.base}/export${qs ? '?' + qs : ''}`;
  }

  /** Blob en vez de URL directa: el interceptor solo adjunta el Bearer token a peticiones HttpClient. */
  downloadAttachment(ticketId: number, attachmentId: number) {
    return this.http.get(`${this.base}/${ticketId}/attachments/${attachmentId}`, { responseType: 'blob' });
  }

  getBusinessDetail(businessId: number) {
    return this.http.get<BusinessDetail>(`${this.businessesBase}/${businessId}`);
  }
}
