import { inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * List filters mirrored in the URL. This way, after opening a detail page and
 * going back, the list stays on the same page with the same search, and a
 * filtered list can be shared by link with another team member.
 */
export function listQuery() {
  const router = inject(Router);
  const route = inject(ActivatedRoute);
  // The first load comes from the URL, so there is nothing to write. Also,
  // navigating from the constructor, while the navigation that creates the
  // component is still in progress, would cancel it.
  let first = true;

  return {
    get(key: string): string {
      return route.snapshot.queryParamMap.get(key) ?? '';
    },
    page(): number {
      const n = Number(route.snapshot.queryParamMap.get('page'));
      return Number.isFinite(n) && n > 1 ? n - 1 : 0;
    },
    /** `page` is 0-based; in the URL it is 1-based and the first page is omitted. */
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
