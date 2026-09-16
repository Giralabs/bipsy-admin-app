import { Component, input } from '@angular/core';
import { Meta } from '../../../core/utils/labels';

/** Status pill built from a labels.ts Meta. */
@Component({
  selector: 'app-pill',
  template: `
    <span [class]="'pill pill--' + meta().tone">
      @if (meta().icon && icon()) { <span class="material-symbols-rounded">{{ meta().icon }}</span> }
      {{ meta().label }}
    </span>
  `,
  styles: `:host { display: inline-flex; }`,
})
export class Pill {
  readonly meta = input.required<Meta>();
  readonly icon = input(true);
}
