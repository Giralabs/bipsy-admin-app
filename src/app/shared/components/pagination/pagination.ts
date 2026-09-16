import { Component, computed, input, output } from '@angular/core';
import { formatInt } from '../../../core/utils/format';

/** Table footer: "41–60 de 214" and the arrows. Pages are 0-based, like Spring. */
@Component({
  selector: 'app-pagination',
  template: `
    <div class="table-foot">
      <span class="t-num">
        @if (total() > 0) { {{ from() }}–{{ to() }} de {{ totalLabel() }} } @else { Sin resultados }
      </span>
      <div class="cluster">
        <button type="button" class="btn btn--ghost btn--icon btn--sm" (click)="pageChange.emit(page() - 1)"
          [disabled]="page() <= 0" aria-label="Página anterior">
          <span class="material-symbols-rounded">chevron_left</span>
        </button>
        <span class="t-num t-faint">{{ page() + 1 }} / {{ pages() || 1 }}</span>
        <button type="button" class="btn btn--ghost btn--icon btn--sm" (click)="pageChange.emit(page() + 1)"
          [disabled]="page() + 1 >= pages()" aria-label="Página siguiente">
          <span class="material-symbols-rounded">chevron_right</span>
        </button>
      </div>
    </div>
  `,
})
export class Pagination {
  readonly page = input.required<number>();
  readonly size = input.required<number>();
  readonly total = input.required<number>();
  readonly pages = input.required<number>();
  readonly pageChange = output<number>();

  protected readonly from = computed(() => this.page() * this.size() + 1);
  protected readonly to = computed(() => Math.min(this.total(), (this.page() + 1) * this.size()));
  protected readonly totalLabel = computed(() => formatInt(this.total()));
}
