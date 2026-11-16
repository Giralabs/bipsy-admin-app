import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, map, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest } from '../models/auth.model';

const STORAGE_KEY = 'bipsy_admin_session';

/** FULL, SUPPORT or READONLY (see AdminScope in the backend). */
export type AdminScope = 'FULL' | 'SUPPORT' | 'READONLY';

interface StoredSession {
  accessToken: string;
  refreshToken: string | null;
  username: string;
  role: string;
  scope: AdminScope;
  name: string | null;
  email: string | null;
  /** How this admin does the second step; null if not chosen or not known yet. */
  twoFactor?: TwoFactorMethod | null;
  // True means localStorage (survives closing the browser).
  remember: boolean;
}

interface AdminMeResponse {
  id: number;
  name: string;
  email: string;
  adminScope: AdminScope;
  twoFactorMethod: TwoFactorMethod | null;
}

/**
 * Password accepted, code not written yet. Kept in memory only: a reload
 * starts the login again, and nothing half-verified is ever stored.
 */
interface PendingLogin {
  accessToken: string;
  refreshToken: string | null;
  username: string;
  remember: boolean;
}

/** Error code of an admin session that has not passed the second step (backend V130). */
export const MFA_REQUIRED = 'MFA_REQUIRED';

/** Where the second-step code comes from. */
export type TwoFactorMethod = 'EMAIL' | 'TOTP';

/** POST /auth/admin/2fa/start and /email. */
export interface TwoFactorStatus {
  /** Null the first time: the admin chooses. */
  method: TwoFactorMethod | null;
  email: string;
  /** With email: the code has gone out, seconds until another can be asked for. */
  resendInSeconds: number | null;
}

/** POST /auth/admin/2fa/totp/setup. */
export interface TotpSetup {
  secret: string;
  otpauthUri: string;
}

/**
 * Admin session. The access token lasts 30 min in the backend; when it expires,
 * the interceptor renews it with the refresh token (POST /auth/refresh) and
 * retries the request, so the panel does not kick you out mid-ticket.
 * If the refresh also fails, the session is closed and the user goes back to /login.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly session = signal<StoredSession | null>(this.readStoredSession());
  private refreshInFlight: Observable<string> | null = null;

  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isAdmin = computed(() => this.session()?.role === 'ADMIN');
  readonly username = computed(() => this.session()?.username ?? null);
  readonly displayName = computed(() => this.session()?.name || this.session()?.username || 'Admin');
  readonly email = computed(() => this.session()?.email ?? null);
  readonly twoFactor = computed(() => this.session()?.twoFactor ?? null);

  /** FULL while the scope is not resolved yet: never hides too much by default. */
  readonly scope = computed<AdminScope>(() => this.session()?.scope ?? 'FULL');
  readonly isReadOnly = computed(() => this.scope() === 'READONLY');
  readonly isSupportOnly = computed(() => this.scope() === 'SUPPORT');
  /** Can ban, sanction and change subscriptions, categories and settings. */
  readonly canManage = computed(() => this.scope() === 'FULL');
  /** Can write in support (FULL and SUPPORT). */
  readonly canSupport = computed(() => this.scope() !== 'READONLY');

  get accessToken(): string | null {
    return this.session()?.accessToken ?? null;
  }

  private readonly pending = signal<PendingLogin | null>(null);
  /** The email the second-step code went to, while it is being asked for. */
  readonly pendingEmail = computed(() => this.pending()?.username ?? null);

  /**
   * Step one: email and password. For an admin account the backend answers
   * with a session that does not open /admin/** yet; it is kept aside, and
   * the backend says how this account does the second step (null the first
   * time: the login lets the admin choose). With email, the code is already
   * on its way.
   */
  login(req: LoginRequest, remember: boolean): Observable<TwoFactorStatus> {
    // The backend signs in by email since V105: there is no username any more.
    const body = { email: req.username, password: req.password };
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, body).pipe(
      tap((res) => {
        if (res.role !== 'ADMIN') {
          throw new NotAdminError();
        }
        this.pending.set({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          username: res.username ?? req.username,
          remember,
        });
      }),
      switchMap(() => this.twoStep<TwoFactorStatus>('start')),
    );
  }

  /** Sends (or sends again) the code by email. */
  sendEmailCode(): Observable<TwoFactorStatus> {
    return this.twoStep<TwoFactorStatus>('email');
  }

  /** First time with an authenticator app: the seed and its QR link. */
  setupTotp(): Observable<TotpSetup> {
    return this.twoStep<TotpSetup>('totp/setup');
  }

  /**
   * Step two: the code from the email or the app. Swaps the pending session
   * for the verified one, which is the only one stored and the only one that
   * opens the panel. The first time, the method that works stays chosen.
   */
  verifyCode(code: string, method: TwoFactorMethod) {
    const p = this.pending();
    if (!p) return throwError(() => new Error('No hay un inicio de sesión a medias'));
    return this.http
      .post<AuthResponse>(
        `${environment.apiUrl}/auth/admin/2fa/verify`,
        { code, method, refreshToken: p.refreshToken },
        { headers: bearer(p.accessToken) },
      )
      .pipe(
        tap((res) => {
          this.pending.set(null);
          this.store({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            username: p.username,
            role: res.role,
            scope: 'FULL',
            name: null,
            email: null,
            remember: p.remember,
          });
        }),
        switchMap(() => this.http.get<AdminMeResponse>(`${environment.apiUrl}/admin/me`)),
        tap((me) => this.patch({ scope: me.adminScope, name: me.name, email: me.email, twoFactor: me.twoFactorMethod })),
      );
  }

  /** Back to the password step («Usar otra cuenta»). */
  cancelLogin() {
    this.pending.set(null);
  }

  /** «Mi cuenta» › change the method: the next sign in asks again. */
  resetTwoFactor() {
    return this.http.delete<void>(`${environment.apiUrl}/admin/me/two-factor`).pipe(tap(() => this.patch({ twoFactor: null })));
  }

  /** A call of the second step, with the pending session's token. */
  private twoStep<T>(path: string): Observable<T> {
    const p = this.pending();
    if (!p) return throwError(() => new Error('No hay un inicio de sesión a medias'));
    return this.http.post<T>(`${environment.apiUrl}/auth/admin/2fa/${path}`, {}, { headers: bearer(p.accessToken) });
  }

  /** Refreshes the scope, name and email of an already open session (after a reload). */
  refreshProfile() {
    this.http.get<AdminMeResponse>(`${environment.apiUrl}/admin/me`).subscribe({
      next: (me) => this.patch({ scope: me.adminScope, name: me.name, email: me.email, twoFactor: me.twoFactorMethod }),
      error: () => {},
    });
  }

  /**
   * Renews the access token. Several requests failing at once share ONE
   * refresh: if each one fired its own, the second would use an already
   * rotated refresh token and close the session.
   */
  refreshAccessToken(): Observable<string> {
    const refreshToken = this.session()?.refreshToken;
    if (!refreshToken) return throwError(() => new Error('Sin refresh token'));

    if (!this.refreshInFlight) {
      this.refreshInFlight = this.http
        .post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
        .pipe(
          tap((res) => this.patch({ accessToken: res.accessToken, refreshToken: res.refreshToken ?? refreshToken })),
          map((res) => res.accessToken),
          finalize(() => (this.refreshInFlight = null)),
          shareReplay(1),
        );
    }
    return this.refreshInFlight;
  }

  logout() {
    const refreshToken = this.session()?.refreshToken;
    if (refreshToken) {
      // Invalidates the refresh token on the server; if it fails it does not
      // matter, the local session is cleared anyway.
      this.http.post(`${environment.apiUrl}/auth/logout`, { refreshToken }).subscribe({ error: () => {} });
    }
    this.clear();
    this.router.navigateByUrl('/login');
  }

  /** The session is no longer valid (refresh token expired or revoked). */
  expire() {
    const returnUrl = this.router.url.startsWith('/login') ? undefined : this.router.url;
    this.clear();
    this.router.navigate(['/login'], { queryParams: { expired: 1, returnUrl } });
  }

  private clear() {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    this.session.set(null);
  }

  private store(s: StoredSession) {
    const target = s.remember ? localStorage : sessionStorage;
    const other = s.remember ? sessionStorage : localStorage;
    other.removeItem(STORAGE_KEY);
    target.setItem(STORAGE_KEY, JSON.stringify(s));
    this.session.set(s);
  }

  private patch(changes: Partial<StoredSession>) {
    const current = this.session();
    if (!current) return;
    this.store({ ...current, ...changes });
  }

  private readStoredSession(): StoredSession | null {
    const raw = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<StoredSession>;
      if (!parsed.accessToken) return null;
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken ?? null,
        username: parsed.username ?? '',
        role: parsed.role ?? '',
        scope: parsed.scope ?? 'FULL',
        name: parsed.name ?? null,
        email: parsed.email ?? null,
        twoFactor: parsed.twoFactor ?? null,
        remember: parsed.remember ?? false,
      };
    } catch {
      return null;
    }
  }
}

/** The pending session's token, sent by hand: it is not the stored session. */
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Valid credentials, but the account is not an admin account. */
export class NotAdminError extends Error {
  constructor() {
    super('Esta cuenta no tiene acceso al panel de administración.');
  }
}
