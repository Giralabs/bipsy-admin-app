import { Component, input } from '@angular/core';
import { Reputation } from '../../../features/users/models/customer.model';

@Component({
  selector: 'app-reputation-badge',
  standalone: true,
  templateUrl: './reputation-badge.html',
  styleUrl: './reputation-badge.scss',
})
export class ReputationBadge {
  readonly reputation = input.required<Reputation>();

  readonly labels: Record<Reputation, string> = {
    GREEN: 'Sin incidencias',
    ORANGE: 'Atención',
    RED: 'Riesgo',
  };
}
