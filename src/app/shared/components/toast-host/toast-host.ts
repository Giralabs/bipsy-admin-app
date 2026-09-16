import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-host',
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="'toast toast--' + t.tone" role="status">
          <span class="material-symbols-rounded fill">{{ icons[t.tone] }}</span>
          <span class="toast__msg">{{ t.message }}</span>
          <button type="button" class="toast__close" (click)="toast.dismiss(t.id)" aria-label="Cerrar">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
      z-index: 1000; display: flex; flex-direction: column; gap: 8px; align-items: center;
      width: min(480px, calc(100vw - 32px)); pointer-events: none;
    }
    .toast {
      pointer-events: auto; display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 10px 10px 10px 16px; border-radius: 18px;
      background: #15171a; color: #f5f7f6; box-shadow: var(--shadow-float);
      font-size: 0.875rem; font-weight: 600; animation: pop .22s var(--ease-out) both;
    }
    .toast__msg { flex: 1; min-width: 0; }
    .toast--success .material-symbols-rounded.fill { color: #7fd1a6; }
    .toast--error .material-symbols-rounded.fill { color: #ff8a80; }
    .toast--info .material-symbols-rounded.fill { color: #c0eed3; }
    .toast__close {
      border: none; background: none; color: #b5c3be; cursor: pointer;
      width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
    }
    .toast__close:hover { background: rgba(255,255,255,.08); color: #fff; }
    .toast__close .material-symbols-rounded { font-size: 18px; }
  `,
})
export class ToastHost {
  protected readonly toast = inject(ToastService);
  protected readonly icons = { success: 'check_circle', error: 'error', info: 'info' } as const;
}
