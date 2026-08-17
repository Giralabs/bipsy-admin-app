import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface CustomerHit {
  id: number;
  name: string;
  email: string;
}

export interface BusinessHit {
  id: number;
  name: string;
  email: string;
}

export interface TicketHit {
  id: number;
  subject: string | null;
  status: string;
}

export interface SearchResults {
  customers: CustomerHit[];
  businesses: BusinessHit[];
  tickets: TicketHit[];
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly base = `${environment.apiUrl}/admin/search`;

  constructor(private http: HttpClient) {}

  search(q: string) {
    return this.http.get<SearchResults>(this.base, { params: { q } });
  }
}
