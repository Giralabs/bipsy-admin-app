import { Injectable, signal } from '@angular/core';
import { apiErrorMessage } from '../utils/api-error';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

/**
 * Short notices at the very bottom. Previously every panel error was swallowed
 * silently (`error: () => loading.set(false)`) and a failed ban looked as if
 * nothing had happened.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  success(message: string) {
    this.push('success', message);
  }

  info(message: string) {
    this.push('info', message);
  }

  /** Accepts a message or the HTTP error directly. */
  error(errOrMessage: unknown, fallback = 'Algo ha fallado. Inténtalo de nuevo.') {
    const message = typeof errOrMessage === 'string' ? errOrMessage : apiErrorMessage(errOrMessage, fallback);
    this.push('error', message);
  }

  dismiss(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(tone: ToastTone, message: string) {
    const id = this.nextId++;
    this.toasts.update((list) => [...list.slice(-3), { id, tone, message }]);
    setTimeout(() => this.dismiss(id), tone === 'error' ? 6000 : 3500);
  }
}
