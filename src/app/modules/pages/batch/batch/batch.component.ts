import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { Router } from '@angular/router';

const safeTrim = (v: any) =>
  v === undefined || v === null ? '' : String(v).trim();

@Component({
  selector: 'app-batch',
  standalone: false,
  templateUrl: './batch.component.html',
  styleUrl: './batch.component.scss',
})
export class BatchComponent implements OnInit {
  loading = false;
  entiId: any;
  private moduleName = 'batch';
  private ayInfoEndpoint = 'ayinfo';

  // ── forms ──────────────────────────────────────────────────────────────────
  filterForm!: FormGroup;
  editorForm!: FormGroup;

  // ── table ──────────────────────────────────────────────────────────────────
  totalRecords = 0;
  batchRows: any[] = [];

  // ── options ────────────────────────────────────────────────────────────────
  statusOptions = [
    { label: 'ALL', value: 'ALL' },
    { label: 'DRAFT', value: 'DRAFT' },
    { label: 'ACTIVE', value: 'ACTIVE' },
    { label: 'CLOSED', value: 'CLOSED' },
    { label: 'INACTIVE', value: 'INACTIVE' },
  ];
  statusEditorOptions = [
    { label: 'DRAFT', value: 'DRAFT' },
    { label: 'ACTIVE', value: 'ACTIVE' },
    { label: 'CLOSED', value: 'CLOSED' },
    { label: 'INACTIVE', value: 'INACTIVE' },
  ];
  filterAcademicYearOptions: any[] = [{ label: 'All', value: '' }];
  programsFull: any[] = [];
  centersFull: any[] = [];
  programOptions: any[] = [{ label: 'All', value: '' }];
  centerOptions: any[] = [{ label: 'All', value: '' }];
  programOptionsForEditor: any[] = [{ label: 'Select', value: '' }];
  centerOptionsForEditor: any[] = [{ label: 'Select', value: '' }];
  courseStartYearOptions: any[] = [{ label: 'Select', value: '' }];
  ayInfoDoc: any | null = null;

  // ── table columns / actions ────────────────────────────────────────────────
  columns = [
    { key: 'batchName', label: 'Batch Name', sortable: false },
    { key: 'batchCode', label: 'Code', sortable: false },
    { key: 'academicYear', label: 'AY', sortable: false },
    { key: 'programName', label: 'Program', sortable: false },
    { key: 'centerName', label: 'Center', sortable: false },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      type: 'badge',
      badgeColors: {
        ACTIVE: 'badge bg-success-subtle text-success',
        DRAFT: 'badge bg-secondary-subtle text-secondary',
        CLOSED: 'badge bg-danger-subtle text-danger',
        INACTIVE: 'badge bg-dark-subtle text-dark',
      },
    },
    { key: 'studentCount', label: 'Students', sortable: false },
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-eye',
      tooltip: 'View',
      color: '#6B7280',
      hoverColor: '#0066FF',
      callback: (row: any) => this.openView(row),
    },
    {
      type: 'dropdown',
      text: 'Actions',
      icon: 'fa-solid fa-ellipsis-vertical',
      color: 'secondary',
      dropdown: [
        { text: 'Edit Batch', icon: 'fa-regular fa-pen-to-square', callback: (row: any) => this.openEdit(row) },
        { text: 'Assign Students', icon: 'fa-solid fa-user-plus', callback: (row: any) => this.openAssignStudents(row) },
        { text: 'Assign Staff', icon: 'fa-solid fa-users-gear', callback: (row: any) => this.openStaffMap(row) },
        { text: 'Promote Batch', icon: 'fa-solid fa-arrow-up-right-dots', callback: (row: any) => this.openPromote(row) },
        { text: 'Log Late Entry', icon: 'fa-solid fa-clock-rotate-left', callback: (row: any) => this.openLateEntry(row) },
        { text: 'Add Special Class', icon: 'fa-solid fa-calendar-plus', callback: (row: any) => this.openSpecialClass(row) },
      ]
    },
  ];

  // ── filters ─────────────────────────────────────────────────────────────────
  showFilters = false;

  // ── create/edit modal ──────────────────────────────────────────────────────
  showEditorModal = false;
  isEditMode = false; // ✅ FIX: track create vs edit
  editingBatchId = ''; // ✅ FIX: keep batchId for update call

  // ── assign students modal ──────────────────────────────────────────────────
  showAssignModal = false;
  activeBatch: any = null;
  eligibleStudents: any[] = [];
  eligibleStudentsFiltered: any[] = [];
  eligibleSearch = '';
  selectedStudentIds = new Set<string>();

  // ── staff map modal ────────────────────────────────────────────────────────
  showStaffModal = false;
  activeBatchForStaff: any | null = null;
  staffListFull: any[] = [];
  staffOptions: any[] = [{ label: 'Select', value: '' }];
  staffOptionsAll: any[] = [{ label: 'Select', value: '' }];
  staffOptionsFiltered: any[] = [{ label: 'Select', value: '' }];
  batchSubjectOptions: any[] = [{ label: 'Select', value: '' }];
  staffDraft: any = { subjectId: '', staffId: '' };
  staffMapRows: any[] = [];

  // ── promote modal ──────────────────────────────────────────────────────────
  showPromoteModal = false;
  promoteBatch: any = null;

  // ── late entry modal ───────────────────────────────────────────────────────
  showLateModal = false;
  lateEntryBatch: any = null;
  lateForm!: FormGroup;
  lateTypeOptions = [
    { label: 'Staff', value: 'STAFF' },
    { label: 'Student', value: 'STUDENT' },
  ];
  // For student late entry — load batch students
  batchStudents: any[] = [];
  batchStudentsLoading = false;
  // For staff late entry — reuse staffListFull (loaded on init)

  // ── special class modal ────────────────────────────────────────────────────
  showSpecialClassModal = false;
  specialClassBatch: any = null;
  specialClassForm!: FormGroup;
  specialClassSubjectOptions: any[] = [{ label: 'Select', value: '' }];
  specialClassStaffOptions: any[] = [{ label: 'Select', value: '' }];
  periodTypeOptions = [
    { label: 'Lecture', value: 'LECTURE' },
    { label: 'Lab', value: 'LAB' },
    { label: 'Tutorial', value: 'TUTORIAL' },
    { label: 'Test', value: 'TEST' },
    { label: 'Revision', value: 'REVISION' },
    { label: 'Exam', value: 'EXAM' },
  ];
  modeOptions = [
    { label: 'Offline', value: 'OFFLINE' },
    { label: 'Online', value: 'ONLINE' },
  ];

  promoteNewProgramId = '';
  promoteProgramOptions: any[] = [];
  promoteResult: any = null;

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService,
    private router: Router,
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Batches' },
    ]);
  }

  ngOnInit(): void {
    this.initForms();
    this.buildCourseStartYearOptions();
    this.loadProgramsFull();
    this.loadCentersFull();
    this.loadAcademicYearConfigsForFilter();
    this.loadBatches({ page: 1, pageSize: 20 });
    this.loadStaffFull();

    // ✅ FIX: only react to valueChanges when modal is in CREATE mode
    this.editorForm.get('courseStartYear')?.valueChanges.subscribe(() => {
      if (!this.isEditMode) this.onCreateInputsChanged();
    });
    this.editorForm.get('programId')?.valueChanges.subscribe((v: any) => {
      this.onProgramChanged(v);
      if (!this.isEditMode) this.onCreateInputsChanged();
    });
    this.editorForm.get('centerId')?.valueChanges.subscribe((v: any) => {
      this.onCenterChanged(v);
    });

    // Late entry: reload person list when type changes
    this.lateForm?.get('type')?.valueChanges.subscribe(() => {
      this.onLateTypeChanged();
    });
  }

  // ── form init ───────────────────────────────────────────────────────────────
  initForms() {
    this.filterForm = this.fb.group({
      search: [''],
      status: ['ALL'],
      academicYear: [''],
      programId: [''],
      centerId: [''],
    });

    this.editorForm = this.fb.group({
      batchName: ['', [Validators.required]],
      batchCode: ['', [Validators.required]],
      courseStartYear: ['', [Validators.required]],
      cohortAy: [''],
      academicYear: [''],
      programId: ['', [Validators.required]],
      programName: [''],
      programCode: [''],
      centerId: ['', [Validators.required]],
      centerName: [''],
      centerCode: [''],
      startDate: ['', [Validators.required]],
      endDate: [''],
      status: ['ACTIVE', [Validators.required]],
      remarks: [''],
    });

    this.lateForm = this.fb.group({
      type: ['STAFF', [Validators.required]],
      personId: ['', [Validators.required]],
      timetableId: ['', [Validators.required]],
      periodNo: [1, [Validators.required, Validators.min(1)]],
      scheduledStartMin: [0, [Validators.required, Validators.min(0)]],
      delayMinutes: [0, [Validators.required, Validators.min(0)]],
      reason: [''],
    });

    this.specialClassForm = this.fb.group({
      date: ['', [Validators.required]],
      periodNo: [1, [Validators.required, Validators.min(1)]],
      startTime: ['', [Validators.required]],
      endTime: ['', [Validators.required]],
      subjectId: ['', [Validators.required]],
      staffId: ['', [Validators.required]],
      periodType: ['LECTURE', [Validators.required]],
      mode: ['OFFLINE', [Validators.required]],
      topic: [''],
      venue: [''],
      zoomUrl: [''],
    });
  }

  // ── filters ─────────────────────────────────────────────────────────────────
  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  clearFilters() {
    this.filterForm.reset({
      search: '',
      status: 'ALL',
      academicYear: '',
      programId: '',
      centerId: '',
    });
    this.refresh();
  }

  refresh() {
    this.loadBatches({ page: 1, pageSize: 20 });
  }

  // ── query builder ───────────────────────────────────────────────────────────
  private buildQueryParams(params: Record<string, any>) {
    const keys = Object.keys(params || {}).filter(
      (k) => params[k] !== undefined && params[k] !== null && params[k] !== '',
    );
    if (!keys.length) return '';
    return (
      '?' +
      keys
        .map(
          (k) =>
            `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`,
        )
        .join('&')
    );
  }

  private normalizeAy(ay: any): string {
    const s = safeTrim(ay);
    return s ? s.replace(/\s*-\s*/g, '-') : '';
  }

  private buildCohortAy(startYear: number, duration: number): string {
    const s = Number(startYear),
      d = Number(duration);
    return Number.isFinite(s) && s > 0 && Number.isFinite(d) && d > 0
      ? `${s} - ${s + d}`
      : '';
  }

  private buildFirstAcademicYear(startYear: number): string {
    const s = Number(startYear);
    return Number.isFinite(s) && s > 0 ? `${s}-${s + 1}` : '';
  }

  private dateToEpochMs(dateStr: any): number {
    const s = safeTrim(dateStr);
    if (!s) return 0;
    const t = new Date(`${s}T00:00:00`).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  private epochMsToDateInput(ms: any): string {
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return '';
    const d = new Date(n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Convert "HH:MM" string → minutes from midnight */
  private timeStrToMin(t: string): number {
    const [h, m] = safeTrim(t).split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
  }

  /** Convert minutes from midnight → "HH:MM" */
  private minToTimeStr(min: number): string {
    const h = Math.floor(min / 60),
      m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private buildCourseStartYearOptions() {
    const now = new Date().getFullYear();
    const opts: any[] = [{ label: 'Select', value: '' }];
    for (let y = now - 2; y <= now + 6; y++)
      opts.push({ label: String(y), value: y });
    this.courseStartYearOptions = opts;
  }

  // ── data loaders ─────────────────────────────────────────────────────────────
  loadProgramsFull() {
    this.commonApi
      .fetchData({ entiId: this.entiId }, 'ims', 'program/list?list=full')
      .subscribe({
        next: (res: any) => {
          this.programsFull = res?.data || [];
          const opts = this.programsFull.map((p: any) => ({
            label: `${p?.programCodes || p?.code || '-'} - ${p?.programName || p?.name || '-'}`,
            value: safeTrim(p?.programId || p?._id),
          }));
          this.programOptions = [{ label: 'All', value: '' }, ...opts];
          this.programOptionsForEditor = [
            { label: 'Select', value: '' },
            ...opts,
          ];
        },
        error: () => {
          this.programsFull = [];
          this.programOptions = [{ label: 'All', value: '' }];
          this.programOptionsForEditor = [{ label: 'Select', value: '' }];
        },
      });
  }

  loadCentersFull() {
    this.commonApi
      .fetchData({ entiId: this.entiId }, 'ims', 'center/list?list=full')
      .subscribe({
        next: (res: any) => {
          this.centersFull = res?.data || [];
          const opts = this.centersFull.map((c: any) => ({
            label: `${c?.centerName || c?.name || '-'} (${c?.centerCode || c?.code || '-'})`,
            value: safeTrim(c?.centerId || c?._id),
          }));
          this.centerOptions = [{ label: 'All', value: '' }, ...opts];
          this.centerOptionsForEditor = [
            { label: 'Select', value: '' },
            ...opts,
          ];
        },
        error: () => {
          this.centersFull = [];
          this.centerOptions = [{ label: 'All', value: '' }];
          this.centerOptionsForEditor = [{ label: 'Select', value: '' }];
        },
      });
  }

  private loadAcademicYearConfigsForFilter() {
    this.commonApi
      .fetchData({ entiId: this.entiId }, 'ims', 'ayear/list?list=full')
      .subscribe({
        next: (res: any) => {
          const set = new Set<string>();
          for (const cfg of res?.data || []) {
            for (const y of Array.isArray(cfg?.years) ? cfg.years : []) {
              const ay = this.normalizeAy(y?.academicYear);
              if (ay) set.add(ay);
            }
          }
          this.filterAcademicYearOptions = [
            { label: 'All', value: '' },
            ...Array.from(set)
              .sort()
              .map((ay) => ({ label: ay, value: ay })),
          ];
        },
        error: () => {
          this.filterAcademicYearOptions = [{ label: 'All', value: '' }];
        },
      });
  }

  loadStaffFull() {
    this.commonApi
      .fetchData({ entiId: this.entiId }, 'ims', 'staff/list?list=full')
      .subscribe({
        next: (res: any) => {
          this.staffListFull = (res?.data || []).filter(
            (s: any) => safeTrim(s?.facultyType).toUpperCase() === 'TEACHING',
          );
          const opts = [
            { label: 'Select', value: '' },
            ...this.staffListFull.map((s: any) => ({
              label: `${s?.staffName || '-'} (${s?.staffCode || '-'})`,
              value: safeTrim(s?.staffId || s?._id),
            })),
          ];
          this.staffOptions = opts;
          this.staffOptionsAll = [...opts];
          this.staffOptionsFiltered = [...opts];
          // Also populate special class staff options
          this.specialClassStaffOptions = [...opts];
        },
        error: () => {
          this.staffListFull = [];
          this.staffOptions = [{ label: 'Select', value: '' }];
          this.staffOptionsAll = [{ label: 'Select', value: '' }];
          this.staffOptionsFiltered = [{ label: 'Select', value: '' }];
        },
      });
  }

  loadBatches(event?: { page: number; pageSize: number; search?: string }) {
    const page = event?.page || 1;
    const limit = event?.pageSize || 20;
    const f = this.filterForm?.value || {};
    const search = safeTrim(event?.search || f.search);
    const status = safeTrim(f.status);
    const academicYear = this.normalizeAy(f.academicYear);
    const programId = safeTrim(f.programId);
    const centerId = safeTrim(f.centerId);
    const qp = this.buildQueryParams({
      page,
      limit,
      ...(search ? { search } : {}),
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(academicYear ? { academicYear } : {}),
      ...(programId ? { programId } : {}),
      ...(centerId ? { centerId } : {}),
    });
    this.loading = true;
    this.commonApi
      .fetchData({ entiId: this.entiId }, this.moduleName, `list${qp}`)
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.totalRecords = Number(res?.count || 0);
          this.batchRows = (res?.data || []).map((b: any) => ({
            ...b,
            _raw: b,
          }));
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Failed to load batches');
        },
      });
  }

  // ── CREATE BATCH ─────────────────────────────────────────────────────────────
  openCreate() {
    this.isEditMode = false;
    this.editingBatchId = '';
    this.ayInfoDoc = null;
    this.editorForm.reset({
      batchName: '',
      batchCode: '',
      courseStartYear: '',
      cohortAy: '',
      academicYear: '',
      programId: '',
      programName: '',
      programCode: '',
      centerId: '',
      centerName: '',
      centerCode: '',
      startDate: '',
      endDate: '',
      status: 'ACTIVE',
      remarks: '',
    });
    // Re-enable all fields for create
    ['programId', 'centerId', 'courseStartYear'].forEach((f) =>
      this.editorForm.get(f)?.enable(),
    );
    this.showEditorModal = true;
  }

  closeEditorModal() {
    this.showEditorModal = false;
  }

  // ── EDIT BATCH ───────────────────────────────────────────────────────────────
  // ✅ FIX: set isEditMode=true, store batchId, prevent AY overwrite
  openEdit(row: any) {
    const b = row?._raw || row;
    this.isEditMode = true;
    this.editingBatchId = safeTrim(b?.batchId);
    this.ayInfoDoc = null;

    this.editorForm.patchValue({
      batchName: b.batchName,
      batchCode: b.batchCode,
      courseStartYear: Number(String(b.academicYear || '').split('-')[0]) || '',
      cohortAy: b.cohortAy || '',
      academicYear: b.academicYear || '',
      programId: b.programId,
      programName: b.programName || '',
      programCode: b.programCode || '',
      centerId: b.centerId,
      centerName: b.centerName || '',
      centerCode: b.centerCode || '',
      remarks: b.remarks || '',
      startDate: this.epochMsToDateInput(b.startDate),
      endDate: this.epochMsToDateInput(b.endDate),
      status: b.status,
    });

    // Disable core fields if students assigned (backend also enforces this)
    const hasStudents = (b.studentCount || 0) > 0;
    ['programId', 'centerId', 'courseStartYear'].forEach((f) => {
      hasStudents
        ? this.editorForm.get(f)?.disable()
        : this.editorForm.get(f)?.enable();
    });

    this.showEditorModal = true;
  }

  private onProgramChanged(programId: any) {
    const p = this.programsFull.find(
      (x: any) => safeTrim(x?.programId || x?._id) === safeTrim(programId),
    );
    this.editorForm.patchValue(
      {
        programName: safeTrim(p?.programName || p?.name || ''),
        programCode: safeTrim(p?.programCode || p?.code || ''),
      },
      { emitEvent: false },
    );
  }

  private onCenterChanged(centerId: any) {
    const c = this.centersFull.find(
      (x: any) => safeTrim(x?.centerId || x?._id) === safeTrim(centerId),
    );
    this.editorForm.patchValue(
      {
        centerName: safeTrim(c?.centerName || c?.name || ''),
        centerCode: safeTrim(c?.centerCode || c?.code || ''),
      },
      { emitEvent: false },
    );
  }

  private getProgramDuration(programId: string): number {
    const p = this.programsFull.find(
      (x: any) => safeTrim(x?.programId || x?._id) === safeTrim(programId),
    );
    const d = Number(p?.duration) || 1;
    return Number.isFinite(d) && d > 0 ? d : 0;
  }

  private onCreateInputsChanged() {
    if (!this.showEditorModal || this.isEditMode) return;
    const v = this.editorForm.getRawValue() || {};
    const programId = safeTrim(v.programId);
    const startYear = Number(v.courseStartYear);
    if (!programId || !Number.isFinite(startYear) || startYear <= 0) {
      this.ayInfoDoc = null;
      this.editorForm.patchValue(
        { cohortAy: '', academicYear: '', startDate: '', endDate: '' },
        { emitEvent: false },
      );
      return;
    }
    const duration = this.getProgramDuration(programId);
    if (!duration) {
      this.ayInfoDoc = null;
      this.editorForm.patchValue(
        { cohortAy: '', academicYear: '', startDate: '', endDate: '' },
        { emitEvent: false },
      );
      this.alert.error(
        'Program duration not found. Please update Program master.',
      );
      return;
    }
    const cohortAy = this.buildCohortAy(startYear, duration);
    const firstAy = this.normalizeAy(this.buildFirstAcademicYear(startYear));
    this.editorForm.patchValue(
      { cohortAy, academicYear: firstAy },
      { emitEvent: false },
    );
    this.fetchAyInfoAndApply(programId, startYear, cohortAy, firstAy);
  }

  private fetchAyInfoAndApply(
    programId: string,
    courseStartYear: number,
    cohortAy: string,
    firstAy: string,
  ) {
    const cur = this.ayInfoDoc;
    if (
      cur &&
      safeTrim(cur?.programId) === safeTrim(programId) &&
      safeTrim(cur?.cohortAy) === safeTrim(cohortAy)
    ) {
      this.applyAyInfoToEditor(cur, courseStartYear, firstAy);
      return;
    }
    this.loading = true;
    this.commonApi
      .fetchData(
        { entiId: this.entiId, programId, courseStartYear, cohortAy },
        this.moduleName,
        this.ayInfoEndpoint,
      )
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          const doc = res?.data || null;
          if (!doc) {
            this.ayInfoDoc = null;
            this.alert.error('AY config not found for this Program/Cohort');
            return;
          }
          this.ayInfoDoc = doc;
          this.applyAyInfoToEditor(doc, courseStartYear, firstAy);
        },
        error: (err: any) => {
          this.loading = false;
          this.ayInfoDoc = null;
          this.alert.error(err?.error?.message || 'Failed to load AY config');
        },
      });
  }

  private applyAyInfoToEditor(doc: any, _: number, firstAy: string) {
    const yearsArr = Array.isArray(doc?.years) ? doc.years : [];
    const yr =
      yearsArr.find(
        (y: any) =>
          this.normalizeAy(y?.academicYear) === this.normalizeAy(firstAy),
      ) ||
      yearsArr[0] ||
      null;
    const patch: any = {};
    if (yr?.startOn && Number(yr.startOn) > 0)
      patch.startDate = this.epochMsToDateInput(yr.startOn);
    if (yr?.endOn && Number(yr.endOn) > 0)
      patch.endDate = this.epochMsToDateInput(yr.endOn);
    if (Object.keys(patch).length)
      this.editorForm.patchValue(patch, { emitEvent: false });
  }

  // ── SAVE BATCH (create OR update) ────────────────────────────────────────────
  // ✅ FIX: routes to create or update depending on isEditMode
  saveBatch() {
    if (this.loading) return;
    if (!this.isEditMode) this.onCreateInputsChanged();
    if (this.editorForm.invalid) {
      this.editorForm.markAllAsTouched();
      this.alert.error('Please fill all required fields');
      return;
    }

    const v = this.editorForm.getRawValue() || {};
    const programId = safeTrim(v.programId);
    const centerId = safeTrim(v.centerId);

    if (this.isEditMode) {
      // ── UPDATE ──
      const startMs = this.dateToEpochMs(v.startDate);
      const endMs = this.dateToEpochMs(v.endDate);
      if (!startMs) {
        this.alert.error('Start Date is required');
        return;
      }
      if (!endMs) {
        this.alert.error('End Date is required');
        return;
      }
      if (startMs >= endMs) {
        this.alert.error('End Date must be after Start Date');
        return;
      }

      const payload: any = {
        entiId: this.entiId,
        batchId: this.editingBatchId,
        batchName: safeTrim(v.batchName),
        batchCode: safeTrim(v.batchCode),
        programId,
        programName: safeTrim(v.programName) || null,
        programCode: safeTrim(v.programCode) || null,
        centerId,
        centerName: safeTrim(v.centerName) || null,
        centerCode: safeTrim(v.centerCode) || null,
        startDate: startMs,
        endDate: endMs,
        status: safeTrim(v.status) || 'ACTIVE',
        remarks: safeTrim(v.remarks) || null,
      };
      this.loading = true;
      this.commonApi.fetchData(payload, this.moduleName, 'update').subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Batch updated');
          this.closeEditorModal();
          this.refresh();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Update failed');
        },
      });
    } else {
      // ── CREATE ──
      const courseStartYear = Number(v.courseStartYear);
      if (
        !programId ||
        !centerId ||
        !Number.isFinite(courseStartYear) ||
        courseStartYear <= 0
      ) {
        this.alert.error('Program, Center and Course Start Year are required');
        return;
      }
      const cohortAy = safeTrim(v.cohortAy);
      const academicYear = this.normalizeAy(v.academicYear);
      const programStartAy = this.normalizeAy(
        this.buildFirstAcademicYear(courseStartYear),
      );
      if (!cohortAy || !academicYear || !programStartAy) {
        this.alert.error(
          'Cohort / Academic Year not computed. Check AY config.',
        );
        return;
      }
      const startMs = this.dateToEpochMs(v.startDate);
      const endMs = this.dateToEpochMs(v.endDate);
      if (!startMs) {
        this.alert.error('Start Date is required');
        return;
      }
      if (!endMs) {
        this.alert.error('End Date is required');
        return;
      }
      if (startMs >= endMs) {
        this.alert.error('End Date must be after Start Date');
        return;
      }

      const payload: any = {
        entiId: this.entiId,
        batchName: safeTrim(v.batchName),
        batchCode: safeTrim(v.batchCode),
        programId,
        programName: safeTrim(v.programName) || null,
        programCode: safeTrim(v.programCode) || null,
        centerId,
        centerName: safeTrim(v.centerName) || null,
        centerCode: safeTrim(v.centerCode) || null,
        cohortAy,
        programStartAy,
        academicYear,
        startDate: startMs,
        endDate: endMs,
        duration: Number(this.ayInfoDoc?.duration || 0) || null,
        status: safeTrim(v.status) || 'ACTIVE',
        remarks: safeTrim(v.remarks) || null,
      };
      this.loading = true;
      this.commonApi.fetchData(payload, this.moduleName, 'create').subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Batch created successfully');
          this.closeEditorModal();
          this.refresh();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Create failed');
        },
      });
    }
  }

  // ── ASSIGN STUDENTS ──────────────────────────────────────────────────────────
  openAssignStudents(row: any) {
    const b = row?._raw || row;
    if (!safeTrim(b?.batchId)) return;
    this.activeBatch = b;
    this.showAssignModal = true;
    this.selectedStudentIds.clear();
    this.eligibleSearch = '';
    this.eligibleStudents = [];
    this.eligibleStudentsFiltered = [];
    this.loadEligibleStudents();
  }

  closeAssignModal() {
    this.showAssignModal = false;
    this.activeBatch = null;
    this.eligibleStudents = [];
    this.eligibleStudentsFiltered = [];
    this.eligibleSearch = '';
    this.selectedStudentIds.clear();
  }

  loadEligibleStudents() {
    const batchId = safeTrim(this.activeBatch?.batchId);
    if (!batchId) return;
    this.loading = true;
    this.commonApi
      .fetchData({ entiId: this.entiId, batchId }, 'batch', 'students/eligible')
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.eligibleStudents = res?.data || [];
          this.applyEligibleFilter(true);
        },
        error: () => {
          this.loading = false;
          this.eligibleStudents = [];
          this.eligibleStudentsFiltered = [];
        },
      });
  }

  applyEligibleFilter(_silent?: boolean) {
    const q = safeTrim(this.eligibleSearch).toLowerCase();
    this.eligibleStudentsFiltered = q
      ? this.eligibleStudents.filter(
          (s: any) =>
            safeTrim(s?.student?.name).toLowerCase().includes(q) ||
            safeTrim(s?.student?.phone).toLowerCase().includes(q) ||
            safeTrim(s?.admissionNo).toLowerCase().includes(q),
        )
      : [...this.eligibleStudents];
  }

  resetEligibleFilter() {
    this.eligibleSearch = '';
    this.applyEligibleFilter(true);
  }

  toggleStudent(id: any, checked: boolean) {
    if (this.loading) return;
    const sid = safeTrim(id);
    if (!sid) return;
    checked
      ? this.selectedStudentIds.add(sid)
      : this.selectedStudentIds.delete(sid);
  }

  assignStudents() {
    if (!this.selectedStudentIds.size) {
      this.alert.error('Select at least one student');
      return;
    }
    const batchId = safeTrim(this.activeBatch?.batchId);
    if (!batchId) return;
    this.loading = true;
    this.commonApi
      .fetchData(
        {
          entiId: this.entiId,
          batchId,
          studentIds: Array.from(this.selectedStudentIds),
        },
        'batch',
        'students/assign',
      )
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Students assigned');
          this.closeAssignModal();
          this.refresh();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Assign failed');
        },
      });
  }

  // ── STAFF MAP ────────────────────────────────────────────────────────────────
  openStaffMap(row: any) {
    const b = row?._raw || row;
    const batchId = safeTrim(b?.batchId);
    if (!batchId) return;
    this.activeBatchForStaff = b;
    this.showStaffModal = true;
    this.staffOptionsAll = [
      ...(this.staffOptions || [{ label: 'Select', value: '' }]),
    ];
    this.staffOptionsFiltered = [...this.staffOptionsAll];
    this.staffMapRows = Array.isArray(b?.staffMap)
      ? b.staffMap.map((x: any) => ({ ...x }))
      : [];
    this.staffDraft = { subjectId: '', staffId: '' };
    this.loadBatchSubjects(batchId);
  }

  closeStaffModal() {
    this.showStaffModal = false;
    this.activeBatchForStaff = null;
    this.batchSubjectOptions = [{ label: 'Select', value: '' }];
    this.staffDraft = { subjectId: '', staffId: '' };
    this.staffMapRows = [];
  }

  private loadBatchSubjects(batchId: string) {
    this.commonApi
      .fetchData({ entiId: this.entiId, batchId }, this.moduleName, 'subjects')
      .subscribe({
        next: (res: any) => {
          const arr = res?.data || [];
          this.batchSubjectOptions = [
            { label: 'Select', value: '' },
            ...arr.map((s: any) => ({
              label: `${s?.subjectName || '-'} (${s?.subjectCode || '-'})`,
              value: safeTrim(s?.subjectId || s?._id),
            })),
          ];
          // Also update special class subject options with the same list
          this.specialClassSubjectOptions = [...this.batchSubjectOptions];
        },
        error: () => {
          this.batchSubjectOptions = [{ label: 'Select', value: '' }];
        },
      });
  }

  addStaffMapRow() {
    const subjId = safeTrim(this.staffDraft.subjectId);
    const staffId = safeTrim(this.staffDraft.staffId);
    if (!subjId || !staffId) {
      this.alert.error('Select subject and staff');
      return;
    }
    if (this.staffMapRows.some((r: any) => safeTrim(r?.subjectId) === subjId)) {
      this.alert.error('This subject is already mapped. Remove and re-add.');
      return;
    }
    const subjOpt = this.batchSubjectOptions.find(
      (x: any) => safeTrim(x?.value) === subjId,
    );
    const staffOpt = this.staffOptions.find(
      (x: any) => safeTrim(x?.value) === staffId,
    );
    this.staffMapRows.push({
      subjectId: subjId,
      subjectName: subjOpt?.label || null,
      staffId: staffId,
      staffName: staffOpt?.label || null,
    });
    this.staffDraft = { subjectId: '', staffId: '' };
  }

  removeStaffMapRow(i: number) {
    if (i >= 0 && i < this.staffMapRows.length) this.staffMapRows.splice(i, 1);
  }

  saveStaffMap() {
    if (this.loading) return;
    const batchId = safeTrim(this.activeBatchForStaff?.batchId);
    if (!batchId) return;
    const payload = {
      entiId: this.entiId,
      batchId,
      staffMap: this.staffMapRows.map((x: any) => ({
        subjectId: safeTrim(x?.subjectId),
        subjectName: safeTrim(x?.subjectName) || null,
        staffId: safeTrim(x?.staffId),
        staffName: safeTrim(x?.staffName) || null,
      })),
    };
    this.loading = true;
    this.commonApi.fetchData(payload, this.moduleName, 'staff/save').subscribe({
      next: () => {
        this.loading = false;
        this.alert.success('Staff mapping saved');
        this.closeStaffModal();
        this.refresh();
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Save failed');
      },
    });
  }

  // ✅ FIX: filter staff by subject correctly using staffId string comparison
  onStaffDraftSubjectChanged(subjectId: any) {
    const sid = safeTrim(subjectId);
    // Show all TEACHING staff when no subject selected; otherwise filter by subject
    const filtered = sid
      ? this.staffListFull.filter((st: any) => safeTrim(st?.subject) === sid)
      : this.staffListFull;
    this.staffOptionsFiltered = [
      { label: 'Select', value: '' },
      ...filtered.map((s: any) => ({
        label: `${s?.staffName || '-'} (${s?.staffCode || '-'})`,
        value: safeTrim(s?.staffId || s?._id),
      })),
    ];
    // Clear staff selection if current selection no longer valid
    if (this.staffDraft?.staffId) {
      const ok = this.staffOptionsFiltered.some(
        (o: any) => safeTrim(o?.value) === safeTrim(this.staffDraft.staffId),
      );
      if (!ok) this.staffDraft.staffId = '';
    }
  }

  // ── PROMOTE BATCH ─────────────────────────────────────────────────────────────
  // openPromote(row: any) {
  //   const b = row?._raw || row;
  //   if (safeTrim(b?.status) !== 'ACTIVE') {
  //     this.alert.error('Only ACTIVE batches can be promoted.');
  //     return;
  //   }
  //   this.promoteBatch = b;
  //   this.showPromoteModal = true;
  // }

  openPromote(row: any) {
    const b = row?._raw || row;
    if (safeTrim(b?.status) !== 'ACTIVE') {
      this.alert.error('Only ACTIVE batches can be promoted.');
      return;
    }
    this.promoteBatch = b;
    this.promoteNewProgramId = '';
    this.promoteResult = null;

    // Build program options — exclude current program
    this.promoteProgramOptions = [
      { label: '— Keep current program —', value: '' },
      ...this.programsFull
        .filter((p: any) => safeTrim(p?.programId) !== safeTrim(b?.programId))
        .map((p: any) => ({
          label: `${safeTrim(p?.programCodes || p?.programCode || '')} - ${safeTrim(p?.programName || '')}`,
          value: safeTrim(p?.programId),
        })),
    ];

    this.showPromoteModal = true;
  }

  // closePromoteModal() { this.showPromoteModal = false; this.promoteBatch = null; }
  closePromoteModal() {
    this.showPromoteModal = false;
    this.promoteBatch = null;
    this.promoteNewProgramId = '';
    this.promoteResult = null;
  }

  // confirmPromote() {
  //   if (this.loading || !this.promoteBatch) return;
  //   const payload = { entiId: this.entiId, batchId: this.promoteBatch.batchId };
  //   this.loading = true;
  //   this.commonApi.fetchData(payload, this.moduleName, 'promote').subscribe({
  //     next: (res: any) => {
  //       this.loading = false;
  //       this.alert.success(res?.message || 'Batch promoted successfully');
  //       this.closePromoteModal();
  //       this.refresh();
  //     },
  //     error: (err: any) => { this.loading = false; this.alert.error(err?.error?.message || 'Promote failed'); },
  //   });
  // }

  confirmPromote() {
    if (this.loading || !this.promoteBatch) return;

    const payload: any = {
      entiId: this.entiId,
      batchId: this.promoteBatch.batchId,
    };
    if (this.promoteNewProgramId) {
      payload.newProgramId = this.promoteNewProgramId;
    }

    this.loading = true;
    this.commonApi.fetchData(payload, this.moduleName, 'promote').subscribe({
      next: (res: any) => {
        this.loading = false;
        this.promoteResult = res?.data || null;
        this.alert.success(res?.message || 'Batch promoted successfully');
        this.refresh();
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Promote failed');
      },
    });
  }
  
  // ── LATE ENTRY ────────────────────────────────────────────────────────────────
  openLateEntry(row: any) {
    const b = row?._raw || row;
    this.lateEntryBatch = b;
    this.lateForm.reset({
      type: 'STAFF',
      personId: '',
      timetableId: '',
      periodNo: 1,
      scheduledStartMin: 0,
      delayMinutes: 0,
      reason: '',
    });
    this.batchStudents = [];
    this.showLateModal = true;
    // Preload timetable for this batch (latest active)
    this.loadLatestTimetableForBatch(b.batchCode);
  }

  closeLateModal() {
    this.showLateModal = false;
    this.lateEntryBatch = null;
    this.batchStudents = [];
  }

  private loadLatestTimetableForBatch(batchCode: string) {
    if (!batchCode) return;
    this.commonApi
      .fetchData(
        { entiId: this.entiId, batchCode, status: 'Active' },
        'timetable',
        'list-by-batch',
      )
      .subscribe({
        next: (res: any) => {
          const rows = res?.data || [];
          if (rows.length) {
            // pick most recent active
            const latest = rows[0];
            this.lateForm.patchValue(
              { timetableId: safeTrim(latest?._id) },
              { emitEvent: false },
            );
          }
        },
        error: () => {},
      });
  }

  onLateTypeChanged() {
    const type = safeTrim(this.lateForm.get('type')?.value).toUpperCase();
    this.lateForm.patchValue({ personId: '' }, { emitEvent: false });
    if (type === 'STUDENT') {
      this.loadBatchStudentsForLate();
    } else {
      this.batchStudents = [];
    }
  }

  private loadBatchStudentsForLate() {
    const batchId = safeTrim(this.lateEntryBatch?.batchId);
    if (!batchId) return;
    this.batchStudentsLoading = true;
    this.commonApi
      .fetchData(
        { entiId: this.entiId, batchId, includeStudents: true },
        this.moduleName,
        'view',
      )
      .subscribe({
        next: (res: any) => {
          this.batchStudentsLoading = false;
          this.batchStudents = res?.data?.students || [];
        },
        error: () => {
          this.batchStudentsLoading = false;
          this.batchStudents = [];
        },
      });
  }

  // Computed options for person dropdown depending on type
  get latePersonOptions(): any[] {
    const type = safeTrim(this.lateForm.get('type')?.value).toUpperCase();
    if (type === 'STUDENT') {
      return [
        { label: 'Select Student', value: '' },
        ...this.batchStudents.map((s: any) => ({
          label: `${safeTrim(s?.student?.name || '-')} (${safeTrim(s?.admissionNo || '-')})`,
          value: safeTrim(s?.studentId),
        })),
      ];
    }
    return this.staffOptionsAll; // STAFF — reuse loaded staff list
  }

  submitLateEntry() {
    if (this.loading) return;
    if (this.lateForm.invalid) {
      this.lateForm.markAllAsTouched();
      this.alert.error('Please fill all required fields');
      return;
    }
    const v = this.lateForm.value;
    const type = safeTrim(v.type).toUpperCase();
    const personId = safeTrim(v.personId);
    // Resolve person name
    let personName = '';
    if (type === 'STAFF') {
      const s = this.staffListFull.find(
        (x: any) => safeTrim(x?.staffId || x?._id) === personId,
      );
      personName = safeTrim(s?.staffName || '');
    } else {
      const s = this.batchStudents.find(
        (x: any) => safeTrim(x?.studentId) === personId,
      );
      personName = safeTrim(s?.student?.name || '');
    }
    const payload = {
      entiId: this.entiId,
      type,
      personId,
      personName,
      timetableId: safeTrim(v.timetableId),
      batchCode: safeTrim(this.lateEntryBatch?.batchCode),
      date: Date.now(), // today — or make it a date picker field
      periodNo: Number(v.periodNo),
      scheduledStartMin: Number(v.scheduledStartMin),
      delayMinutes: Number(v.delayMinutes),
      reason: safeTrim(v.reason) || null,
    };
    this.loading = true;
    this.commonApi.fetchData(payload, 'timetable', 'late-entry/log').subscribe({
      next: (res: any) => {
        this.loading = false;
        this.alert.success(res?.message || 'Late entry logged');
        this.closeLateModal();
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Failed to log late entry');
      },
    });
  }

  // ── SPECIAL CLASS ─────────────────────────────────────────────────────────────
  openSpecialClass(row: any) {
    const b = row?._raw || row;
    this.specialClassBatch = b;
    this.specialClassForm.reset({
      date: '',
      periodNo: 1,
      startTime: '',
      endTime: '',
      subjectId: '',
      staffId: '',
      periodType: 'LECTURE',
      mode: 'OFFLINE',
      topic: '',
      venue: '',
      zoomUrl: '',
    });
    this.showSpecialClassModal = true;
    // Load subjects for this batch
    if (b?.batchId) this.loadBatchSubjects(safeTrim(b.batchId));
    // Staff already loaded in loadStaffFull()
    this.specialClassStaffOptions = [
      ...(this.staffOptionsAll?.length
        ? this.staffOptionsAll
        : [{ label: 'Select', value: '' }]),
    ];
  }

  closeSpecialClassModal() {
    this.showSpecialClassModal = false;
    this.specialClassBatch = null;
  }

  onSpecialClassModeChange() {
    const mode = safeTrim(this.specialClassForm.get('mode')?.value);
    if (mode !== 'ONLINE') {
      this.specialClassForm.patchValue({ zoomUrl: '' }, { emitEvent: false });
    }
  }

  submitSpecialClass() {
    if (this.loading) return;
    if (this.specialClassForm.invalid) {
      this.specialClassForm.markAllAsTouched();
      this.alert.error('Please fill all required fields');
      return;
    }

    const v = this.specialClassForm.value;
    const dateMs = this.dateToEpochMs(v.date);
    const startMin = this.timeStrToMin(v.startTime);
    const endMin = this.timeStrToMin(v.endTime);

    if (!dateMs) {
      this.alert.error('Date is required');
      return;
    }
    if (endMin <= startMin) {
      this.alert.error('End time must be after start time');
      return;
    }

    const subjectOpt = this.specialClassSubjectOptions.find(
      (x: any) => safeTrim(x?.value) === safeTrim(v.subjectId),
    );
    const staffOpt = this.specialClassStaffOptions.find(
      (x: any) => safeTrim(x?.value) === safeTrim(v.staffId),
    );

    // We use timetable/period/add endpoint to add a special period to the batch timetable
    const payload = {
      entiId: this.entiId,
      batchCode: safeTrim(this.specialClassBatch?.batchCode),
      date: dateMs,
      day: this.getDayName(dateMs),
      period: {
        periodNo: Number(v.periodNo),
        periodType: safeTrim(v.periodType),
        mode: safeTrim(v.mode),
        time: {
          startMin,
          endMin,
          startLabel: v.startTime,
          endLabel: v.endTime,
        },
        facultyId: safeTrim(v.staffId),
        facultyName: staffOpt?.label || null,
        subjectId: safeTrim(v.subjectId),
        subjectName: subjectOpt?.label || null,
        topic: safeTrim(v.topic) || null,
        venue: safeTrim(v.venue) || null,
        zoomUrl: safeTrim(v.zoomUrl) || null,
      },
    };

    // First get the timetableId for this batch/date, then add period
    this.loading = true;
    this.commonApi
      .fetchData(
        { entiId: this.entiId, batchCode: this.specialClassBatch?.batchCode },
        'timetable',
        'list-by-batch',
      )
      .subscribe({
        next: (res: any) => {
          const rows = res?.data || [];
          const wkDate = this.getPreviousMonday(dateMs);
          const tt = rows.find(
            (t: any) =>
              Number(t?.wkStartOn) === wkDate && t?.status === 'Active',
          );
          if (!tt) {
            this.loading = false;
            this.alert.error(
              'No active timetable found for this batch on the selected date. Publish a timetable first.',
            );
            return;
          }
          const addPayload = { ...payload, timetableId: safeTrim(tt._id) };
          this.commonApi
            .fetchData(addPayload, 'timetable', 'period/add')
            .subscribe({
              next: (r: any) => {
                this.loading = false;
                this.alert.success(
                  r?.message || 'Special class added successfully',
                );
                this.closeSpecialClassModal();
              },
              error: (err: any) => {
                this.loading = false;
                this.alert.error(
                  err?.error?.message || 'Failed to add special class',
                );
              },
            });
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Failed to load timetable');
        },
      });
  }

  private getDayName(epochMs: number): string {
    const days = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];
    return days[new Date(epochMs).getDay()];
  }

  private getPreviousMonday(epochMs: number): number {
    const d = new Date(epochMs);
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  }

  // ── VIEW ──────────────────────────────────────────────────────────────────────
  openView(row: any) {
    const b = row?._raw || row;
    this.router.navigate(['/app/batches/view', b?.batchId]);
  }
}
