const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const integer = new Intl.NumberFormat('es-ES');
const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

export function formatEur(value: number | null | undefined): string {
  return eur.format(value ?? 0);
}

export function formatCents(cents: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function formatInt(value: number | null | undefined): string {
  return integer.format(value ?? 0);
}

/** "hace 3 h", "ayer", "hace 2 semanas". */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return 'ahora mismo';
  if (abs < 3600) return relative.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return relative.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 7) return relative.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 30) return relative.format(Math.round(diff / (86400 * 7)), 'week');
  if (abs < 86400 * 365) return relative.format(Math.round(diff / (86400 * 30)), 'month');
  return relative.format(Math.round(diff / (86400 * 365)), 'year');
}

/** Dos letras: la del nombre y la del primer apellido. */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? (parts[1][0] ?? '') : '')).toUpperCase();
}

export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}
