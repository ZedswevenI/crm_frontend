import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import * as XLSX from 'xlsx';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

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
    { key: 'program', label: 'Program' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'assignments', label: 'Assignments' },
    { key: 'exams', label: 'Exam Results' },
    { key: 'fees', label: 'Fees' },
    { key: 'late', label: 'Late Entries' },
    { key: 'remark', label: 'Remarks' },
    { key: 'mark', label: 'Board marks' },
    { key: 'alumni', label: 'Alumni info' }
  ];
  activeTab: string = 'program';
  dataArray: any[] = [];
  columnsArray = [
    { key: 'date', label: 'Date', sortable: false },
    { key: 'period', label: 'Period', sortable: false },
    { key: 'subject', label: 'Subject', sortable: false },
    { key: 'topic', label: 'Topic', sortable: false },
    { key: 'feedback', label: 'Feedback', sortable: false },
    { key: 'status', label: 'Status', sortable: false },
  ];
  attendanceSummary: any = null;
  totalRecords = 0;
  columnsArray1 = [
    { key: 'testNo', label: 'Test No', sortable: false },
    { key: 'testCode', label: 'Test Code', sortable: false },
    { key: 'subject', label: 'Subject', sortable: false },
    { key: 'topic', label: 'Topic', sortable: false },
    { key: 'subTopic', label: 'Sub Topic', sortable: false },
    { key: 'marks', label: 'Marks', sortable: false },
    { key: 'completedAt', label: 'Date', sortable: false },
  ];
  dataArray1: any[] = [];
  topicSummary: { [topic: string]: { total: number; completed: number } } = {};
  columnsArray4 = [
    { key: 'date', label: 'Date', sortable: false },
    { key: 'type', label: 'Type', sortable: false },
    { key: 'remark', label: 'Remark', sortable: false },
    { key: 'reportedByParent', label: 'Reported By Parent', sortable: false },
  ];
  dataArray4: any[] = [];
  showRemarkForm = false;
  remarkLoading = false;
  remarkTypes = ['ACADEMIC', 'BEHAVIOUR', 'ATTENDANCE', 'HEALTH', 'OTHER'];
  newRemark = {
    type: 'ACADEMIC',
    dateOfIncident: '',
    remark: '',
    reportedByParent: true,
  };

  columnsLate = [
    { key: 'date', label: 'Date', sortable: false },
    { key: 'periodNo', label: 'Period', sortable: false },
    { key: 'entryType', label: 'Type', sortable: false },
    { key: 'delay', label: 'Delay (min)', sortable: false },
    { key: 'reason', label: 'Reason', sortable: false },
  ];
  lateEntries: any[] = [];
  lateLoading = false;
  columnsArray5 = [
    { key: 'receiptNo', label: 'Receipt No', sortable: false },
    { key: 'date', label: 'Date', sortable: false },
    { key: 'mode', label: 'Mode', sortable: false },
    { key: 'amount', label: 'Amount', sortable: false },
    { key: 'status', label: 'Status', sortable: false },
  ];
  dataArray5: any[] = [];
  boardExams: any[] = [];
  alumniData: any = null;
  alumniLoading = false;
  tabletLockLoading = false;
  photoObjectUrl: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService,
    private fb: FormBuilder
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Students & Batches' },
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
    this.initEditForm();
    this.loadStudentData();
  }

  setTab(key: string): void {
    this.activeTab = key;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  loadStudentData() {
    this.loading = true;
    const payload = { entiId: this.entiId, studentId: this.studentId };
    forkJoin({
      profile: this.commonApi.fetchData(payload, 'student', 'view'),
      finance: this.commonApi.fetchData(payload, 'student', 'finance/summary'),
      attendance: this.commonApi.fetchData(
        { entiId: this.entiId, studentNo: this.studentId },
        'student',
        'getattendance/report',
      ),
    })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (results: any) => {
          const p = results.profile?.data || {};
          const f = results.finance?.data || {};
          this.student = {
            basic: p.basic || {},
            program: p.program || {},
            fees: f || {},
          };
          this.photoUrl = p.basic?.photoUrl || null;
          if (this.photoUrl) this.loadStudentPhoto(this.photoUrl);
          this.boardExams = Array.isArray(p.basic?.boardExams)
            ? p.basic.boardExams
            : [];

          const attData = results.attendance?.data || {};
          this.attendanceSummary = attData.summary || null;
          this.totalRecords = (attData.details || []).length;
          this.dataArray = (attData.details || []).map((r: any) => ({
            date: r.date ? this.fmtEpoch(r.date) : '—',
            period: r.periodNo != null ? `Period ${r.periodNo}` : '—',
            subject: r.subjectName || '—',
            topic: r.topicTaught || '—',
            feedback: r.feedback || '—',
            status: r.status || '—',
          }));
          this.dataArray5 = (f.receipts || []).map((r: any) => ({
            receiptNo: r.receiptNo || '—',
            date: r.date ? this.fmtEpoch(r.date) : '—',
            mode: r.mode || '—',
            amount:
              r.amount != null
                ? `₹${Number(r.amount).toLocaleString('en-IN')}`
                : '—',
            status: r.status || '—',
          }));
          if (p.basic?.admissionNo) {
            this.loadRemarks(p.basic.admissionNo);
            this.loadAssignmentResults(p.basic.admissionNo);
            this.loadAlumniData(p.basic.admissionNo);
          }
          this.loadLateEntries();
        },
        error: (err: any) => {
          this.alert.error(
            err?.error?.message || 'Failed to load student details',
          );
        },
      });
  }

  editStudent(): void {
    this.alert.success('Edit profile flow to be implemented');
  }

  // Export
  exportToExcel() {
    if (!this.student) {
      this.alert.error('No student data to export');
      return;
    }
    const wb = XLSX.utils.book_new();
    const b = this.student.basic || {},
      p = this.student.program || {},
      f = this.student.fees || {};
    // Profile sheet (unchanged)
    const profileRows = [
      { Field: 'Name', Value: b.name || '—' },
      { Field: 'Admission No', Value: b.admissionNo || '—' },
      { Field: 'Status', Value: b.status || '—' },
      { Field: 'Mobile', Value: b.mobile || '—' },
      { Field: 'Email', Value: b.email || '—' },
      { Field: 'Parent Name', Value: b.parentName || '—' },
      { Field: 'Parent Mobile', Value: b.parentMobile || '—' },
      { Field: 'Gender', Value: b.gender || '—' },
      { Field: 'DOB', Value: b.dob ? this.fmtEpoch(b.dob) : '—' },
      { Field: 'Program', Value: p.programName || '—' },
      { Field: 'Batch', Value: p.batchName || '—' },
      { Field: 'Center', Value: p.centerName || '—' },
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(profileRows),
      'Profile',
    );
    // Attendance
    if (this.dataArray.length)
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          this.dataArray.map((r: any) => ({
            Date: r.date,
            Period: r.period,
            Subject: r.subject,
            Topic: r.topic,
            Status: r.status,
          })),
        ),
        'Attendance',
      );
    // Assignments
    if (this.dataArray1.length)
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          this.dataArray1.map((r: any) => ({
            'Test No': r.testNo,
            Subject: r.subject,
            Marks: r.marks,
            Date: r.completedAt,
          })),
        ),
        'Assignments',
      );
    // Remarks
    if (this.dataArray4.length)
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          this.dataArray4.map((r: any) => ({
            Date: r.date,
            Type: r.type,
            Remark: r.remark,
          })),
        ),
        'Remarks',
      );
    // Payments
    if (this.dataArray5.length)
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          this.dataArray5.map((r: any) => ({
            'Receipt No': r.receiptNo,
            Date: r.date,
            Mode: r.mode,
            Amount: r.amount,
            Status: r.status,
          })),
        ),
        'Payments',
      );
    // ── NEW: Board Exams sheet ────────────────────────────────────────────
    if (this.boardExams.length)
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          this.boardExams.map((e: any) => ({
            'Board Exam': e.boardExamName || '—',
            'School ID': e.schoolId || '—',
            S1: e.s1 ?? '—',
            S2: e.s2 ?? '—',
            S3: e.s3 ?? '—',
            S4: e.s4 ?? '—',
            S5: e.s5 ?? '—',
            S6: e.s6 ?? '—',
            S7: e.s7 ?? '—',
            Total: e.total ?? '—',
          })),
        ),
        'Board Exams',
      );
    // ── NEW: Alumni/Entrance sheet ────────────────────────────────────────
    if (this.alumniData) {
      const a = this.alumniData;
      const alumniRows = [
        {
          Exam: 'JEE Main',
          Subject: 'Physics',
          Score: a.jeeMain?.physics ?? '—',
        },
        {
          Exam: 'JEE Main',
          Subject: 'Chemistry',
          Score: a.jeeMain?.chemistry ?? '—',
        },
        { Exam: 'JEE Main', Subject: 'Maths', Score: a.jeeMain?.maths ?? '—' },
        { Exam: 'JEE Main', Subject: 'Total', Score: a.jeeMain?.total ?? '—' },
        { Exam: 'JEE Main', Subject: 'Rank', Score: a.jeeMain?.rank ?? '—' },
        {
          Exam: 'JEE Main',
          Subject: 'Selected',
          Score: a.jeeMain?.selected ?? '—',
        },
        {
          Exam: 'JEE Adv P1',
          Subject: 'Physics',
          Score: a.jeeAdv?.paper1?.physics ?? '—',
        },
        {
          Exam: 'JEE Adv P1',
          Subject: 'Chemistry',
          Score: a.jeeAdv?.paper1?.chemistry ?? '—',
        },
        {
          Exam: 'JEE Adv P1',
          Subject: 'Maths',
          Score: a.jeeAdv?.paper1?.maths ?? '—',
        },
        {
          Exam: 'JEE Adv P2',
          Subject: 'Physics',
          Score: a.jeeAdv?.paper2?.physics ?? '—',
        },
        {
          Exam: 'JEE Adv P2',
          Subject: 'Chemistry',
          Score: a.jeeAdv?.paper2?.chemistry ?? '—',
        },
        {
          Exam: 'JEE Adv P2',
          Subject: 'Maths',
          Score: a.jeeAdv?.paper2?.maths ?? '—',
        },
        {
          Exam: 'JEE Adv',
          Subject: 'Grand Total',
          Score: a.jeeAdv?.grandTotal ?? '—',
        },
        { Exam: 'JEE Adv', Subject: 'Rank', Score: a.jeeAdv?.rank ?? '—' },
        {
          Exam: 'JEE Adv',
          Subject: 'Selected',
          Score: a.jeeAdv?.selected ?? '—',
        },
        { Exam: 'NEET', Subject: 'Physics', Score: a.neet?.physics ?? '—' },
        { Exam: 'NEET', Subject: 'Chemistry', Score: a.neet?.chemistry ?? '—' },
        { Exam: 'NEET', Subject: 'Biology', Score: a.neet?.biology ?? '—' },
        { Exam: 'NEET', Subject: 'Total', Score: a.neet?.total ?? '—' },
        { Exam: 'NEET', Subject: 'Rank', Score: a.neet?.rank ?? '—' },
        { Exam: 'NEET', Subject: 'College', Score: a.neet?.collegeName ?? '—' },
        { Exam: 'NEET', Subject: 'Course', Score: a.neet?.course ?? '—' },
      ];
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(alumniRows),
        'Entrance Exams',
      );
    }
    XLSX.writeFile(wb, `Student_${b.admissionNo || b.name || 'Export'}.xlsx`);
  }

  fmtEpoch(epoch: any): string {
    if (!epoch) return '—';
    return new Date(Number(epoch)).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  //Edit
  editForm!: FormGroup;
  showEditModal = false;
  editLoading = false;

  private initEditForm() {
    this.editForm = this.fb.group({
      name: ['', [Validators.required]],
      phone: [''],
      phone1: [''],
      phone2: [''],
      email: [''],
      email1: [''],
      email2: [''],
      parentName: [''],
      parentPhone: [''],
      addressLine1: [''],
      city: [''],
      gender: [''],
      dob: [''],
    });
  }

  openEditProfile() {
    const b = this.student?.basic || {};
    this.editForm.patchValue({
      name: b.name || '',
      phone: b.mobile || '',
      phone1: b.phone1 || '',
      phone2: b.phone2 || '',
      email: b.email || '',
      email1: b.email1 || '',
      email2: b.email2 || '',
      parentName: b.parentName || '',
      parentPhone: b.parentMobile || '',
      addressLine1: b.addressLine1 || '',
      city: b.city || '',
      gender: b.gender || '',
      dob: b.dob ? this.epochToDateInput(b.dob) : '',
    });
    this.showEditModal = true;
  }

  private epochToDateInput(ms: any): string {
    const n = Number(ms);
    if (!n) return '';
    const d = new Date(n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  closeEditModal() {
    this.showEditModal = false;
  }


  saveProfile() {
    if (this.editLoading) return;
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const v = this.editForm.value;
    const payload: any = {
      entiId: this.entiId,
      studentId: this.studentId,
      name: safeTrim(v.name),
      phone: safeTrim(v.phone) || null,
      phone1: safeTrim(v.phone1) || null,
      phone2: safeTrim(v.phone2) || null,
      email: safeTrim(v.email) || null,
      email1: safeTrim(v.email1) || null,
      email2: safeTrim(v.email2) || null,
      parentName: safeTrim(v.parentName) || null,
      parentMobile: safeTrim(v.parentPhone) || null,
      addressLine1: safeTrim(v.addressLine1) || null,
      city: safeTrim(v.city) || null,
      gender: safeTrim(v.gender) || null,
      dob: v.dob ? new Date(`${v.dob}T00:00:00`).getTime() : null,
    };
    this.editLoading = true;
    this.commonApi
      .fetchData(payload, 'student', 'basic-details/update')
      .subscribe({
        next: () => {
          this.editLoading = false;
          this.alert.success('Profile updated');
          this.closeEditModal();
          this.loadStudentData();
        },
        error: (err: any) => {
          this.editLoading = false;
          this.alert.error(err?.error?.message || 'Update failed');
        },
      });
  }

  //Lock

  toggleTabletLock() {
    if (this.tabletLockLoading || !this.student) return;
    const isBlocked = this.student.basic?.isTabletBlocked;
    const endpoint = isBlocked ? 'tablet/unlock' : 'tablet/lock';
    const lockType = 'SOFT_LOCK';
    const confirmMsg = isBlocked
      ? 'Unlock tablet access for this student?'
      : 'Lock tablet access for this student?';

    if (!confirm(confirmMsg)) return;
    const payload: any = {
      entiId: this.entiId,
      studentId: this.studentId,
      reason: isBlocked ? 'Unlocked by admin' : 'Locked by admin',
    };
    if (!isBlocked) payload.lockType = lockType;
    this.tabletLockLoading = true;
    this.commonApi.fetchData(payload, 'student', endpoint).subscribe({
      next: (res: any) => {
        this.tabletLockLoading = false;
        if (res?.status) {
          this.student.basic.isTabletBlocked = !isBlocked;
          this.alert.success(
            isBlocked
              ? 'Tablet unlocked successfully'
              : 'Tablet locked successfully',
          );
        } else {
          this.alert.error(res?.message || 'Operation failed');
        }
      },
      error: (err: any) => {
        this.tabletLockLoading = false;
        this.alert.error(
          err?.error?.message || 'Failed to update tablet access',
        );
      },
    });
  }

  //Profile
  photoUrl: string | null = null;
  ngOnDestroy(): void {
    if (this.photoObjectUrl) URL.revokeObjectURL(this.photoObjectUrl);
  }
  loadStudentPhoto(photoUrl: string) {
    if (!photoUrl) return;
    this.commonApi
      .downloadByUrl({ entiId: this.entiId, url: photoUrl }, 'ims', 'download')
      .subscribe({
        next: (blob: Blob) => {
          if (this.photoObjectUrl) URL.revokeObjectURL(this.photoObjectUrl);
          this.photoObjectUrl = URL.createObjectURL(blob);
        },
        error: () => {
          this.photoObjectUrl = null;
        },
      });
  }

  // tabs
  loadRemarks(admissionNo: string) {
    if (!admissionNo) return;
    this.commonApi
      .fetchData({ entiId: this.entiId, admissionNo }, 'student', 'remark/list')
      .subscribe({
        next: (res: any) => {
          this.dataArray4 = (res?.data || []).map((r: any) => ({
            date: r.dateOfIncident ? this.fmtEpoch(r.dateOfIncident) : '—',
            type: r.type || '—',
            remark: r.remark || '—',
            reportedByParent: r.reportedByParent ? 'Yes' : 'No',
          }));
        },
        error: () => { },
      });
  }

  loadAssignmentResults(admissionNo: string) {
    this.commonApi
      .fetchData(
        { entiId: this.entiId, admissionNo },
        'assignment',
        'result/list/student',
      )
      .subscribe({
        next: (res: any) => {
          const rows = res?.data || [];
          this.dataArray1 = rows.map((r: any) => ({
            testNo: r.testNo || '—',
            testCode: r.testCode || '—',
            subject: r.subjectId || '—',
            topic: r.topicId || '—',
            subTopic: r.subTopicId || '—',
            marks: r.answers
              ? `${r.answers.filter((a: any) => a.isCorrect).length}/${r.answers.length}`
              : '—',
            completedAt: r.completedAt ? this.fmtEpoch(r.completedAt) : '—',
          }));
          const summary: {
            [topic: string]: { total: number; completed: number };
          } = {};
          for (const r of rows) {
            const topic = safeTrim(r.topicId || 'Unknown');
            if (!summary[topic]) summary[topic] = { total: 0, completed: 0 };
            summary[topic].total++;
            if (r.status === 'completed') summary[topic].completed++;
          }
          this.topicSummary = summary;
        },
        error: () => {
          this.dataArray1 = [];
          this.topicSummary = {};
        },
      });
  }

  get topicSummaryKeys(): string[] {
    return Object.keys(this.topicSummary);
  }

  loadAlumniData(admissionNo: string) {
    if (!admissionNo) return;
    this.alumniLoading = true;
    this.commonApi
      .fetchData({ entiId: this.entiId, admissionNo }, 'student', 'alumni-data')
      .subscribe({
        next: (res: any) => {
          this.alumniLoading = false;
          this.alumniData = res?.data || null;
        },
        error: () => {
          this.alumniLoading = false;
          this.alumniData = null;
        },
      });
  }

  loadLateEntries() {
    this.lateLoading = true;
    this.commonApi
      .fetchData(
        { entiId: this.entiId, studentNo: this.studentId },
        'timetable',
        'late-entry/list/student',
      )
      .subscribe({
        next: (res: any) => {
          this.lateLoading = false;
          this.lateEntries = (res?.data || []).map((r: any) => ({
            date: r.date ? this.fmtEpoch(r.date) : '—',
            periodNo: r.periodNo != null ? `Period ${r.periodNo}` : '—',
            entryType: r.entryType || 'LATE',
            delay: r.delayMinutes ?? '—',
            reason: r.reason || '—',
          }));
        },
        error: () => {
          this.lateLoading = false;
          this.lateEntries = [];
        },
      });
  }

  //remarks
  toggleRemarkForm() {
    this.showRemarkForm = !this.showRemarkForm;
  }


  submitRemark() {
    if (this.remarkLoading) return;
    if (!safeTrim(this.newRemark.remark)) {
      this.alert.error('Remark is required');
      return;
    }
    if (!this.newRemark.dateOfIncident) {
      this.alert.error('Date is required');
      return;
    }
    const admissionNo = safeTrim(this.student?.basic?.admissionNo);
    if (!admissionNo) return;
    const payload = {
      entiId: this.entiId,
      admissionNo,
      type: this.newRemark.type,
      dateOfIncident: new Date(
        `${this.newRemark.dateOfIncident}T00:00:00`,
      ).getTime(),
      remark: safeTrim(this.newRemark.remark),
      reportedByParent: this.newRemark.reportedByParent,
    };
    this.remarkLoading = true;
    this.commonApi.fetchData(payload, 'student', 'remark/add').subscribe({
      next: () => {
        this.remarkLoading = false;
        this.alert.success('Remark added');
        this.showRemarkForm = false;
        this.newRemark = {
          type: 'ACADEMIC',
          dateOfIncident: '',
          remark: '',
          reportedByParent: true,
        };
        this.loadRemarks(admissionNo);
      },
      error: (err: any) => {
        this.remarkLoading = false;
        this.alert.error(err?.error?.message || 'Failed to add remark');
      },
    });
  }
}