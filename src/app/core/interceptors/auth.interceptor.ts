import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// /auth routes that never carry a token nor trigger a refresh.
const PUBLIC_AUTH = ['/auth/login', '/auth/refresh', '/auth/logout'];

// Which app is asking. Since backend V105 an email can hold a customer account
// and a professional one, and /auth/login answers 400 without this header.
// Platform admins live in the CUSTOMER scope (see AccountScope in the backend).
const SCOPE = { 'X-Bipsy-Scope': 'CUSTOMER' };

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
  req.clone({ setHeaders: token ? { ...SCOPE, Authorization: `Bearer ${token}` } : SCOPE });

/**
 * Attaches the access token and, if the backend responds 401 (expired token),
 * renews it once and repeats the request. If it cannot be renewed, the session
 * is considered over.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (PUBLIC_AUTH.some((p) => req.url.endsWith(p))) return next(withToken(req, null));

  return next(withToken(req, auth.accessToken)).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || !auth.isAuthenticated()) {
        return throwError(() => err);
      }
      return auth.refreshAccessToken().pipe(
        catchError((refreshErr) => {
          auth.expire();
          return throwError(() => refreshErr);
        }),
        switchMap((token) => next(withToken(req, token))),
      );
    }),
  );
};
