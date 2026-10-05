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
  // True means localStorage (survives closing the browser).
  remember: boolean;
}

interface AdminMeResponse {
  id: number;
  name: string;
  email: string;
  adminScope: AdminScope;
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

  login(req: LoginRequest, remember: boolean) {
    // The backend signs in by email since V105: there is no username any more.
    const body = { email: req.username, password: req.password };
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, body).pipe(
      tap((res) => {
        if (res.role !== 'ADMIN') {
          throw new NotAdminError();
        }
        this.store({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          username: res.username ?? req.username,
          role: res.role,
          scope: 'FULL',
          name: null,
          email: null,
          remember,
        });
      }),
      switchMap(() => this.http.get<AdminMeResponse>(`${environment.apiUrl}/admin/me`)),
      tap((me) => this.patch({ scope: me.adminScope, name: me.name, email: me.email })),
    );
  }

  /** Refreshes the scope, name and email of an already open session (after a reload). */
  refreshProfile() {
    this.http.get<AdminMeResponse>(`${environment.apiUrl}/admin/me`).subscribe({
      next: (me) => this.patch({ scope: me.adminScope, name: me.name, email: me.email }),
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
        remember: parsed.remember ?? false,
      };
    } catch {
      return null;
    }
  }
}

/** Valid credentials, but the account is not an admin account. */
export class NotAdminError extends Error {
  constructor() {
    super('Esta cuenta no tiene acceso al panel de administración.');
  }
}
