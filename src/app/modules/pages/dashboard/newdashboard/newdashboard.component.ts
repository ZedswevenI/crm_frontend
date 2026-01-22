import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';

interface DashboardLink {
  label: string;
  path: string;
}

interface DashboardCard {
  category: string;
  title: string;
  description: string;
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
  cards: DashboardCard[] = [
    {
      category: 'Admissions & Fees',
      title: 'Admission Workflow',
      description: 'Create new admissions, search enrollments and run fee simulations.',
      icon: 'fa-solid fa-user-graduate',
      accent: 'accent-admissions',
      links: [
        { label: 'New Admission', path: '/app/admissions/new' },
        { label: 'Search Enrollment', path: '/app/admissions' },
        { label: 'Admission Reports', path: '/app/admissions/reports' },
        { label: 'Communication', path: '/app/admissions/communication' },
        { label: 'Fee Calculator', path: '/app/admissions/fee-calculator' }
      ]
    },
    {
      category: 'Admissions & Fees',
      title: 'Fee Management',
      description: 'Collect fees, track dues and configure fee plans.',
      icon: 'fa-solid fa-indian-rupee-sign',
      accent: 'accent-fees',
      links: [{ label: 'Fee Collection', path: '/app/fees/collection' }, { label: 'Fee Reports', path: '/app/fees/reports' }, { label: 'Fee Plans', path: '/app/fees/plans' }]
    },
    {
      category: 'Accounts',
      title: 'Accounts & Registers',
      description: 'Monitor all payments, NEFT, cheques and deposits.',
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
      category: 'Students & Batches',
      title: 'Student & Batch Management',
      description: 'Maintain student profiles and manage batches.',
      icon: 'fa-solid fa-people-group',
      accent: 'accent-students',
      links: [{ label: 'Students', path: '/app/students' }, { label: 'Batches', path: '/app/batches' }]
    },
    {
      category: 'Timetable',
      title: 'Schedules & Classes',
      description: 'Plan and view academic timetable.',
      icon: 'fa-regular fa-calendar-days',
      accent: 'accent-timetable',
      links: [{ label: 'Timetable', path: '/app/timetable' }]
    },
    {
      category: 'Org Config',
      title: 'Organisation Configurations',
      description: 'Configure centers, programs, staff and more.',
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

  constructor(private router: Router, private breadcrumb: BredcrumpService) {
    this.breadcrumb.set([{ label: 'Dashboard' }]);
  }

  go(path: string): void {
    if (!path) return;
    this.router.navigate([path]);
  }
}
