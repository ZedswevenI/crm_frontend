import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { map, Observable, tap, throwError, BehaviorSubject } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';
import { catchError, filter, switchMap, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthinterceptorService {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(private router: Router, private authService: AuthService) {}

  intercept(originalReq: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    let headers = originalReq.headers.set('Cache-Control', 'no-cache');
    const isAuthEndpoint = originalReq.url.includes('/admin/login') || originalReq.url.includes('/admin/refresh');
    const accessToken = localStorage.getItem('token');

    let req = originalReq;
    if (!isAuthEndpoint && accessToken) {
      headers = headers.set('x-access-token', accessToken);
      req = originalReq.clone({ headers });
    } else {
      req = originalReq.clone({ headers });
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !isAuthEndpoint) {
          return this.handle401Error(req, next);
        }
        return throwError(() => error);
      })
    );
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshToken().pipe(
        switchMap((res: any) => {
          this.isRefreshing = false;
          const newToken = localStorage.getItem('token');
          this.refreshTokenSubject.next(newToken);
          return next.handle(this.addTokenHeader(request, newToken));
        }),
        catchError(err => {
          this.isRefreshing = false;
          this.authService.logout();
          this.router.navigateByUrl('/admin/login');
          return throwError(() => err);
        })
      );
    } else {
      // If refresh in progress, queue this request
      return this.refreshTokenSubject.pipe(filter(token => token != null), take(1), switchMap(token => next.handle(this.addTokenHeader(request, token!))));
    }
  }

  private addTokenHeader(request: HttpRequest<any>, token: string | null): HttpRequest<any> {
    if (!token) return request;
    return request.clone({
      setHeaders: { 'x-access-token': token }
    });
  }
}
