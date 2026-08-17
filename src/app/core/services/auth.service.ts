import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest } from '../models/auth.model';

const STORAGE_KEY = 'bipsy_admin_session';

/** FULL, SUPPORT o READONLY (ver AdminScope en el backend). */
export type AdminScope = 'FULL' | 'SUPPORT' | 'READONLY';

interface StoredSession {
  accessToken: string;
  username: string;
  role: string;
  scope: AdminScope;
}

interface AdminMeResponse {
  id: number;
  name: string;
  email: string;
  adminScope: AdminScope;
}

/**
 * Sesion del admin logueado. Guarda solo el access token (30 min de vida en
 * el backend): si caduca, el guard manda de vuelta a /login. No se
 * implementa refresh automatico porque este panel no necesita sesiones
 * largas sin supervision.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly session = signal<StoredSession | null>(this.readStoredSession());

  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isAdmin = computed(() => this.session()?.role === 'ADMIN');
  readonly username = computed(() => this.session()?.username ?? null);

  /** FULL si aun no se ha resuelto el scope (sesiones antiguas, o mientras carga): nunca oculta de más por defecto. */
  readonly scope = computed<AdminScope>(() => this.session()?.scope ?? 'FULL');
  readonly isReadOnly = computed(() => this.scope() === 'READONLY');
  readonly isSupportOnly = computed(() => this.scope() === 'SUPPORT');
  /** Puede banear/sancionar/tocar suscripciones y categorías. */
  readonly canManage = computed(() => this.scope() === 'FULL');

  constructor(private http: HttpClient, private router: Router) {}

  login(req: LoginRequest) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, req).pipe(
      tap((res) => this.storeSession(res, 'FULL')),
      switchMap(() => this.http.get<AdminMeResponse>(`${environment.apiUrl}/admin/me`)),
      tap((me) => this.patchScope(me.adminScope)),
    );
  }

  /** Refresca el scope de una sesion ya abierta (p.ej. tras recargar la pagina). */
  refreshScope() {
    this.http
      .get<AdminMeResponse>(`${environment.apiUrl}/admin/me`)
      .subscribe({ next: (me) => this.patchScope(me.adminScope), error: () => {} });
  }

  logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    this.session.set(null);
    this.router.navigateByUrl('/login');
  }

  get accessToken(): string | null {
    return this.session()?.accessToken ?? null;
  }

  private storeSession(res: AuthResponse, scope: AdminScope) {
    const stored: StoredSession = { accessToken: res.accessToken, username: res.username, role: res.role, scope };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    this.session.set(stored);
  }

  private patchScope(scope: AdminScope) {
    const current = this.session();
    if (!current) return;
    const updated = { ...current, scope };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    this.session.set(updated);
  }

  private readStoredSession(): StoredSession | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      return null;
    }
  }
}
