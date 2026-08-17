import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Category, CreateCategoryRequest, UpdateCategoryRequest } from './category.model';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly base = `${environment.apiUrl}/categories`;

  constructor(private http: HttpClient) {}

  list() {
    return this.http.get<Category[]>(this.base, { params: { activeOnly: 'false' } });
  }

  create(req: CreateCategoryRequest) {
    return this.http.post<Category>(this.base, req);
  }

  update(id: number, req: UpdateCategoryRequest) {
    return this.http.put<Category>(`${this.base}/${id}`, req);
  }

  deactivate(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
