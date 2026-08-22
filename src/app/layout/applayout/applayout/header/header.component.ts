import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { timer } from 'rxjs';
import { filter, switchMap } from 'rxjs/operators';
import { NotificationService } from '../../../../service/notification/notification.service';
import { AppNotification } from '../../../../service/notification/notification.model';
import { PermissionService } from '../../../../shared/permission.service';

const UNREAD_POLL_MS = 60000;

interface NavLink {
  label: string;
  path: string;
  queryParams?: Record<string, string>;
  /** Omit to always show (e.g. institute, fee plans — routes not yet permission-gated). */
  permission?: string | string[];
  requireAll?: boolean;
}

interface NavModule {
  key: string;
  label: string;
  matchPrefixes: string[];
  links: NavLink[];
}

const NAV_MODULES: NavModule[] = [
  {
    key: 'admissions',
    label: 'Admissions & Fees',
    matchPrefixes: ['/app/admissions', '/app/fees'],
    links: [
      { label: 'New Admission', path: '/app/admissions/new', permission: 'admission:create' },
      { label: 'Search Enrollment', path: '/app/admissions', permission: ['admission:list', 'admission:view'] },
      { label: 'Waiting for Approval', path: '/app/admissions/waitforapproval', permission: ['admission:list', 'admission:review'] },
      { label: 'Reports', path: '/app/admissions/reports', permission: 'admission:export' },
      // { label: 'Communication', path: '/app/admissions/communication' },
      { label: 'Fee Calculator', path: '/app/admissions/fee-calculator', permission: 'admission:create' },
      { label: 'Student Bulk Upload', path: '/app/admissions/student/upload', permission: 'admission:bulkUpload' },
      { label: 'Print Acknowledgement', path: '/app/admissions/print/acknowledgement', permission: 'admission:create' },
      { label: 'Fee Plans', path: '/app/fees/plans', permission: ['orgFeePlan:list', 'orgFeePlan:view'] },
      {
        label: 'Export Admissions',
        path: '/app/admissions',
        queryParams: { export: '1' },
        permission: 'admission:export',
      },
    ],
  },
  {
    key: 'accounts',
    label: 'Accounts',
    matchPrefixes: ['/app/accounts'],
    links: [
      { label: 'All Payments', path: '/app/accounts/payments', permission: 'accounts:listPayments' },
      { label: 'NEFT Register', path: '/app/accounts/neft', permission: 'accounts:listNeft' },
      { label: 'Cheque Register', path: '/app/accounts/cheques', permission: 'accounts:listCheques' },
      { label: 'Cheque Deposit', path: '/app/accounts/deposit', permission: 'accounts:depositBatch' },
      { label: 'Cheque Extensions', path: '/app/accounts/extention', permission: 'accounts:chequeExtension' },
      { label: 'Cheque Replacements', path: '/app/accounts/replacements', permission: 'accounts:chequeReplacement' },
      { label: 'Add Payment', path: '/app/accounts/student-fee', permission: 'accounts:addPayment' },
    ],
  },
  {
    key: 'students',
    label: 'Students & Batches',
    matchPrefixes: ['/app/students', '/app/batches'],
    links: [
      { label: 'Students', path: '/app/students', permission: ['student:list', 'student:view'] },
      { label: 'Batches', path: '/app/batches', permission: ['batch:list', 'batch:view'] },
      {
        label: 'Export Students',
        path: '/app/students',
        queryParams: { export: '1' },
        permission: 'student:export',
      },
    ],
  },
  {
    key: 'timetable',
    label: 'Timetable & Attendance',
    matchPrefixes: ['/app/timetable', '/app/attendance'],
    links: [
      { label: 'Timetable', path: '/app/timetable', permission: ['timetable:list', 'timetable:view'] },
      { label: 'Attendance', path: '/app/attendance', permission: 'attendance:list' },
    ],
  },
  {
    key: 'org',
    label: "Org Config's",
    matchPrefixes: ['/app/admin'],
    links: [
      { label: 'Institute', path: '/app/admin/masters/institute' },
      { label: 'Centers', path: '/app/admin/masters/centers', permission: ['orgCenter:list', 'orgCenter:view'], requireAll: true },
      { label: 'Programs', path: '/app/admin/masters/programs', permission: ['orgProgram:list', 'orgProgram:view'], requireAll: true },
      { label: 'Staff', path: '/app/admin/masters/staff', permission: ['orgStaff:list', 'orgStaff:view'], requireAll: true },
      { label: 'Departments', path: '/app/admin/masters/departments', permission: ['orgDept:list', 'orgDept:edit'], requireAll: true },
      { label: 'Subject', path: '/app/admin/masters/subject', permission: ['orgSubject:list', 'orgSubject:create'], requireAll: true },
      { label: 'Bank Accounts', path: '/app/admin/masters/bankaccounts', permission: 'orgBankAccount:list' },
      { label: 'Users & Roles', path: '/app/admin/users', permission: ['orgUser:list', 'orgUser:view'], requireAll: true },
      { label: 'Topics', path: '/app/admin/masters/topics', permission: ['orgTopic:list', 'orgTopic:create'], requireAll: true },
      { label: 'Subtopics', path: '/app/admin/masters/subtopics', permission: ['orgSubTopic:list', 'orgSubTopic:create'], requireAll: true },
      { label: 'Exam Category', path: '/app/admin/masters/exam/category', permission: ['orgExamCategory:list', 'orgExamCategory:create'], requireAll: true },
      { label: 'Exam Subcategory', path: '/app/admin/masters/exam/subcategory', permission: 'orgExamCategory:addSubCategories' },
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
    private permissionService: PermissionService,
  ) {
    this.username = localStorage.getItem('name');
    this.email = localStorage.getItem('email');
  }

  private linkAllowed(link: NavLink): boolean {
    if (!link.permission) return true;
    const keys = Array.isArray(link.permission) ? link.permission : [link.permission];
    return link.requireAll ? this.permissionService.hasAll(keys) : this.permissionService.hasAny(keys);
  }

  /** A module survives only if at least one of its links is visible —
   *  same "parent survives only if a child survives" rule as the menu
   *  filter in academy_frontend's sidebar. */
  get visibleModules(): NavModule[] {
    return NAV_MODULES.filter((m) => this.visibleLinks(m).length > 0);
  }

  get activeModule(): NavModule | null {
    return this.visibleModules.find((m) => m.key === this.activeModuleKey) || null;
  }

  visibleLinks(mod: NavModule): NavLink[] {
    return mod.links.filter((l) => this.linkAllowed(l));
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

    // Re-evaluate nav visibility once permissions finish loading (e.g. on a
    // fresh reload where the header renders before the async fetch resolves).
    this.permissionService.permissions$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateActiveModule(this.router.url));

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
