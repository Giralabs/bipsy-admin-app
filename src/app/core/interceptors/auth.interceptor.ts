import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService, MFA_REQUIRED } from '../services/auth.service';

// /auth routes that never carry a token nor trigger a refresh.
const PUBLIC_AUTH = ['/auth/login', '/auth/refresh', '/auth/logout'];

// The second step of the login carries the pending session's token, set by
// AuthService, and must not be swapped for the stored one or refreshed.
const TWO_STEP = '/auth/admin/2fa/';

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
 *
 * A 403 MFA_REQUIRED means a session opened before two-step verification
 * existed (or one that skipped it): it is closed and the login asks again,
 * code included.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (PUBLIC_AUTH.some((p) => req.url.endsWith(p)) || req.url.includes(TWO_STEP)) {
    return next(withToken(req, null));
  }

  return next(withToken(req, auth.accessToken)).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 403 && err.error?.error === MFA_REQUIRED && auth.isAuthenticated()) {
        auth.expire();
        return throwError(() => err);
      }
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
