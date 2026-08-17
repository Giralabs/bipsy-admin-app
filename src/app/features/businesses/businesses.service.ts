import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../../core/models/page.model';
import { BusinessDetail, BusinessListItem } from './models/business.model';
import { BusinessSubscription, Plan } from './models/subscription.model';

@Injectable({ providedIn: 'root' })
export class BusinessesService {
  private readonly base = `${environment.apiUrl}/admin/businesses`;

  constructor(private http: HttpClient) {}

  list(search: string, banned: boolean | null, page: number, size = 20) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search) params = params.set('search', search);
    if (banned !== null) params = params.set('banned', banned);
    return this.http.get<PageResponse<BusinessListItem>>(this.base, { params });
  }

  getDetail(id: number) {
    return this.http.get<BusinessDetail>(`${this.base}/${id}`);
  }

  ban(id: number) {
    return this.http.post<void>(`${this.base}/${id}/ban`, {});
  }

  unban(id: number) {
    return this.http.post<void>(`${this.base}/${id}/unban`, {});
  }

  exportUrl(search: string, banned: boolean | null): string {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (banned !== null) params.set('banned', String(banned));
    const qs = params.toString();
    return `${this.base}/export${qs ? '?' + qs : ''}`;
  }

  // === SUSCRIPCIONES ============================================================

  listSubscriptions(businessId: number) {
    return this.http.get<BusinessSubscription[]>(`${this.base}/${businessId}/subscriptions`);
  }

  listPlans() {
    return this.http.get<Plan[]>(`${environment.apiUrl}/plans`);
  }

  assignPlan(businessId: number, planCode: string) {
    return this.http.post<{ id: number }>(`${environment.apiUrl}/admin/subscriptions`, { businessId, planCode });
  }

  cancelSubscription(subscriptionId: number) {
    return this.http.delete<void>(`${environment.apiUrl}/admin/subscriptions/${subscriptionId}`);
  }
}
