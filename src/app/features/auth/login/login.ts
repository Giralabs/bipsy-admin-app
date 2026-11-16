import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, NotAdminError, TotpSetup, TwoFactorMethod, TwoFactorStatus } from '../../../core/services/auth.service';
import { Qr } from '../../../shared/components/qr/qr';

/**
 * Where the login is:
 *  - password: email and password.
 *  - choose:   first time, no second step yet: email code or authenticator app.
 *  - email:    the code that went to the email.
 *  - setup:    first time with an app: the QR, then its first code.
 *  - totp:     the code the app shows now.
 */
type Step = 'password' | 'choose' | 'email' | 'setup' | 'totp';

/**
 * Sign in, in two steps (backend V130): email and password, then a 6-digit
 * code from the email or from an authenticator app. The first time, the admin
 * chooses which; after that the login goes straight to it. Only after the
 * code is there a stored session.
 */
@Component({
  selector: 'app-login',
  imports: [FormsModule, NgTemplateOutlet, Qr],
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
  protected readonly step = signal<Step>('password');
  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Seconds until «Reenviar código» is available again. */
  protected readonly resendIn = signal(0);
  protected readonly email = signal('');
  protected readonly setup = signal<TotpSetup | null>(null);
  protected readonly copied = signal(false);
  /** The seed in groups of four, easier to type by hand. */
  protected readonly secretGroups = computed(() => this.setup()?.secret.match(/.{1,4}/g)?.join(' ') ?? '');

  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stopTimer();
      // Leaving halfway drops the unverified session.
      if (this.step() !== 'password') this.auth.cancelLogin();
    });
  }

  protected submit() {
    if (!this.username.trim() || !this.password || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    this.auth.login({ username: this.username.trim(), password: this.password }, this.remember).subscribe({
      next: (status) => {
        this.submitting.set(false);
        this.password = '';
        this.email.set(status.email);
        if (status.method === 'EMAIL') this.toEmail(status);
        else if (status.method === 'TOTP') this.toCode('totp');
        else this.step.set('choose');
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

  // ----- FIRST TIME: CHOOSE --------------------

  protected chooseEmail() {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.auth.sendEmailCode().subscribe({
      next: (status) => {
        this.submitting.set(false);
        this.toEmail(status);
      },
      error: (err: unknown) => this.fail(err, 'No se ha podido enviar el código.'),
    });
  }

  protected chooseApp() {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.auth.setupTotp().subscribe({
      next: (setup) => {
        this.submitting.set(false);
        this.setup.set(setup);
        this.toCode('setup');
      },
      error: (err: unknown) => this.fail(err, 'No se ha podido preparar la app.'),
    });
  }

  protected copySecret() {
    const secret = this.setup()?.secret;
    if (!secret) return;
    navigator.clipboard?.writeText(secret).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    });
  }

  // ----- THE CODE --------------------

  /** Only digits, and it sends itself when the sixth one is in. */
  protected onCode(value: string) {
    this.code = value.replace(/\D/g, '').slice(0, 6);
    if (this.error()) this.error.set(null);
    if (this.code.length === 6) this.verify();
  }

  protected verify() {
    if (this.code.length !== 6 || this.submitting()) return;
    const method: TwoFactorMethod = this.step() === 'email' ? 'EMAIL' : 'TOTP';
    this.submitting.set(true);
    this.error.set(null);

    this.auth.verifyCode(this.code, method).subscribe({
      next: () => {
        this.stopTimer();
        const target = this.returnUrl();
        this.router.navigateByUrl(target && target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard');
      },
      error: (err: unknown) => {
        this.code = '';
        if (err instanceof HttpErrorResponse && err.status === 400) {
          this.submitting.set(false);
          this.error.set(
            method === 'EMAIL'
              ? 'El código no es correcto o ha caducado. Revisa el último correo o pide otro.'
              : 'El código no es correcto. Escribe el que muestra la app ahora mismo.',
          );
        } else {
          this.fail(err, 'No se ha podido comprobar el código.');
        }
        setTimeout(() => this.codeInput()?.nativeElement.focus());
      },
    });
  }

  protected resend() {
    if (this.resendIn() > 0 || this.submitting()) return;
    this.error.set(null);
    this.auth.sendEmailCode().subscribe({
      next: (status) => this.startTimer(status.resendInSeconds ?? 30),
      error: (err: unknown) => this.fail(err, 'No se ha podido enviar el código.'),
    });
  }

  /** From the app setup back to the choice. */
  protected backToChoice() {
    this.stopTimer();
    this.code = '';
    this.error.set(null);
    this.setup.set(null);
    this.step.set('choose');
  }

  /** «Usar otra cuenta»: back to the first step. */
  protected back() {
    this.auth.cancelLogin();
    this.stopTimer();
    this.code = '';
    this.setup.set(null);
    this.step.set('password');
  }

  // ----- HELPERS --------------------

  private toEmail(status: TwoFactorStatus) {
    this.toCode('email');
    this.startTimer(status.resendInSeconds ?? 30);
  }

  private toCode(step: Step) {
    this.code = '';
    this.step.set(step);
    setTimeout(() => this.codeInput()?.nativeElement.focus());
  }

  private fail(err: unknown, fallback: string) {
    this.submitting.set(false);
    if (err instanceof HttpErrorResponse && err.status === 401) {
      this.back();
      this.error.set('Ha pasado demasiado tiempo. Vuelve a escribir tu contraseña.');
    } else if (err instanceof HttpErrorResponse && err.status === 429) {
      this.error.set(
        this.step() === 'email'
          ? 'Espera un poco antes de pedir otro código.'
          : 'Demasiados códigos incorrectos. Espera unos minutos antes de volver a probar.',
      );
    } else if (err instanceof HttpErrorResponse && err.status === 0) {
      this.error.set('No hay conexión con el servidor.');
    } else {
      this.error.set(fallback);
    }
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
