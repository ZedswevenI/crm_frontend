import { Injector, NgZone, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environments';
import { BehaviorSubject, Observable, Subject, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AlertService } from '../alert/alert.service';
import { RoleLevel } from '../../shared/role.config';
import { PermissionService } from '../../shared/permission.service';

const TOKEN_KEY = 'token';
const TENANT_KEY = 'tenantId';
const USER_ID_KEY = 'userid';
const ROLE_KEY = 'userRole';
const EMAIL_KEY = 'email';
const NAME_KEY = 'name';
const PORTAL_KEY = 'portal';
const IS_ADMIN_KEY = 'isAdmin';
const STAFF_ID_KEY = 'staffId';

/** This app is the CRM portal — a login whose `portal[]` doesn't include
 *  it is rejected, regardless of what other portals (e.g. ACADEMIC) that
 *  user can otherwise reach. */
const REQUIRED_PORTAL = 'CRM';

/** Teachers (L4) belong to the Academic portal, not CRM. Blocked explicitly
 *  even if `portal[]` happens to include CRM by mistake on the backend. */
const BLOCKED_ROLES: RoleLevel[] = ['L4'];

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  headers = new HttpHeaders().set('Content-Type', 'application/json');
  uploading = false;
  lastError: string | null = null;

  private formResetSubject = new Subject<void>();
  formReset$ = this.formResetSubject.asObservable();

  private loggedIn$ = new BehaviorSubject<boolean>(this.hasToken());
  isLoggedIn$ = this.loggedIn$.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private ngZone: NgZone,
    private alert: AlertService,
    private injector: Injector,
  ) { }

  /** Lazy — PermissionService injects AuthService, so a normal constructor
   *  param here would be a DI cycle. Resolved on first use instead, by which
   *  point both singletons already exist. */
  private get permissionService(): PermissionService {
    return this.injector.get(PermissionService);
  }

  // ── Auth ──────────────────────────────────────────────────

  signIn(payload: any, module: any, endpoint: any): Observable<any> {
    this.uploading = true;
    this.lastError = null;

    return this.http
      .post(`${environment.baseURL}/${module}/${endpoint}`, payload, { withCredentials: true })
      .pipe(
        tap((response: any) => {
          if (!response?.data) throw new Error('Unexpected response.');
          const d = response.data;
          const roleLevel = String(d.roleLevel || '').trim() as RoleLevel;

          // Portal gate — an isAdmin login gets every portal automatically
          // (server-side), so only non-admin logins are checked here. A login
          // that can't reach this portal never touches localStorage: no
          // partial session is left behind for a stale guard to trip over.
          const portals: string[] = Array.isArray(d.portal) ? d.portal : [];
          if (!d.isAdmin && !portals.includes(REQUIRED_PORTAL)) {
            this.uploading = false;
            throw { error: { message: 'You are not authorised to access this portal.' } };
          }

          // Explicit role block — independent of the portal check above.
          if (!d.isAdmin && BLOCKED_ROLES.includes(roleLevel)) {
            this.uploading = false;
            throw { error: { message: 'You are not authorised to access this application.' } };
          }

          localStorage.setItem(TOKEN_KEY, d.token);
          localStorage.setItem(TENANT_KEY, d.tenantId);
          localStorage.setItem(USER_ID_KEY, d.userId);
          localStorage.setItem(ROLE_KEY, roleLevel);
          localStorage.setItem(EMAIL_KEY, d.email);
          localStorage.setItem(NAME_KEY, d.name);
          localStorage.setItem(STAFF_ID_KEY, d.staffId ?? '');
          localStorage.setItem(PORTAL_KEY, JSON.stringify(portals));
          localStorage.setItem(IS_ADMIN_KEY, JSON.stringify(!!d.isAdmin));

          // Permissions are NOT persisted to localStorage — they live only in
          // PermissionService's in-memory store, seeded here from the login
          // response. A page reload wipes that memory; PermissionGuard's
          // ensureLoaded() detects the empty array and re-fetches from the
          // server on the next navigation.
          this.permissionService.setPermissions(Array.isArray(d.permissions) ? d.permissions : []);

          this.uploading = false;
          this.loggedIn$.next(true);
          this.alert.success('Login Successful!!');
          this.ngZone.run(() => this.router.navigateByUrl('/app/dashboard'));
        }),
        catchError((err) => {
          const msg = err?.error?.message || err?.error?.error || 'Login Failed. Please enter correct Email/Password';
          this.lastError = msg;
          this.uploading = false;
          this.triggerFormReset();
          return throwError(() => err);
        }),
      );
  }

  triggerFormReset() {
    this.formResetSubject.next();
  }

  refreshToken(): Observable<any> {
    return this.http.post(`${environment.baseURL}/ims/user/auth/refresh`, {}, { withCredentials: true }).pipe(
      tap((res: any) => {
        if (res?.token) localStorage.setItem(TOKEN_KEY, res.token);
      })
    );
  }

  logout() {
    this.http.post(`${environment.baseURL}/ims/user/logout`, {}, { withCredentials: true }).subscribe({
      next: () => this.clearSession(true),
      error: () => this.clearSession(false),
    });
  }

  private clearSession(showAlert: boolean) {
    [TOKEN_KEY, TENANT_KEY, USER_ID_KEY, ROLE_KEY, EMAIL_KEY, NAME_KEY, PORTAL_KEY, IS_ADMIN_KEY, STAFF_ID_KEY]
      .forEach((k) => localStorage.removeItem(k));
    this.permissionService.reset();
    this.loggedIn$.next(false);
    if (showAlert) this.alert.success('You are Loggedout Successfully!!');
    this.router.navigate(['/auth/login']);
  }

  hasToken(): boolean {
    const t = localStorage.getItem(TOKEN_KEY);
    return !!t;
  }

  hasValidSession(): boolean {
    return this.hasToken();
  }

  setLoggedIn() {
    this.loggedIn$.next(true);
  }

  changePassword(payload: { currentPassword: string; newPassword: string }) {
    return this.http.post(`${environment.baseURL}/ims/user/change`, payload, { withCredentials: true });
  }

  // ── Role helpers ──────────────────────────────────────────

  getRole(): RoleLevel {
    return (localStorage.getItem(ROLE_KEY) ?? '') as RoleLevel;
  }

  isRole(role: RoleLevel): boolean {
    return this.getRole() === role;
  }

  hasAnyRole(roles: RoleLevel[]): boolean {
    return roles.includes(this.getRole());
  }

  getrole(): RoleLevel {
    return this.getRole();
  }

  // ── Portal / admin helpers ─────────────────────────────────

  getPortals(): string[] {
    try {
      return JSON.parse(localStorage.getItem(PORTAL_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  getIsAdmin(): boolean {
    return localStorage.getItem(IS_ADMIN_KEY) === 'true';
  }

  /** Refreshes the cached portal/isAdmin snapshot — e.g. after PermissionService
   *  re-fetches from POST ims/user/permissions, which returns the current
   *  values alongside permissions[]. Keeps this session's copy in sync with
   *  the server without requiring a full re-login. */
  setPortalAndAdmin(portals: string[], isAdmin: boolean): void {
    localStorage.setItem(PORTAL_KEY, JSON.stringify(Array.isArray(portals) ? portals : []));
    localStorage.setItem(IS_ADMIN_KEY, JSON.stringify(!!isAdmin));
  }

  getUserId(): string {
    return localStorage.getItem(USER_ID_KEY) ?? '';
  }

  getTenantId(): string {
    return localStorage.getItem(TENANT_KEY) ?? '';
  }

  getStaffId(): string {
    return localStorage.getItem(STAFF_ID_KEY) ?? '';
  }
}
