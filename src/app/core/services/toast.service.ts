import { Injectable, signal } from '@angular/core';
import { apiErrorMessage } from '../utils/api-error';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

/**
 * Avisos breves abajo del todo. Antes cada error del panel se tragaba en
 * silencio (`error: () => loading.set(false)`) y un baneo fallido parecía
 * no haber pasado nada.
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

  /** Acepta un mensaje o directamente el error HTTP. */
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
