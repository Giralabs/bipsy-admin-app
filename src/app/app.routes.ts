import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'users',
        loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
      },
      {
        path: 'businesses',
        loadChildren: () =>
          import('./features/businesses/businesses.routes').then((m) => m.BUSINESSES_ROUTES),
      },
      {
        path: 'tickets',
        loadChildren: () => import('./features/tickets/tickets.routes').then((m) => m.TICKETS_ROUTES),
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/categories/categories').then((m) => m.Categories),
      },
      {
        path: 'audit-log',
        loadComponent: () => import('./features/audit-log/audit-log').then((m) => m.AuditLog),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
