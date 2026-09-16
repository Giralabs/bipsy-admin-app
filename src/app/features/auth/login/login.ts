import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, NotAdminError } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Query params (withComponentInputBinding). */
  readonly returnUrl = input<string | undefined>();
  readonly expired = input<string | undefined>();

  protected username = '';
  protected password = '';
  protected remember = false;
  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit() {
    if (!this.username.trim() || !this.password || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    this.auth.login({ username: this.username.trim(), password: this.password }, this.remember).subscribe({
      next: () => {
        const target = this.returnUrl();
        this.router.navigateByUrl(target && target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard');
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        if (err instanceof NotAdminError) {
          this.error.set(err.message);
        } else if (err instanceof HttpErrorResponse && err.status === 0) {
          this.error.set('No hay conexión con el servidor. ¿Está el backend arrancado?');
        } else if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 400)) {
          this.error.set('Usuario o contraseña incorrectos.');
        } else if (err instanceof HttpErrorResponse && err.status === 429) {
          this.error.set('Demasiados intentos. Espera un momento antes de volver a probar.');
        } else {
          this.error.set((err as HttpErrorResponse)?.error?.message || 'No se ha podido iniciar sesión.');
        }
      },
    });
  }
}
