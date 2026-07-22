import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { NotificationService } from '../../../../service/notification/notification.service';
import { AppNotification } from '../../../../service/notification/notification.model';

const UNREAD_POLL_MS = 60000;

@Component({
  selector: 'app-header',
  standalone: false,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  username: any = '';
  email: any = '';

  unreadCount = 0;
  notifPanelOpen = false;
  notifLoading = false;
  notifications: AppNotification[] = [];

  constructor(
    private router: Router,
    private notificationService: NotificationService,
  ) {
    this.username = localStorage.getItem('name');
    this.email = localStorage.getItem('email');
  }

  get isAccountRole(): boolean {
    return (localStorage.getItem('userRole') || '').trim().toUpperCase() === 'L6';
  }

  ngOnInit(): void {
    this.notificationService.unreadCount$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((count) => (this.unreadCount = count));

    timer(0, UNREAD_POLL_MS)
      .pipe(
        switchMap(() => this.notificationService.refreshUnreadCount()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ error: () => {} });
  }

  toggleNotifPanel(): void {
    this.notifPanelOpen = !this.notifPanelOpen;
    if (this.notifPanelOpen) {
      this.loadNotifications();
    }
  }

  closeNotifPanel(): void {
    this.notifPanelOpen = false;
  }

  private loadNotifications(): void {
    this.notifLoading = true;
    this.notificationService
      .list({ page: 1, limit: 20 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.notifications = res?.data || [];
          this.notifLoading = false;
        },
        error: () => {
          this.notifLoading = false;
        },
      });
  }

  onNotificationClick(notif: AppNotification): void {
    if (!notif.isRead) {
      this.markAsRead(notif);
    }
    this.navigateForNotification(notif);
  }

  toggleRead(notif: AppNotification, event: Event): void {
    event.stopPropagation();
    if (notif.isRead) return;
    this.markAsRead(notif);
  }

  private markAsRead(notif: AppNotification): void {
    notif.isRead = true;
    this.notificationService
      .markRead(notif.notificationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.unreadCount > 0) {
            this.notificationService.setUnreadCount(this.unreadCount - 1);
          }
        },
        error: () => {
          notif.isRead = false;
        },
      });
  }

  markAllRead(): void {
    this.notificationService
      .markAllRead()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.forEach((n) => (n.isRead = true));
        },
      });
  }

  dismissNotification(notif: AppNotification, event: Event): void {
    event.stopPropagation();
    this.notificationService
      .remove(notif.notificationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications = this.notifications.filter(
            (n) => n.notificationId !== notif.notificationId,
          );
          if (!notif.isRead && this.unreadCount > 0) {
            this.notificationService.setUnreadCount(this.unreadCount - 1);
          }
        },
      });
  }

  private navigateForNotification(notif: AppNotification): void {
    const admissionId = notif.data?.['admissionId'];
    if (!admissionId) return;

    if (notif.type === 'ADMISSION_APPROVAL_PENDING') {
      this.router.navigate(['/app/admissions/approve', admissionId]);
      this.closeNotifPanel();
    } else if (notif.type === 'ADMISSION_APPROVED') {
      this.router.navigate(['/app/admissions/view', admissionId]);
      this.closeNotifPanel();
    }
  }

  logout() {
    localStorage.clear();
    sessionStorage.clear();
    this.router.navigate(['/auth/login']);
  }
}
