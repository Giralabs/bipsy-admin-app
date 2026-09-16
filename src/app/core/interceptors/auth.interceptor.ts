import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// /auth routes that never carry a token nor trigger a refresh.
const PUBLIC_AUTH = ['/auth/login', '/auth/refresh', '/auth/logout'];

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

/**
 * Attaches the access token and, if the backend responds 401 (expired token),
 * renews it once and repeats the request. If it cannot be renewed, the session
 * is considered over.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (PUBLIC_AUTH.some((p) => req.url.endsWith(p))) return next(req);

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
