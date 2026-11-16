import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, NotAdminError } from '../../../core/services/auth.service';

/**
 * Sign in, in two steps: email and password, then the 6-digit code that the
 * backend emails to the account (two-step verification, backend V130). Only
 * after the code is there a stored session.
 */
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
  protected code = '';
  protected readonly step = signal<'password' | 'code'>('password');
  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Seconds until «Reenviar código» is available again. */
  protected readonly resendIn = signal(0);
  protected readonly email = this.auth.pendingEmail;

  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stopTimer();
      // Leaving halfway drops the unverified session.
      if (this.step() === 'code') this.auth.cancelLogin();
    });
  }

  protected submit() {
    if (!this.username.trim() || !this.password || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    this.auth.login({ username: this.username.trim(), password: this.password }, this.remember).subscribe({
      next: (resendIn) => {
        this.submitting.set(false);
        this.password = '';
        this.step.set('code');
        this.startTimer(resendIn);
        setTimeout(() => this.codeInput()?.nativeElement.focus());
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        if (err instanceof NotAdminError) {
          this.error.set(err.message);
        } else if (err instanceof HttpErrorResponse && err.status === 0) {
          this.error.set('No hay conexión con el servidor. ¿Está el backend arrancado?');
        } else if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 400)) {
          this.error.set('Correo o contraseña incorrectos.');
        } else if (err instanceof HttpErrorResponse && err.status === 429) {
          this.error.set('Demasiados intentos. Espera un momento antes de volver a probar.');
        } else {
          this.error.set('No se ha podido iniciar sesión. Si sigue pasando, avisa al equipo.');
        }
      },
    });
  }

  /** Only digits, and it sends itself when the sixth one is in. */
  protected onCode(value: string) {
    this.code = value.replace(/\D/g, '').slice(0, 6);
    if (this.error()) this.error.set(null);
    if (this.code.length === 6) this.verify();
  }

  protected verify() {
    if (this.code.length !== 6 || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    this.auth.verifyCode(this.code).subscribe({
      next: () => {
        this.stopTimer();
        const target = this.returnUrl();
        this.router.navigateByUrl(target && target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard');
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.code = '';
        if (err instanceof HttpErrorResponse && err.status === 400) {
          this.error.set('El código no es correcto o ha caducado. Revisa el último correo o pide otro.');
        } else if (err instanceof HttpErrorResponse && err.status === 401) {
          this.error.set('Ha pasado demasiado tiempo. Vuelve a escribir tu contraseña.');
          this.back();
        } else if (err instanceof HttpErrorResponse && err.status === 0) {
          this.error.set('No hay conexión con el servidor.');
        } else {
          this.error.set('No se ha podido comprobar el código.');
        }
        setTimeout(() => this.codeInput()?.nativeElement.focus());
      },
    });
  }

  protected resend() {
    if (this.resendIn() > 0 || this.submitting()) return;
    this.error.set(null);
    this.auth.sendCode().subscribe({
      next: (seconds) => this.startTimer(seconds),
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 429) {
          this.error.set('Espera un poco antes de pedir otro código.');
        } else if (err instanceof HttpErrorResponse && err.status === 401) {
          this.error.set('Ha pasado demasiado tiempo. Vuelve a escribir tu contraseña.');
          this.back();
        } else {
          this.error.set('No se ha podido enviar el código.');
        }
      },
    });
  }

  /** «Usar otra cuenta»: back to the first step. */
  protected back() {
    this.auth.cancelLogin();
    this.stopTimer();
    this.code = '';
    this.step.set('password');
  }

  private startTimer(seconds: number) {
    this.stopTimer();
    this.resendIn.set(Math.max(0, Math.round(seconds)));
    this.timer = setInterval(() => {
      const left = this.resendIn() - 1;
      this.resendIn.set(Math.max(0, left));
      if (left <= 0) this.stopTimer();
    }, 1000);
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
