import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { ErrorKind, markReload, safeReturnUrl, toErrorKind } from '../../../core/utils/error-page';

interface Copy {
  code: string | null;
  icon: string;
  title: string;
  text: string;
  /** Main button. `null` leaves only «Volver al inicio». */
  retry: 'Reintentar' | 'Recargar' | null;
  quote: string;
}

const COPY: Record<ErrorKind, Copy> = {
  unexpected: {
    code: '500',
    icon: 'error',
    title: 'Algo ha fallado',
    text: 'Ha ocurrido un error inesperado. No es cosa tuya: vuelve a intentarlo y, si sigue pasando, avisa al equipo técnico.',
    retry: 'Reintentar',
    quote: '«Ups. Dame un momento y lo intentamos otra vez.»',
  },
  offline: {
    code: null,
    icon: 'cloud_off',
    title: 'Sin conexión',
    text: 'No se ha podido contactar con el servidor. Comprueba tu conexión a internet; si es cosa del servidor, volverá en unos minutos.',
    retry: 'Reintentar',
    quote: '«No llego al servidor. Sigo aquí en cuanto vuelva.»',
  },
  forbidden: {
    code: '403',
    icon: 'lock',
    title: 'No tienes permiso',
    text: 'Tu rol de admin no puede ver o hacer esto. Los permisos los asigna un admin con acceso completo desde «Equipo del panel».',
    retry: null,
    quote: '«Esta puerta no es la tuya, pero hay muchas más.»',
  },
  update: {
    code: null,
    icon: 'system_update_alt',
    title: 'Hay una versión nueva',
    text: 'El panel se ha actualizado mientras lo tenías abierto y esta pantalla ya no se puede cargar. Recarga para seguir con la versión nueva; lo que ya estaba guardado no se pierde.',
    retry: 'Recargar',
    quote: '«Me he puesto al día. Recarga y seguimos.»',
  },
};

/**
 * Full-page error screen, outside the shell: it has to work with no session
 * and when the shell itself is what failed to load. For the same reason it is
 * the one screen that is NOT lazy (see app.routes.ts).
 */
@Component({
  selector: 'app-error-page',
  templateUrl: './error-page.html',
  styleUrl: './error-page.scss',
})
export class ErrorPage {
  private readonly router = inject(Router);

  /** Query params (withComponentInputBinding). */
  readonly kind = input<string | undefined>();
  readonly from = input<string | undefined>();

  protected readonly resolved = computed(() => toErrorKind(this.kind()));
  protected readonly copy = computed(() => COPY[this.resolved()]);

  protected retry() {
    this.go(safeReturnUrl(this.from()));
  }

  protected home() {
    this.go('/');
  }

  protected permissions() {
    this.router.navigateByUrl('/account');
  }

  /**
   * After a deploy the JS in memory is the old one, so only a real page load
   * gets out of it. For the rest, navigating is enough and keeps the session
   * in memory.
   */
  private go(url: string) {
    if (this.resolved() === 'update') {
      markReload();
      window.location.assign(url);
    } else {
      this.router.navigateByUrl(url);
    }
  }
}
