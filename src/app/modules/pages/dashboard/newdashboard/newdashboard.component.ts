import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

interface DashboardLink {
  label: string;
  path: string;
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
        { label: 'New Admission', path: '/app/admissions/new' },
        { label: 'Search Enrollment', path: '/app/admissions' },
        { label: 'Wait for Approval', path: '/app/admissions/waitforapproval' },
        { label: 'Admission Reports', path: '/app/admissions/reports' },
        { label: 'Communication', path: '/app/admissions/communication' },
        { label: 'Fee Calculator', path: '/app/admissions/fee-calculator' },
        { label: 'Fee Plans', path: '/app/fees/plans' }
      ]
    },
    {
      title: 'Fee Management',
      icon: 'fa-solid fa-indian-rupee-sign',
      accent: 'accent-fees',
      links: [{ label: 'Fee Collection', path: '/app/fees/collection' }, { label: 'Fee Reports', path: '/app/fees/reports' }, { label: 'Fee Plans', path: '/app/fees/plans' }]
    },
    {
      title: 'Accounts',
      icon: 'fa-regular fa-file-lines',
      accent: 'accent-accounts',
      links: [
        { label: 'All Payments', path: '/app/accounts/payments' },
        { label: 'NEFT Register', path: '/app/accounts/neft' },
        { label: 'Cheque Register', path: '/app/accounts/cheques' },
        { label: 'Cheque Deposit', path: '/app/accounts/deposit' },
        { label: 'Cheque Extensions', path: '/app/accounts/extention' },
        { label: 'Cheque Replacements', path: '/app/accounts/replacements' }
      ]
    },
    {
      title: 'Academics',
      icon: 'fa-solid fa-people-group',
      accent: 'accent-students',
      links: [
        { label: 'Students', path: '/app/students' },
        { label: 'Batches', path: '/app/batches' },
        { label: 'Phaseplan', path: '/app/phaseplan' },
        { label: 'Timetable', path: '/app/timetable' },
        { label: 'Attendance', path: '/app/attendance' },
        { label: 'Topics', path: '/app/admin/masters/institute' },
        { label: 'Subtopics', path: '/app/admin/masters/institute' },
        { label: 'Subjects', path: '/app/admin/masters/institute' },
        { label: 'Exam Category', path: '/app/admin/masters/institute' },
        { label: 'Exam Sub Category', path: '/app/admin/masters/institute' }
      ]
    },
    {
      title: 'Utilities',
      icon: 'fa-solid fa-gear',
      accent: 'accent-org',
      links: [
        { label: 'Institute', path: '/app/admin/masters/institute' },
        { label: 'Centers', path: '/app/admin/masters/centers' },
        { label: 'Programs', path: '/app/admin/masters/programs' },
        { label: 'Staff', path: '/app/admin/masters/staff' },
        { label: 'Departments', path: '/app/admin/masters/departments' },
        { label: 'Subjects', path: '/app/admin/masters/subject' },
        { label: 'Bank Accounts', path: '/app/admin/masters/bankaccounts' },
        { label: 'Users & Roles', path: '/app/admin/users' }
      ]
    }
  ];

  cards: DashboardCard[] = this.allCards;

  constructor(private router: Router, private breadcrumb: BredcrumpService) {
    this.breadcrumb.set([{ label: 'Dashboard' }]);
    const role = (localStorage.getItem('userRole') || '').trim().toUpperCase();
    if (role === 'L6') {
      this.cards = this.allCards.filter((c) => c.title === 'Accounts');
    }
  }

  go(path: string): void {
    if (!path) return;
    this.router.navigate([path]);
  }
}
