import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

const safeTrim = (v: any) => (v === undefined || v === null ? '' : String(v).trim());

@Component({
  selector: 'app-studentsview',
  standalone: false,
  templateUrl: './studentsview.component.html',
  styleUrl: './studentsview.component.scss'
})
export class StudentsviewComponent implements OnInit {
  loading = false;
  entiId: any;
  studentId = '';
  private moduleName = 'student';
  student: any = null;
  tabs = [
    { key: 'program',     label: 'Program' },
    { key: 'attendance',  label: 'Attendance' },
    { key: 'assignments', label: 'Assignments' },
    { key: 'exams',       label: 'Exam Results' },
    { key: 'fees',        label: 'Fees' }
  ];
  activeTab: string = 'program';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Students', link: '/app/students' },
      { label: 'Student Detail' }
    ]);
  }

  ngOnInit(): void {
    this.studentId = safeTrim(this.route.snapshot.paramMap.get('id'));
    if (!this.studentId) {
      this.alert.error('Student ID missing');
      this.router.navigate(['/app/students']);
      return;
    }
    this.loadStudentData();
  }

  setTab(key: string): void {
    this.activeTab = key;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    const first = parts[0]?.[0] ?? '';
    const last  = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  loadStudentData() {
    this.loading = true;
    const payload = { entiId: this.entiId, studentId: this.studentId };
    forkJoin({
      profile: this.commonApi.fetchData(payload, this.moduleName, 'view'),
      finance: this.commonApi.fetchData(payload, this.moduleName, 'finance/summary'),
      academic: this.commonApi.fetchData(payload, this.moduleName, 'academic/summary')
    }).subscribe({
      next: (results: any) => {
        this.loading = false;
        const p = results.profile?.data || {};
        const f = results.finance?.data || {};
        const a = results.academic?.data || {};
        this.student = {
          basic: p.basic || {},
          program: p.program || {},
          fees: f || {},
          attendance: a.attendance || {},
          assignments: a.assignments || {},
          exams: a.exams || {}
        };
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Failed to load student details');
      }
    });
  }

  editStudent(): void {
    this.alert.success('Edit profile flow to be implemented');
  }
}