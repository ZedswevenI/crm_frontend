// src/app/guards/auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, Router, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate, CanActivateChild {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    return this.auth.hasValidSession() ? true : this.router.parseUrl('/auth/login');
  }

  canActivateChild(): boolean | UrlTree {
    return this.canActivate();
  }
}
