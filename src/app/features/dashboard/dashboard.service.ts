import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { DashboardStats } from './models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly base = `${environment.apiUrl}/admin/dashboard`;

  constructor(private http: HttpClient) {}

  get() {
    return this.http.get<DashboardStats>(this.base);
  }
}
