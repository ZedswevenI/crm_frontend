import { Component, OnInit, OnDestroy } from '@angular/core';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

@Component({
  selector: 'app-markattendance',
  standalone: false,
  templateUrl: './markattendance.component.html',
  styleUrl: './markattendance.component.scss',
})
export class MarkattendanceComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly moduleName = 'attendance';

  // ---- Context passed from attendance list via router state ----
  batchCode = '';
  timetableId = '';
  periodNo = 0;
  facultyId = '';
  subjectId = '';
  subjectName = '';
  date = 0;
  dateLabel = '';
  timeLabel = '';
  mode = '';
  periodType = '';

  // ---- Students ----
  students: any[] = [];
  loading = false;
  submitting = false;
  selectAll = false;
  isEditMode = false;

  // ---- Extra fields ----
  topicTaught = '';
  feedback = '';

  // ---- Summary popup ----
  showSummary = false;
  presentCount = 0;
  absentCount = 0;
  absentStudents: string[] = [];
  presentStudents: string[] = [];

  constructor(
    private breadcrumb: BredcrumpService,
    public router: Router,
    private commonApi: CommonapiService
  ) {
    this.breadcrumb.set([
      { label: 'Attendance', link: '/app/attendance' },
      { label: 'Student List' },
    ]);
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state || history.state || {};
    this.batchCode = state.batchCode || '';
    this.timetableId = state.timetableId || '';
    this.periodNo = state.periodNo || 0;
    this.facultyId = state.facultyId || '';
    this.subjectId = state.subjectId || '';
    this.subjectName = state.subjectName || '';
    this.date = state.date || 0;
    this.dateLabel = state.dateLabel || '';
    this.timeLabel = state.timeLabel || '';
    this.mode = state.mode || '';
    this.periodType = state.periodType || '';
  }

  ngOnInit(): void {
    if (!this.batchCode || !this.date || !this.periodNo) {
      this.router.navigate(['/app/attendance']);
      return;
    }
    this.loadStudents();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---- Load students with existing attendance status ----
  loadStudents(): void {
    const tenantId = localStorage.getItem('tenantId');
    const payload = {
      tenantId,
      batchCode: this.batchCode,
      date: this.date,
      periodNo: this.periodNo,
    };

    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'students/list')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.isEditMode = !!res?.isEditMode;
          this.topicTaught = res?.existingTopicTaught || '';
          this.feedback = res?.existingFeedback || '';

          this.students = (Array.isArray(res?.data) ? res.data : []).map(
            (s: any) => ({
              ...s,
            }),
          );
          this.recalcSelectAll();
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  // ---- Toggle single student ----
  toggleAttendance(student: any): void {
    if (student.status === 'PRESENT') {
      student.status = 'ABSENT';
    } else {
      student.status = 'PRESENT';
    }
    this.recalcSelectAll();
  }

  // ---- Select all ----
  toggleSelectAll(): void {
    this.students.forEach((s) => {
      s.status = this.selectAll ? 'PRESENT' : 'ABSENT';
    });
  }

  recalcSelectAll(): void {
    this.selectAll =
      this.students.length > 0 &&
      this.students.every((s) => s.status === 'PRESENT');
  }

  // ---- Submit — shows summary first ----
  submitAttendance(): void {
    const present = this.students.filter((s) => s.status === 'PRESENT');
    const absent = this.students.filter((s) => s.status !== 'PRESENT');

    this.presentCount = present.length;
    this.absentCount = absent.length;
    this.presentStudents = present.map((s) => s.name);
    this.absentStudents = absent.map((s) => s.name);
    this.showSummary = true;
  }

  // ---- Confirm — call mark API ----
  onConfirm(): void {
    this.showSummary = false;
    const tenantId = localStorage.getItem('tenantId');
    const payload = {
      tenantId,
      batchCode: this.batchCode,
      timetableId: this.timetableId,
      date: this.date,
      periodNo: this.periodNo,
      facultyId: this.facultyId,
      subjectId: this.subjectId,
      topicTaught: this.topicTaught,
      feedback: this.feedback,
      students: this.students.map((s) => ({
        studentId: s.studentId,
        admissionNo: s.admissionNo,
        status: s.status,
        remarks: s.remarks || null,
      })),
    };
    this.submitting = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'mark')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submitting = false;
          this.router.navigate(['/app/attendance']);
        },
        error: (err: any) => {
          this.submitting = false;
          console.error('Failed to mark attendance', err);
        },
      });
  }
}
