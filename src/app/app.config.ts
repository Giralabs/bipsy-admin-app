import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, ErrorHandler, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
} from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { GlobalErrorHandler, chunkNavigationErrorHandler } from './core/services/global-error-handler';

// Dates and numbers in Spanish: "16 sept 2026", "1.234,50 €".
registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // A lazy chunk that fails to load (tab left open across a deploy) goes to /error.
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      withNavigationErrorHandler(chunkNavigationErrorHandler),
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'es' },
  ],
};
