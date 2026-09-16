import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Only lets a logged-in admin through; everyone else goes to /login (and returns afterwards). */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated() && auth.isAdmin()) return true;
  const returnUrl = state.url && state.url !== '/' ? state.url : undefined;
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl } });
};

/** /login with an open session makes no sense: redirect to the panel. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated() && auth.isAdmin()) return inject(Router).createUrlTree(['/']);
  return true;
};
