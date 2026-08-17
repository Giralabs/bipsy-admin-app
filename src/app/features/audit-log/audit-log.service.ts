import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../core/models/page.model';
import { AuditLogEntry } from './audit-log.model';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly base = `${environment.apiUrl}/admin/audit-log`;

  constructor(private http: HttpClient) {}

  list(page: number, size = 30) {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<AuditLogEntry>>(this.base, { params });
  }
}
