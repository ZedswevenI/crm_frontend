import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { PermissionService } from '../../../../shared/permission.service';

interface DashboardLink {
  label: string;
  path: string;
  /** Omit to always show (no catalog permission exists for that screen yet — e.g. Institute). */
  permission?: string | string[];
}

interface DashboardCard {
  title: string;
  icon: string;
  accent: string;
  links: DashboardLink[];
}

@Component({
  selector: 'app-newdashboard',
  standalone: false,
  templateUrl: './newdashboard.component.html',
  styleUrl: './newdashboard.component.scss'
})
export class NewdashboardComponent {
  private allCards: DashboardCard[] = [
    {
      title: 'Admissions',
      icon: 'fa fa-user-graduate',
      accent: 'accent-admissions',
      links: [
        { label: 'New Admission', path: '/app/admissions/new', permission: 'admission:create' },
        { label: 'Search Enrollment', path: '/app/admissions', permission: ['admission:list', 'admission:view'] },
        { label: 'Wait for Approval', path: '/app/admissions/waitforapproval', permission: ['admission:list', 'admission:review'] },
        { label: 'Admission Reports', path: '/app/admissions/reports', permission: 'admission:export' },
        // { label: 'Communication', path: '/app/admissions/communication' },
        { label: 'Fee Calculator', path: '/app/admissions/fee-calculator', permission: 'admission:create' },
        { label: 'Fee Plans', path: '/app/fees/plans', permission: ['orgFeePlan:list', 'orgFeePlan:view'] }
      ]
    },
    {
      title: 'Fee Management',
      icon: 'fa-solid fa-indian-rupee-sign',
      accent: 'accent-fees',
      links: [
        { label: 'Fee Plans', path: '/app/fees/plans', permission: ['orgFeePlan:list', 'orgFeePlan:view'] }
      ]
    },
    {
      title: 'Accounts',
      icon: 'fa-regular fa-file-lines',
      accent: 'accent-accounts',
      links: [
        { label: 'All Payments', path: '/app/accounts/payments', permission: 'accounts:listPayments' },
        { label: 'NEFT Register', path: '/app/accounts/neft', permission: 'accounts:listNeft' },
        { label: 'Cheque Register', path: '/app/accounts/cheques', permission: 'accounts:listCheques' },
        { label: 'Cheque Deposit', path: '/app/accounts/deposit', permission: 'accounts:depositBatch' },
        { label: 'Cheque Extensions', path: '/app/accounts/extention', permission: 'accounts:chequeExtension' },
        { label: 'Cheque Replacements', path: '/app/accounts/replacements', permission: 'accounts:chequeReplacement' }
      ]
    },
    {
      title: 'Academics',
      icon: 'fa-solid fa-people-group',
      accent: 'accent-students',
      links: [
        { label: 'Students', path: '/app/students', permission: ['student:list', 'student:view'] },
        { label: 'Batches', path: '/app/batches', permission: ['batch:list', 'batch:view'] },
        { label: 'Phaseplan', path: '/app/phaseplan' },
        { label: 'Timetable', path: '/app/timetable', permission: ['timetable:list', 'timetable:view'] },
        { label: 'Attendance', path: '/app/attendance', permission: 'attendance:list' },
        { label: 'Topics', path: '/app/admin/masters/institute', permission: ['orgTopic:list', 'orgTopic:create'] },
        { label: 'Subtopics', path: '/app/admin/masters/institute', permission: ['orgSubTopic:list', 'orgSubTopic:create'] },
        { label: 'Subjects', path: '/app/admin/masters/institute', permission: ['orgSubject:list', 'orgSubject:create'] },
        { label: 'Exam Category', path: '/app/admin/masters/institute', permission: ['orgExamCategory:list', 'orgExamCategory:create'] },
        { label: 'Exam Sub Category', path: '/app/admin/masters/institute', permission: 'orgExamCategory:addSubCategories' }
      ]
    },
    {
      title: 'Utilities',
      icon: 'fa-solid fa-gear',
      accent: 'accent-org',
      links: [
        { label: 'Institute', path: '/app/admin/masters/institute' },
        { label: 'Centers', path: '/app/admin/masters/centers', permission: ['orgCenter:list', 'orgCenter:view'] },
        { label: 'Programs', path: '/app/admin/masters/programs', permission: ['orgProgram:list', 'orgProgram:view'] },
        { label: 'Staff', path: '/app/admin/masters/staff', permission: ['orgStaff:list', 'orgStaff:view'] },
        { label: 'Departments', path: '/app/admin/masters/departments', permission: ['orgDept:list', 'orgDept:edit'] },
        { label: 'Subjects', path: '/app/admin/masters/subject', permission: ['orgSubject:list', 'orgSubject:create'] },
        { label: 'Bank Accounts', path: '/app/admin/masters/bankaccounts', permission: 'orgBankAccount:list' },
        { label: 'Users & Roles', path: '/app/admin/users', permission: ['orgUser:list', 'orgUser:view'] }
      ]
    }
  ];

  constructor(
    private router: Router,
    private breadcrumb: BredcrumpService,
    private permissionService: PermissionService,
  ) {
    this.breadcrumb.set([{ label: 'Dashboard' }]);
  }

  private linkAllowed(link: DashboardLink): boolean {
    if (!link.permission) return true;
    const keys = Array.isArray(link.permission) ? link.permission : [link.permission];
    return this.permissionService.hasAny(keys);
  }

  visibleLinks(card: DashboardCard): DashboardLink[] {
    return card.links.filter((l) => this.linkAllowed(l));
  }

  /** A card survives only if at least one of its links is visible — same
   *  rule as the header's nav-module filter. */
  get cards(): DashboardCard[] {
    return this.allCards.filter((c) => this.visibleLinks(c).length > 0);
  }

  go(path: string): void {
    if (!path) return;
    this.router.navigate([path]);
  }
}
