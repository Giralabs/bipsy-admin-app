import { ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { NavigationError, RedirectCommand, Router } from '@angular/router';
import { chunkFailureKind, errorPageUrl, isChunkLoadError, isErrorUrl } from '../utils/error-page';

/**
 * Sends the user to /error when a lazy chunk cannot be downloaded (a tab left
 * open across a deploy). Everything else is logged as Angular does by default
 * and stays where it is: each screen already shows its own errors, and a
 * global page for any runtime error would hide them.
 *
 * It cannot loop: it does nothing while already on /error or while its own
 * redirect is in flight, and the error page is not lazy, so it cannot be the
 * chunk that fails.
 */
@Injectable()
export class GlobalErrorHandler extends ErrorHandler {
  // Not `inject(Router)`: the router is built after the error handler.
  private readonly injector = inject(Injector);
  private redirecting = false;

  override handleError(error: unknown) {
    super.handleError(error);
    if (this.redirecting || !isChunkLoadError(error)) return;

    let router: Router;
    try {
      router = this.injector.get(Router);
    } catch {
      return;
    }
    if (isErrorUrl(router.url)) return;

    this.redirecting = true;
    router
      .navigateByUrl(errorPageUrl(chunkFailureKind(), router.url))
      .catch(() => {})
      .finally(() => (this.redirecting = false));
  }
}

/**
 * Same thing for the usual case, a lazy ROUTE that fails to load. Here the
 * router knows where the user was going, so «Recargar» can take them there
 * instead of back to the screen they came from. Returning nothing leaves the
 * error to the router, as if this handler did not exist.
 */
export function chunkNavigationErrorHandler(e: NavigationError): RedirectCommand | void {
  if (!isChunkLoadError(e.error) || isErrorUrl(e.url)) return;
  return new RedirectCommand(inject(Router).parseUrl(errorPageUrl(chunkFailureKind(), e.url)));
}
