import { HttpErrorResponse } from '@angular/common/http';

/**
 * Mensaje legible de un error del backend. El backend responde con ApiError
 * { status, error, message, errors[] }: se prefiere su `message` (ya viene en
 * español) y, si es un error de validación, el primer campo que falla.
 */
export function apiErrorMessage(err: unknown, fallback = 'Algo ha fallado. Inténtalo de nuevo.'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'No hay conexión con el servidor. ¿Está el backend arrancado?';
    const body = err.error as { message?: string; errors?: { field: string; message: string }[] } | null;
    const fieldError = body?.errors?.[0];
    if (fieldError) return `${fieldError.field}: ${fieldError.message}`;
    if (err.status === 403) return body?.message || 'Tu rol de admin no tiene permiso para esta acción.';
    if (err.status === 404) return body?.message || 'No se ha encontrado. Puede que el backend no tenga este endpoint todavía.';
    if (body?.message) return body.message;
    return `${fallback} (error ${err.status})`;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function isNotFound(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 404;
}
