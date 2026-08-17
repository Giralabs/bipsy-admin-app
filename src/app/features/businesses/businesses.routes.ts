import { Routes } from '@angular/router';

export const BUSINESSES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./businesses-list/businesses-list').then((m) => m.BusinessesList),
  },
  {
    path: ':id',
    loadComponent: () => import('./business-detail/business-detail').then((m) => m.BusinessDetailPage),
  },
];
