// ============================================================
//  permission-catalog.service.ts  –  Fetches the live permission
//  catalog from POST ims/permission/catalog, used to render the
//  checkbox-tree picker in Admin → Users.
//
//  Read-only reference data, not user-specific, so it's cached
//  for the session (one call, reused across every user edited in
//  the Users screen).
// ============================================================

import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { CommonapiService } from '../service/commonapi/commonapi.service';

export interface PermissionEntry {
  permissionKey: string;
  action: string;
  label: string;
}

export interface PermissionModuleGroup {
  module: string;
  permissions: PermissionEntry[];
}

/** "orgProgram" -> "Program", "orgSubTopic" -> "Sub Topic", "orgExamCategory" -> "Exam Category" */
function friendlySubmoduleName(moduleKey: string): string {
  const stripped = moduleKey.replace(/^[a-z]+/, '') || moduleKey;
  const spaced = stripped
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Group display names are derived from each group's first permission label
 * (text before " - "), e.g. "Org Masters - Program - List" -> "Org Masters".
 * Several raw `module` keys (orgProgram, orgStaff, orgCenter, ...) share that
 * same human-readable prefix, so naively using it collapses every Org
 * Masters submodule to one identical "Org Masters" label. When that
 * collision happens, disambiguate by appending the submodule name derived
 * from the raw `module` key — e.g. "Org Masters - Program".
 */
export function computeModuleLabels(groups: PermissionModuleGroup[]): Map<string, string> {
  const base = new Map<string, string>();
  groups.forEach((g) => {
    base.set(g.module, g.permissions[0]?.label?.split(' - ')[0]?.trim() || g.module);
  });

  const counts = new Map<string, number>();
  base.forEach((label) => counts.set(label, (counts.get(label) || 0) + 1));

  const resolved = new Map<string, string>();
  base.forEach((label, module) => {
    resolved.set(module, (counts.get(label) || 0) > 1 ? `${label} - ${friendlySubmoduleName(module)}` : label);
  });
  return resolved;
}

@Injectable({ providedIn: 'root' })
export class PermissionCatalogService {
  private cache$: Observable<PermissionModuleGroup[]> | null = null;

  constructor(private commonApi: CommonapiService) {}

  /** Fetches the full catalog (no `module` filter). Cached after the first
   *  successful call; pass force=true to bypass the cache. */
  getCatalog(force = false): Observable<PermissionModuleGroup[]> {
    if (!force && this.cache$) return this.cache$;

    this.cache$ = this.commonApi.fetchData({}, 'ims/permission', 'catalog').pipe(
      map((res: any) => (Array.isArray(res?.data) ? res.data : [])),
      catchError((err) => {
        // Don't cache a failed fetch — the next getCatalog() call should retry.
        this.cache$ = null;
        return throwError(() => err);
      }),
      shareReplay(1),
    );
    return this.cache$;
  }

  /** Flattened list of every permissionKey in the catalog — for validation. */
  getAllKeys(force = false): Observable<string[]> {
    return this.getCatalog(force).pipe(
      map((groups) => groups.flatMap((g) => g.permissions.map((p) => p.permissionKey))),
      catchError(() => of([])),
    );
  }
}
