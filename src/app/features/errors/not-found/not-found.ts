import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

/**
 * Unknown URL. It lives inside the shell, so the menu and the search are still
 * there to get anywhere else; logged out, the guard sends to /login first.
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
})
export class NotFound {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  /**
   * What was typed, without the query string. A getter because the router
   * reuses this component when going from one unknown URL to another.
   */
  protected get path(): string {
    return this.router.url.split(/[?#]/)[0];
  }

  protected back() {
    this.location.back();
  }
}
