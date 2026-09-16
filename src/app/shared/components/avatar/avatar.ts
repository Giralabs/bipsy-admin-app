import { Component, computed, input, signal } from '@angular/core';
import { initials } from '../../../core/utils/format';

/**
 * Foto de una persona o negocio, con iniciales de reserva. Una foto que da
 * 404 cae a las iniciales en vez de dejar un icono roto.
 */
@Component({
  selector: 'app-avatar',
  template: `
    <span class="avatar" [class.avatar--square]="square()"
      [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="fontSize()">
      @if (src() && !broken()) {
        <img [src]="src()" [alt]="name() || ''" (error)="broken.set(true)" loading="lazy" />
      } @else {
        {{ letters() }}
      }
    </span>
  `,
  styles: `:host { display: inline-flex; }`,
})
export class Avatar {
  readonly name = input<string | null>(null);
  readonly src = input<string | null | undefined>(null);
  readonly size = input(36);
  readonly square = input(false);

  protected readonly broken = signal(false);
  protected readonly letters = computed(() => initials(this.name()));
  protected readonly fontSize = computed(() => Math.round(this.size() * 0.36));
}
