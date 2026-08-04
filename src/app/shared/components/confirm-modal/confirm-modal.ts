import { Component, input, output } from '@angular/core';

/** Modal de confirmacion generico: el padre controla su visibilidad con `open`. */
@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  templateUrl: './confirm-modal.html',
  styleUrl: './confirm-modal.scss',
})
export class ConfirmModal {
  readonly open = input.required<boolean>();
  readonly title = input('¿Estás seguro?');
  readonly message = input('Esta acción no se puede deshacer.');
  readonly confirmLabel = input('Confirmar');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
