import { inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * Filtros de un listado reflejados en la URL. Así, al entrar en una ficha y
 * volver atrás, la lista sigue en la misma página y con la misma búsqueda, y
 * un listado filtrado se puede pasar por enlace a otra persona del equipo.
 */
export function listQuery() {
  const router = inject(Router);
  const route = inject(ActivatedRoute);
  // La primera carga sale de la URL, así que no hay nada que escribir. Y
  // navegar desde el constructor, con la navegación que crea el componente
  // aún en curso, la cancelaría.
  let first = true;

  return {
    get(key: string): string {
      return route.snapshot.queryParamMap.get(key) ?? '';
    },
    page(): number {
      const n = Number(route.snapshot.queryParamMap.get('page'));
      return Number.isFinite(n) && n > 1 ? n - 1 : 0;
    },
    /** `page` en base 0; en la URL va en base 1 y se omite la primera. */
    set(values: Record<string, string | number | null | undefined>) {
      if (first) {
        first = false;
        return;
      }
      const queryParams: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(values)) {
        if (k === 'page') queryParams[k] = typeof v === 'number' && v > 0 ? String(v + 1) : null;
        else queryParams[k] = v === '' || v == null ? null : String(v);
      }
      router.navigate([], { relativeTo: route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
    },
  };
}
