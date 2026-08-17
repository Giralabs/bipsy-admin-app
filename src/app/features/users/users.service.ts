import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../core/models/page.model';
import { CustomerDetail, CustomerListItem, Reputation, Sanction, SanctionRequest } from './models/customer.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly base = `${environment.apiUrl}/admin/customers`;

  constructor(private http: HttpClient) {}

  list(search: string, reputation: Reputation | null, page: number, size = 20) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search) params = params.set('search', search);
    if (reputation) params = params.set('reputation', reputation);
    return this.http.get<PageResponse<CustomerListItem>>(this.base, { params });
  }

  getDetail(id: number) {
    return this.http.get<CustomerDetail>(`${this.base}/${id}`);
  }

  resetAccount(id: number) {
    return this.http.post<void>(`${this.base}/${id}/reset`, {});
  }

  sanction(id: number, req: SanctionRequest) {
    return this.http.post<Sanction>(`${this.base}/${id}/sanctions`, req);
  }

  liftSanction(id: number, sanctionId: number) {
    return this.http.delete<void>(`${this.base}/${id}/sanctions/${sanctionId}`);
  }

  exportUrl(search: string, reputation: Reputation | null): string {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (reputation) params.set('reputation', reputation);
    const qs = params.toString();
    return `${this.base}/export${qs ? '?' + qs : ''}`;
  }
}
