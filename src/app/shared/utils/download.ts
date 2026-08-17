import { HttpClient } from '@angular/common/http';

/**
 * Descarga un CSV protegido por JWT. Un <a href> normal no manda el header
 * Authorization, así que hay que pedirlo como blob (el interceptor ya le
 * añade el Bearer token) y disparar la descarga a mano.
 */
export function downloadCsv(http: HttpClient, url: string, filename: string) {
  http.get(url, { responseType: 'blob' }).subscribe((blob) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  });
}
