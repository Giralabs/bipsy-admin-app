import { Component } from '@angular/core';
import { ReviewsList } from '../../shared/components/reviews-list/reviews-list';

/** Todas las reseñas publicadas, de la más reciente a la más antigua. */
@Component({
  selector: 'app-reviews',
  imports: [ReviewsList],
  template: `
    <div class="page page--narrow">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="t-display">Reseñas</h1>
          <p class="page-head__sub">Lo que opinan los clientes de cada negocio. Retira las que incumplan las normas.</p>
        </div>
      </header>
      <app-reviews-list [showFilter]="true" />
    </div>
  `,
})
export class Reviews {}
