import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CommonapiService } from '../commonapi/commonapi.service';
import { AppNotification, NotificationListResponse } from './notification.model';

const MODULE = 'ims/notification';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private commonApi: CommonapiService) {}

  private identity(): { tenantId: string; userId: string } {
    const tenantId =
      localStorage.getItem('tenantId') || localStorage.getItem('tenantid') || '';
    const userId = localStorage.getItem('userid') || '';
    return { tenantId, userId };
  }

  list(opts: {
    page?: number;
    limit?: number;
    isRead?: boolean;
    type?: string;
  } = {}): Observable<NotificationListResponse> {
    const payload = { ...this.identity(), ...opts };
    return this.commonApi.fetchData(payload, MODULE, 'list').pipe(
      tap((res: NotificationListResponse) => {
        if (res?.status && typeof res.unreadCount === 'number') {
          this.unreadCountSubject.next(res.unreadCount);
        }
      }),
    );
  }

  refreshUnreadCount(): Observable<{ status: boolean; unreadCount: number }> {
    return this.commonApi
      .fetchData(this.identity(), MODULE, 'unread-count')
      .pipe(
        tap((res: { status: boolean; unreadCount: number }) => {
          if (res?.status && typeof res.unreadCount === 'number') {
            this.unreadCountSubject.next(res.unreadCount);
          }
        }),
      );
  }

  markRead(notificationId: string): Observable<any> {
    return this.commonApi.fetchData(
      { ...this.identity(), notificationId },
      MODULE,
      'mark-read',
    );
  }

  markAllRead(): Observable<any> {
    return this.commonApi
      .fetchData(this.identity(), MODULE, 'mark-all-read')
      .pipe(tap(() => this.unreadCountSubject.next(0)));
  }

  remove(notificationId: string): Observable<any> {
    return this.commonApi.fetchData(
      { ...this.identity(), notificationId },
      MODULE,
      'remove',
    );
  }

  setUnreadCount(count: number): void {
    this.unreadCountSubject.next(count);
  }
}
