import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest } from '../models/auth.model';

const STORAGE_KEY = 'bipsy_admin_session';

interface StoredSession {
  accessToken: string;
  username: string;
  role: string;
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

  constructor(private http: HttpClient, private router: Router) {}

  login(req: LoginRequest) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, req)
      .pipe(tap((res) => this.storeSession(res)));
  }

  logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    this.session.set(null);
    this.router.navigateByUrl('/login');
  }

  get accessToken(): string | null {
    return this.session()?.accessToken ?? null;
  }

  private storeSession(res: AuthResponse) {
    const stored: StoredSession = { accessToken: res.accessToken, username: res.username, role: res.role };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    this.session.set(stored);
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
