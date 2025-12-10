import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';

type ViewMode = 'list' | 'grid';

interface StudentListRow {
  id: number;
  name: string;
  enrolmentNo: string;
  program: string;
  center: string;
  status: 'Active' | 'Completed' | 'Dropout';
  mobile: string;
  city: string;
  attendancePct: number;
}

@Component({
  selector: 'app-students',
  standalone: false,
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss'
})
export class StudentsComponent implements OnInit {
  viewMode: ViewMode = 'list';
  loading = false;

  searchText = '';
  selectedProgram = '';
  selectedCenter = '';
  selectedStatus = '';

  // table columns (for list-table)
  columns = [
    { key: 'name',        label: 'Student Name',   sortable: true },
    { key: 'enrolmentNo', label: 'Enrolment No',   sortable: true },
    { key: 'program',     label: 'Program',        sortable: true },
    { key: 'center',      label: 'Center',         sortable: true },
    { key: 'status',      label: 'Status',         sortable: true },
    { key: 'mobile',      label: 'Mobile',         sortable: false }
  ];

  students: StudentListRow[] = [
    {
      id: 1,
      name: 'Arjun R',
      enrolmentNo: 'Z7I-JEE-2025-001',
      program: 'JEE 2 Year Classroom',
      center: 'Gandhipuram Center',
      status: 'Active',
      mobile: '9000000001',
      city: 'Coimbatore',
      attendancePct: 94
    },
    {
      id: 2,
      name: 'Lakshmi S',
      enrolmentNo: 'Z7I-NEET-2025-014',
      program: 'NEET 1 Year Repeaters',
      center: 'Nungambakkam Center',
      status: 'Active',
      mobile: '9000000002',
      city: 'Chennai',
      attendancePct: 88
    },
    {
      id: 3,
      name: 'Rahul Mehta',
      enrolmentNo: 'Z7I-JEE-2024-032',
      program: 'JEE Crash Course',
      center: 'Gandhipuram Center',
      status: 'Completed',
      mobile: '9000000003',
      city: 'Coimbatore',
      attendancePct: 91
    }
  ];

  filteredStudents: StudentListRow[] = [];

  programFilters: string[] = [];
  centerFilters: string[] = [];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-eye',
      tooltip: 'View details',
      color: '#6B7280',
      callback: (row: any) => this.openDetail(row)
    }
  ];

  constructor(
    private router: Router,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService
  ) {
    this.breadcrumb.set([
      { label: 'Students' }
    ]);
  }

  ngOnInit(): void {
    // derive filters from data
    this.programFilters = Array.from(new Set(this.students.map(s => s.program)));
    this.centerFilters  = Array.from(new Set(this.students.map(s => s.center)));

    this.applyFilters();
  }

  setView(mode: ViewMode): void {
    this.viewMode = mode;
  }

  applyFilters(): void {
    const term = (this.searchText || '').toLowerCase().trim();

    this.filteredStudents = this.students.filter(s => {
      const matchesText =
        !term ||
        s.name.toLowerCase().includes(term) ||
        s.enrolmentNo.toLowerCase().includes(term) ||
        s.mobile.toLowerCase().includes(term);

      const matchesProgram =
        !this.selectedProgram || s.program === this.selectedProgram;

      const matchesCenter =
        !this.selectedCenter || s.center === this.selectedCenter;

      const matchesStatus =
        !this.selectedStatus || s.status === this.selectedStatus;

      return matchesText && matchesProgram && matchesCenter && matchesStatus;
    });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    const first = parts[0]?.[0] ?? '';
    const last  = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  openDetail(row: StudentListRow): void {
    this.router.navigate(['/app/students/view', row.id]);
  }

  addStudent(): void {
    this.alertService.success('Add Student flow will be implemented later.');
  }
}
