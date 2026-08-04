import { Routes } from '@angular/router';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./users-list/users-list').then((m) => m.UsersList),
  },
  {
    path: ':id',
    loadComponent: () => import('./user-detail/user-detail').then((m) => m.UserDetail),
  },
];
