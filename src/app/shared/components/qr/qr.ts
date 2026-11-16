import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import qrcode from 'qrcode-generator';

/** The four modules of white a reader needs around the code. */
const QUIET_ZONE = 4;

/**
 * A QR code as a vector, like `pn-qr` in the Business panel. Dark on white
 * ALWAYS, also with the panel in dark: many readers cannot read a negative.
 */
@Component({
  selector: 'app-qr',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="drawing().viewBox" role="img" [attr.aria-label]="label()" shape-rendering="crispEdges">
      <rect width="100%" height="100%" fill="#FFFFFF" />
      <path [attr.d]="drawing().path" fill="#1C1F23" />
    </svg>
  `,
  styles: [`:host { display: block; } svg { display: block; width: 100%; height: auto; border-radius: 12px; }`],
})
export class Qr {
  readonly data = input.required<string>();
  readonly label = input('Código QR');

  protected readonly drawing = computed(() => {
    const code = qrcode(0, 'M');
    code.addData(this.data(), 'Byte');
    code.make();
    const size = code.getModuleCount();
    let path = '';
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (code.isDark(row, col)) path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
      }
    }
    const side = size + QUIET_ZONE * 2;
    return { viewBox: `0 0 ${side} ${side}`, path };
  });
}
