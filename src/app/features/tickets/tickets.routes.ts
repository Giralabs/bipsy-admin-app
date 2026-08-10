import { Routes } from '@angular/router';

export const TICKETS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tickets-list/tickets-list').then((m) => m.TicketsList),
  },
  {
    path: ':id',
    loadComponent: () => import('./ticket-detail/ticket-detail').then((m) => m.TicketDetailPage),
  },
];
