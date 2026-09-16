import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { adminGuard, guestGuard } from './core/guards/admin.guard';
import { PreferencesService } from './core/services/preferences.service';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Entrar · Bipsy Admin',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      // The landing page depends on the layout chosen in Mi cuenta: tiles or dashboard.
      {
        path: '',
        pathMatch: 'full',
        redirectTo: () => (inject(PreferencesService).layout() === 'tiles' ? 'home' : 'dashboard'),
      },
      {
        path: 'home',
        title: 'Inicio · Bipsy Admin',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'dashboard',
        title: 'Resumen · Bipsy Admin',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'users',
        title: 'Clientes · Bipsy Admin',
        loadComponent: () => import('./features/users/users-list/users-list').then((m) => m.UsersList),
      },
      {
        path: 'users/:id',
        title: 'Cliente · Bipsy Admin',
        loadComponent: () => import('./features/users/user-detail/user-detail').then((m) => m.UserDetail),
      },
      {
        path: 'businesses',
        title: 'Negocios · Bipsy Admin',
        loadComponent: () =>
          import('./features/businesses/businesses-list/businesses-list').then((m) => m.BusinessesList),
      },
      {
        path: 'businesses/:id',
        title: 'Negocio · Bipsy Admin',
        loadComponent: () =>
          import('./features/businesses/business-detail/business-detail').then((m) => m.BusinessDetailPage),
      },
      {
        path: 'tickets',
        title: 'Soporte · Bipsy Admin',
        loadComponent: () => import('./features/tickets/tickets-list/tickets-list').then((m) => m.TicketsList),
      },
      {
        path: 'tickets/:id',
        title: 'Ticket · Bipsy Admin',
        loadComponent: () => import('./features/tickets/ticket-detail/ticket-detail').then((m) => m.TicketDetailPage),
      },
      {
        // Same inbox as Soporte, filtered by type (data → input `kind`).
        path: 'improvements',
        title: 'Solicitudes de mejora · Bipsy Admin',
        data: { kind: 'IMPROVEMENT' },
        loadComponent: () => import('./features/tickets/tickets-list/tickets-list').then((m) => m.TicketsList),
      },
      {
        path: 'reviews',
        title: 'Reseñas · Bipsy Admin',
        loadComponent: () => import('./features/reviews/reviews').then((m) => m.Reviews),
      },
      {
        path: 'team',
        title: 'Equipo del panel · Bipsy Admin',
        loadComponent: () => import('./features/team/team').then((m) => m.Team),
      },
      {
        path: 'reports',
        title: 'Reportes · Bipsy Admin',
        loadComponent: () => import('./features/reports/reports').then((m) => m.Reports),
      },
      {
        path: 'onboarding',
        title: 'Bienvenidas · Bipsy Admin',
        loadComponent: () => import('./features/onboarding/onboarding').then((m) => m.Onboarding),
      },
      {
        path: 'payments',
        title: 'Cobros · Bipsy Admin',
        loadComponent: () => import('./features/payments/payments').then((m) => m.Payments),
      },
      {
        path: 'payments/:id',
        title: 'Cobro · Bipsy Admin',
        loadComponent: () => import('./features/payments/payment-detail/payment-detail').then((m) => m.PaymentDetailPage),
      },
      {
        path: 'legal',
        title: 'Legal · Bipsy Admin',
        loadComponent: () => import('./features/legal/legal').then((m) => m.Legal),
      },
      {
        path: 'plans',
        title: 'Planes y ofertas · Bipsy Admin',
        loadComponent: () => import('./features/plans/plans').then((m) => m.Plans),
      },
      {
        path: 'categories',
        title: 'Categorías · Bipsy Admin',
        loadComponent: () => import('./features/categories/categories').then((m) => m.Categories),
      },
      {
        path: 'discovery',
        title: 'Explorar · Bipsy Admin',
        loadComponent: () => import('./features/discovery/discovery').then((m) => m.Discovery),
      },
      {
        path: 'referrals',
        title: 'Referidos · Bipsy Admin',
        loadComponent: () => import('./features/referrals/referrals').then((m) => m.Referrals),
      },
      {
        path: 'audit-log',
        title: 'Auditoría · Bipsy Admin',
        loadComponent: () => import('./features/audit-log/audit-log').then((m) => m.AuditLog),
      },
      {
        path: 'account',
        title: 'Mi cuenta · Bipsy Admin',
        loadComponent: () => import('./features/account/account').then((m) => m.Account),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
