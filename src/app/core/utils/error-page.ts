/**
 * What the /error page can show. It travels in the `kind` query param, so a
 * screen sends the user there with `router.navigateByUrl(errorPageUrl('forbidden'))`.
 */
export type ErrorKind = 'unexpected' | 'offline' | 'forbidden' | 'update';

const KINDS: ErrorKind[] = ['unexpected', 'offline', 'forbidden', 'update'];
const ERROR_PATH = '/error';
const RELOAD_KEY = 'bipsy_admin_reloaded_at';
const RELOAD_WINDOW_MS = 15_000;

export function toErrorKind(raw: string | null | undefined): ErrorKind {
  return KINDS.includes(raw as ErrorKind) ? (raw as ErrorKind) : 'unexpected';
}

export function isErrorUrl(url: string | null | undefined): boolean {
  return !!url && (url === ERROR_PATH || url.startsWith(`${ERROR_PATH}?`) || url.startsWith(`${ERROR_PATH}/`));
}

/**
 * Where «Reintentar» / «Recargar» goes back to. Only internal paths, and never
 * the error page itself: that would be the loop this is meant to avoid.
 */
export function safeReturnUrl(from: string | null | undefined): string {
  if (!from || !from.startsWith('/') || from.startsWith('//') || isErrorUrl(from)) return '/';
  return from;
}

export function errorPageUrl(kind: ErrorKind, from?: string | null): string {
  const back = safeReturnUrl(from);
  return back === '/' ? `${ERROR_PATH}?kind=${kind}` : `${ERROR_PATH}?kind=${kind}&from=${encodeURIComponent(back)}`;
}

/**
 * A lazy route's JS file could not be downloaded. After a deploy the old file
 * names no longer exist, so a tab left open fails on the first screen it has
 * not loaded yet. Each browser words it differently (the last ones are webpack's).
 */
export function isChunkLoadError(err: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = err;
  // Angular and promises wrap the original error: `rejection`, `cause`, `error`.
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const e = current as { name?: unknown; message?: unknown; rejection?: unknown; cause?: unknown; error?: unknown };
    const text = `${typeof e.name === 'string' ? e.name : ''} ${typeof e.message === 'string' ? e.message : ''}`;
    if (
      // The MIME one is Safari when the host answers a missing .js with index.html (vercel.json rewrites).
      /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|is not a valid JavaScript MIME type|ChunkLoadError|Loading chunk [\w-]+ failed/i.test(
        text,
      )
    ) {
      return true;
    }
    current = e.rejection ?? e.cause ?? e.error;
  }
  return typeof current === 'string' && /dynamically imported module|ChunkLoadError/i.test(current);
}

/**
 * Which page a failed chunk deserves. Usually «new version», but with no
 * network it is just that, and if the user has ALREADY reloaded a moment ago
 * and it fails again, telling them to reload once more would only go in circles.
 */
export function chunkFailureKind(): ErrorKind {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  return reloadedRecently() ? 'unexpected' : 'update';
}

/** Leaves a note before a full reload, so the next failure knows it already happened. */
export function markReload() {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the page still reloads, it just cannot tell afterwards.
  }
}

function reloadedRecently(): boolean {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < RELOAD_WINDOW_MS;
  } catch {
    return false;
  }
}
