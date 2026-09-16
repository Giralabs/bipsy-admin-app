import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

/**
 * Downloads a JWT-protected CSV. A plain <a href> does not send the
 * Authorization header, so it has to be requested as a blob (the interceptor
 * already adds the Bearer token) and the download triggered manually.
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
  // Revoking in the same tick cancels the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Copies to the clipboard and returns whether it succeeded. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
