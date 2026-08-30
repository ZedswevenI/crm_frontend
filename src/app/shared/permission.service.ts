// ============================================================
//  permission.service.ts  –  Single source of truth for
//  "can this user do X" checks (module:action permission keys)
//  and portal access.
//
//  Permissions are held ONLY in memory (BehaviorSubject) — never
//  localStorage. A page reload wipes them; init() (called from
//  ApplayoutComponent on every authenticated page load) detects
//  the empty array and re-fetches from the server. Login seeds
//  the array directly via setPermissions() since the login
//  response already carries it — no need for a redundant round
//  trip right after signing in.
// ============================================================

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, finalize, map, shareReplay } from 'rxjs/operators';
import { CommonapiService } from '../service/commonapi/commonapi.service';
import { AuthService } from '../service/auth/auth.service';

export type Portal = 'CRM' | 'ACADEMIC';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private permissionsSubject = new BehaviorSubject<string[]>([]);
  permissions$ = this.permissionsSubject.asObservable();

  private loaded = false;
  private inFlight$: Observable<string[]> | null = null;

  constructor(
    private commonApi: CommonapiService,
    private authService: AuthService,
  ) {}

  // ── Bootstrap ────────────────────────────────────────────────

  /**
   * Ensures the in-memory permission array is populated for the current
   * session, and returns an Observable that only emits once that's true —
   * callers that need to make a decision (PermissionGuard) wait on this
   * instead of racing it.
   */
  ensureLoaded(force = false): Observable<string[]> {
    if (this.authService.getIsAdmin()) {
      this.loaded = true;
      return of(this.permissionsSubject.value);
    }
    if (!force && (this.loaded || this.permissionsSubject.value.length > 0)) {
      return of(this.permissionsSubject.value);
    }
    if (this.inFlight$) return this.inFlight$;
    if (!this.authService.hasValidSession()) return of([]);

    const entiId = this.authService.getTenantId();
    // Must be `targetUserId`, not `userId` — the backend's permission
    // endpoint expects this field name (self-service lookup).
    const targetUserId = this.authService.getUserId();

    this.inFlight$ = this.commonApi.fetchData({ entiId, targetUserId }, 'ims/user', 'permissions').pipe(
      map((res: any) => {
        this.loaded = true;
        const data = res?.data ?? {};
        const perms = Array.isArray(data.permissions) ? data.permissions : [];
        this.permissionsSubject.next(perms);
        // The endpoint returns the live portal/isAdmin snapshot alongside
        // permissions — keep AuthService's cached copy in sync too, so a
        // refresh here also picks up a portal or admin-flag change without
        // requiring a full re-login.
        this.authService.setPortalAndAdmin(
          Array.isArray(data.portal) ? data.portal : [],
          !!data.isAdmin,
        );
        return perms;
      }),
      catchError(() => {
        // Leave loaded=false so the NEXT ensureLoaded() call (e.g. next
        // navigation) retries, rather than silently locking the user out
        // for the rest of the session on a transient network failure.
        return of(this.permissionsSubject.value);
      }),
      finalize(() => {
        this.inFlight$ = null;
      }),
      shareReplay(1),
    );
    return this.inFlight$;
  }

  /** Fire-and-forget variant for call sites that don't need to wait
   *  (e.g. ApplayoutComponent). */
  init(force = false): void {
    this.ensureLoaded(force).subscribe();
  }

  /** Force a fresh fetch — e.g. after a "your access was updated" signal. */
  refresh(): void {
    this.init(true);
  }

  /** Seed directly from the login response — skips the init() round trip. */
  setPermissions(permissions: string[]): void {
    this.loaded = true;
    this.permissionsSubject.next(Array.isArray(permissions) ? permissions : []);
  }

  reset(): void {
    this.loaded = false;
    this.inFlight$ = null;
    this.permissionsSubject.next([]);
  }

  // ── Checks ───────────────────────────────────────────────────

  isAdmin(): boolean {
    return this.authService.getIsAdmin();
  }

  hasPermission(key: string): boolean {
    return this.isAdmin() || this.permissionsSubject.value.includes(key);
  }

  hasAny(keys: string[]): boolean {
    return this.isAdmin() || keys.some((k) => this.permissionsSubject.value.includes(k));
  }

  hasAll(keys: string[]): boolean {
    return this.isAdmin() || keys.every((k) => this.permissionsSubject.value.includes(k));
  }

  hasPortal(portal: Portal): boolean {
    return this.isAdmin() || this.authService.getPortals().includes(portal);
  }
}
