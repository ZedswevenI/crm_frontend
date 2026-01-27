import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class GuestGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    localStorage.setItem('selectedMasterMenu', 'dashboard');
    return this.auth.hasValidSession() ? this.router.parseUrl('/app/dashboard') : true;
  }
}
