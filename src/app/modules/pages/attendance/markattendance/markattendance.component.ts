import { Component, OnInit, OnDestroy } from '@angular/core';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { AlertService } from '../../../../service/alert/alert.service';

@Component({
  selector: 'app-markattendance',
  standalone: false,
  templateUrl: './markattendance.component.html',
  styleUrl: './markattendance.component.scss',
})
export class MarkattendanceComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly moduleName = 'attendance';
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

  students: any[] = [];
  loading = false;
  submitting = false;
  selectAll = false;
  isEditMode = false;
  topicTaught = '';
  feedback = '';
  showSummary = false;
  presentCount = 0;
  absentCount = 0;
  lateCount = 0;

  constructor(
    private breadcrumb: BredcrumpService,
    public router: Router,
    private commonApi: CommonapiService,
    private alert: AlertService,
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
            (s: any) => ({ ...s }),
          );
          this.recalcSelectAll();
        },
        error: () => {
          this.loading = false;
          this.alert.error('Failed to load students');
        },
      });
  }

  toggleAttendance(student: any): void {
    if (student.status === 'NOT_MARKED') {
      student.status = 'PRESENT';
    } else if (student.status === 'PRESENT') {
      student.status = 'ABSENT';
    } else if (student.status === 'ABSENT') {
      student.status = 'PRESENT';
    } else if (student.status === 'LATE') {
      student.status = 'ABSENT';
    }
    this.recalcSelectAll();
  }

  toggleSelectAll(): void {
    this.students.forEach((s) => {
      if (s.status !== 'LATE') {
        s.status = this.selectAll ? 'PRESENT' : 'ABSENT';
      }
    });
  }

  recalcSelectAll(): void {
    const nonLate = this.students.filter((s) => s.status !== 'LATE');
    this.selectAll =
      nonLate.length > 0 && nonLate.every((s) => s.status === 'PRESENT');
  }

  submitAttendance(): void {
    const unmarked = this.students.filter((s) => s.status === 'NOT_MARKED');
    if (unmarked.length > 0) {
      this.alert.warning(
        `${unmarked.length} student(s) not marked yet. Please mark all students before submitting.`,
      );
      return;
    }
    this.presentCount = this.students.filter(
      (s) => s.status === 'PRESENT',
    ).length;
    this.absentCount = this.students.filter(
      (s) => s.status === 'ABSENT',
    ).length;
    this.lateCount = this.students.filter((s) => s.status === 'LATE').length;
    this.showSummary = true;
  }

  onConfirm(): void {
    this.showSummary = false;
    const validStudents = this.students
      .filter(
        (s) =>
          s.status === 'PRESENT' ||
          s.status === 'ABSENT' ||
          s.status === 'LATE',
      )
      .map((s) => ({
        studentId: s.studentId,
        admissionNo: s.admissionNo,
        status: s.status,
        remarks: s.remarks || null,
      }));
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
      students: validStudents,
    };
    this.submitting = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'mark')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submitting = false;
          this.alert.success('Attendance submitted successfully');
          this.router.navigate(['/app/attendance']);
        },
        error: (err: any) => {
          this.submitting = false;
          this.alert.error(
            err?.error?.message ||
              'Failed to submit attendance. Please try again.',
          );
        },
      });
  }
}
