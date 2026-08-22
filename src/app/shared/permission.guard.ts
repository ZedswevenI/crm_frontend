// ============================================================
//  permission.guard.ts  –  Protects routes based on permission
//  keys (and optionally portal).
//
//    { path: 'batch', canActivate: [PermissionGuard],
//      data: { permission: 'batch:list' } }
//
//  `permission` may be a single key or an array — checked as
//  "any of" by default, or "all of" when `requireAll: true` is
//  also set in route data.
// ============================================================

import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../service/auth/auth.service';
import { PermissionService, Portal } from './permission.service';
import { AlertService } from '../service/alert/alert.service';

@Injectable({ providedIn: 'root' })
export class PermissionGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private permission: PermissionService,
    private alert: AlertService,
    private router: Router,
  ) {}

  canActivate(route: ActivatedRouteSnapshot, _state: RouterStateSnapshot): Observable<boolean> | boolean {
    if (!this.auth.hasValidSession()) {
      this.router.navigate(['/auth/login']);
      return false;
    }

    // canActivate runs before ANY component in the route tree is created.
    // Waiting on ensureLoaded() here (instead of reading the in-memory
    // array synchronously) is what makes a fresh page reload work instead
    // of racing an empty permissions[] to a false "not authorised" redirect.
    return this.permission.ensureLoaded().pipe(
      map(() => {
        const required = route.data?.['permission'] as string | string[] | undefined;
        const requiredPortal = route.data?.['portal'] as Portal | undefined;

        if (requiredPortal && !this.permission.hasPortal(requiredPortal)) {
          this.alert.error('You are not authorised to access this portal.');
          this.router.navigate(['/auth/login']);
          return false;
        }

        if (required) {
          const keys = Array.isArray(required) ? required : [required];
          const requireAll = route.data?.['requireAll'] === true;

          const hasAccess = requireAll
            ? this.permission.hasAll(keys)
            : this.permission.hasAny(keys);

          if (!hasAccess) {
            this.alert.error("You don't have permission to access this page.");
            this.router.navigate(['/auth/login']);
            return false;
          }
        }

        return true;
      }),
    );
  }
}
