import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Solo deja pasar a un admin logueado; el resto va a /login. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated() && auth.isAdmin()) return true;
  return inject(Router).createUrlTree(['/login']);
};
