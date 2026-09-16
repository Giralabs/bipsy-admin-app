import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

/**
 * Descarga un CSV protegido por JWT. Un <a href> normal no manda el header
 * Authorization, así que hay que pedirlo como blob (el interceptor ya le
 * añade el Bearer token) y disparar la descarga a mano.
 */
export function downloadCsv(http: HttpClient, url: string, filename: string): Observable<void> {
  return http.get(url, { responseType: 'blob' }).pipe(map((blob) => saveBlob(blob, filename)));
}

export function saveBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  // Revocar en el mismo tick cancela la descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Copia al portapapeles; devuelve si ha funcionado. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
