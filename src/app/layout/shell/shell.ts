import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { GlobalSearch } from '../../shared/components/global-search/global-search';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, GlobalSearch],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  constructor(protected auth: AuthService) {}
}
