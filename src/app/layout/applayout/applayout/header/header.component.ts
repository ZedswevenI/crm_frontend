import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { timer } from 'rxjs';
import { filter, switchMap } from 'rxjs/operators';
import { NotificationService } from '../../../../service/notification/notification.service';
import { AppNotification } from '../../../../service/notification/notification.model';

const UNREAD_POLL_MS = 60000;

interface NavLink {
  label: string;
  path: string;
  hideForAccount?: boolean;
}

interface NavModule {
  key: string;
  label: string;
  matchPrefixes: string[];
  links: NavLink[];
  hideForAccount?: boolean;
}

const NAV_MODULES: NavModule[] = [
  {
    key: 'admissions',
    label: 'Admissions & Fees',
    matchPrefixes: ['/app/admissions', '/app/fees'],
    hideForAccount: true,
    links: [
      { label: 'New Admission', path: '/app/admissions/new' },
      { label: 'Search Enrollment', path: '/app/admissions' },
      { label: 'Waiting for Approval', path: '/app/admissions/waitforapproval' },
      { label: 'Reports', path: '/app/admissions/reports' },
      // { label: 'Communication', path: '/app/admissions/communication' },
      { label: 'Fee Calculator', path: '/app/admissions/fee-calculator' },
      { label: 'Student Bulk Upload', path: '/app/admissions/student/upload' },
      { label: 'Print Acknowledgement', path: '/app/admissions/print/acknowledgement' },
      { label: 'Fee Plans', path: '/app/fees/plans' },
    ],
  },
  {
    key: 'accounts',
    label: 'Accounts',
    matchPrefixes: ['/app/accounts'],
    links: [
      { label: 'All Payments', path: '/app/accounts/payments' },
      { label: 'NEFT Register', path: '/app/accounts/neft' },
      { label: 'Cheque Register', path: '/app/accounts/cheques' },
      { label: 'Cheque Deposit', path: '/app/accounts/deposit' },
      { label: 'Cheque Extensions', path: '/app/accounts/extention' },
      { label: 'Cheque Replacements', path: '/app/accounts/replacements' },
    ],
  },
  {
    key: 'students',
    label: 'Students & Batches',
    matchPrefixes: ['/app/students', '/app/batches'],
    hideForAccount: true,
    links: [
      { label: 'Students', path: '/app/students' },
      { label: 'Batches', path: '/app/batches' },
    ],
  },
  {
    key: 'timetable',
    label: 'Timetable & Attendance',
    matchPrefixes: ['/app/timetable', '/app/attendance'],
    hideForAccount: true,
    links: [
      { label: 'Timetable', path: '/app/timetable' },
      { label: 'Attendance', path: '/app/attendance' },
    ],
  },
  {
    key: 'org',
    label: "Org Config's",
    matchPrefixes: ['/app/admin'],
    links: [
      { label: 'Institute', path: '/app/admin/masters/institute', hideForAccount: true },
      { label: 'Centers', path: '/app/admin/masters/centers', hideForAccount: true },
      { label: 'Programs', path: '/app/admin/masters/programs', hideForAccount: true },
      { label: 'Staff', path: '/app/admin/masters/staff', hideForAccount: true },
      { label: 'Departments', path: '/app/admin/masters/departments', hideForAccount: true },
      { label: 'Subject', path: '/app/admin/masters/subject', hideForAccount: true },
      { label: 'Bank Accounts', path: '/app/admin/masters/bankaccounts' },
      { label: 'Users & Roles', path: '/app/admin/users', hideForAccount: true },
      { label: 'Topics', path: '/app/admin/masters/topics', hideForAccount: true },
      { label: 'Subtopics', path: '/app/admin/masters/subtopics', hideForAccount: true },
      { label: 'Exam Category', path: '/app/admin/masters/exam/category', hideForAccount: true },
      { label: 'Exam Subcategory', path: '/app/admin/masters/exam/subcategory', hideForAccount: true },
    ],
  },
];

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

  activeModuleKey: string | null = null;
  globalSearchText = '';

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

  get visibleModules(): NavModule[] {
    return NAV_MODULES.filter((m) => !(this.isAccountRole && m.hideForAccount));
  }

  get activeModule(): NavModule | null {
    return this.visibleModules.find((m) => m.key === this.activeModuleKey) || null;
  }

  visibleLinks(mod: NavModule): NavLink[] {
    return mod.links.filter((l) => !(this.isAccountRole && l.hideForAccount));
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

    this.updateActiveModule(this.router.url);
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => this.updateActiveModule(e.urlAfterRedirects));
  }

  private updateActiveModule(url: string): void {
    const found = NAV_MODULES.find((m) =>
      m.matchPrefixes.some((prefix) => url.startsWith(prefix)),
    );
    this.activeModuleKey = found ? found.key : null;
  }

  onModuleClick(mod: NavModule): void {
    const firstLink = this.visibleLinks(mod)[0];
    if (firstLink) {
      this.router.navigateByUrl(firstLink.path);
    }
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
