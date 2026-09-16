import { Component, computed, input, signal } from '@angular/core';
import { initials } from '../../../core/utils/format';

/**
 * Photo of a person or business, with initials as a fallback. A photo that
 * returns 404 falls back to the initials instead of showing a broken icon.
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
