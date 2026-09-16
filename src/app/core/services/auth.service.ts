import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, map, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest } from '../models/auth.model';

const STORAGE_KEY = 'bipsy_admin_session';

/** FULL, SUPPORT o READONLY (ver AdminScope en el backend). */
export type AdminScope = 'FULL' | 'SUPPORT' | 'READONLY';

interface StoredSession {
  accessToken: string;
  refreshToken: string | null;
  username: string;
  role: string;
  scope: AdminScope;
  name: string | null;
  email: string | null;
  /** true = localStorage (sobrevive a cerrar el navegador). */
  remember: boolean;
}

interface AdminMeResponse {
  id: number;
  name: string;
  email: string;
  adminScope: AdminScope;
}

/**
 * Sesión del admin. El access token dura 30 min en el backend; cuando caduca,
 * el interceptor lo renueva con el refresh token (POST /auth/refresh) y
 * reintenta la petición, así que el panel no te echa a mitad de un ticket.
 * Si el refresh también falla, se cierra la sesión y se vuelve a /login.
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

  /** FULL si aún no se ha resuelto el scope: nunca oculta de más por defecto. */
  readonly scope = computed<AdminScope>(() => this.session()?.scope ?? 'FULL');
  readonly isReadOnly = computed(() => this.scope() === 'READONLY');
  readonly isSupportOnly = computed(() => this.scope() === 'SUPPORT');
  /** Puede banear, sancionar y tocar suscripciones, categorías y ajustes. */
  readonly canManage = computed(() => this.scope() === 'FULL');
  /** Puede escribir en soporte (FULL y SUPPORT). */
  readonly canSupport = computed(() => this.scope() !== 'READONLY');

  get accessToken(): string | null {
    return this.session()?.accessToken ?? null;
  }

  login(req: LoginRequest, remember: boolean) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, req).pipe(
      tap((res) => {
        if (res.role !== 'ADMIN') {
          throw new NotAdminError();
        }
        this.store({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          username: res.username,
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

  /** Refresca scope, nombre y email de una sesión ya abierta (tras recargar). */
  refreshProfile() {
    this.http.get<AdminMeResponse>(`${environment.apiUrl}/admin/me`).subscribe({
      next: (me) => this.patch({ scope: me.adminScope, name: me.name, email: me.email }),
      error: () => {},
    });
  }

  /**
   * Renueva el access token. Varias peticiones que fallen a la vez comparten
   * UN solo refresh: si cada una lanzara el suyo, el segundo usaría un refresh
   * token ya rotado y cerraría la sesión.
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
      // Invalida el refresh token en el servidor; si falla da igual, la sesión
      // local se borra de todas formas.
      this.http.post(`${environment.apiUrl}/auth/logout`, { refreshToken }).subscribe({ error: () => {} });
    }
    this.clear();
    this.router.navigateByUrl('/login');
  }

  /** La sesión ya no vale (refresh caducado o revocado). */
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

/** Credenciales correctas, pero la cuenta no es de administración. */
export class NotAdminError extends Error {
  constructor() {
    super('Esta cuenta no tiene acceso al panel de administración.');
  }
}
