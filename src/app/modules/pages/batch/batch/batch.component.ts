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
  filterForm!: FormGroup;
  totalRecords = 0;
  batchRows: any[] = [];
  editorForm!: FormGroup;
  showEditorModal = false;
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
  columns = [
    { key: 'batchName', label: 'Batch Name', sortable: true },
    { key: 'batchCode', label: 'Batch Code', sortable: true },
    { key: 'academicYear', label: 'AY', sortable: true },
    { key: 'programName', label: 'Program', sortable: false },
    { key: 'centerName', label: 'Center', sortable: false },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
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
      callback: (row: any) => this.openView(row),
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit Batch',
      callback: (row: any) => this.openEdit(row),
    },
    {
      type: 'icon',
      icon: 'fa-solid fa-user-plus',
      tooltip: 'Assign Students',
      callback: (row: any) => this.openAssignStudents(row),
    },
    {
      type: 'icon',
      icon: 'fa-solid fa-users-gear',
      tooltip: 'Assign Staff',
      callback: (row: any) => this.openStaffMap(row),
    },
  ];
  showAssignPanel = false;
  activeBatch: any = null;
  eligibleStudents: any[] = [];
  selectedStudentIds = new Set<string>();
  showStaffModal = false;
  activeBatchForStaff: any | null = null;
  staffOptions: any[] = [{ label: 'Select', value: '' }];
  staffListFull: any[] = [];
  batchSubjectOptions: any[] = [{ label: 'Select', value: '' }];
  staffDraft: any = { subjectId: '', staffId: '' };
  staffMapRows: any[] = [];
  showAssignModal = false;
  eligibleStudentsFiltered: any[] = [];
  eligibleSearch = '';
  staffOptionsAll: any[] = [{ label: 'Select', value: '' }];
  staffOptionsFiltered: any[] = [{ label: 'Select', value: '' }];

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
    this.editorForm.get('courseStartYear')?.valueChanges.subscribe(() => {
      this.onCreateInputsChanged();
    });
    this.editorForm.get('programId')?.valueChanges.subscribe((v: any) => {
      this.onProgramChanged(v);
      this.onCreateInputsChanged();
    });
    this.editorForm.get('centerId')?.valueChanges.subscribe((v: any) => {
      this.onCenterChanged(v);
    });
  }

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

  private buildQueryParams(params: Record<string, any>) {
    const keys = Object.keys(params || {}).filter(
      (k) => params[k] !== undefined && params[k] !== null && params[k] !== '',
    );
    if (!keys.length) return '';
    const qs = keys
      .map(
        (k) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`,
      )
      .join('&');
    return `?${qs}`;
  }

  private normalizeAy(ay: any): string {
    const s = safeTrim(ay);
    if (!s) return '';
    return s.replace(/\s*-\s*/g, '-');
  }

  private buildCohortAy(startYear: number, duration: number): string {
    const s = Number(startYear);
    const d = Number(duration);
    if (!Number.isFinite(s) || s <= 0 || !Number.isFinite(d) || d <= 0)
      return '';
    return `${s} - ${s + d}`;
  }

  private buildFirstAcademicYear(startYear: number): string {
    const s = Number(startYear);
    if (!Number.isFinite(s) || s <= 0) return '';
    return `${s}-${s + 1}`;
  }

  private dateToEpochMs(dateStr: any): number {
    const s = safeTrim(dateStr);
    if (!s) return 0;
    const d = new Date(`${s}T00:00:00`);
    const t = d.getTime();
    return Number.isFinite(t) ? t : 0;
  }

  private epochMsToDateInput(ms: any): string {
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return '';
    const d = new Date(n);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private buildCourseStartYearOptions() {
    const now = new Date().getFullYear();
    const start = now - 2;
    const end = now + 6;
    const opts: any[] = [{ label: 'Select', value: '' }];
    for (let y = start; y <= end; y++)
      opts.push({ label: String(y), value: y });
    this.courseStartYearOptions = opts;
  }

  loadProgramsFull() {
    const payload = { entiId: this.entiId };
    this.commonApi
      .fetchData(payload, 'ims', 'program/list?list=full')
      .subscribe({
        next: (res: any) => {
          this.programsFull = res?.data || [];
          const opts = (this.programsFull || []).map((p: any) => ({
            label: `${p?.programCodes || p?.code || '-'} - ${p?.programName || p?.name || '-'} `,
            value: safeTrim(p?.programId || p?._id),
          }));
          this.programOptions = opts;
          this.programOptionsForEditor = opts;
        },
        error: () => {
          this.programsFull = [];
          this.programOptions = [{ label: 'All', value: '' }];
          this.programOptionsForEditor = [{ label: 'Select', value: '' }];
        },
      });
  }

  loadCentersFull() {
    const payload = { entiId: this.entiId };
    this.commonApi
      .fetchData(payload, 'ims', 'center/list?list=full')
      .subscribe({
        next: (res: any) => {
          this.centersFull = res?.data || [];
          const opts = (this.centersFull || []).map((c: any) => ({
            label: `${c?.centerName || c?.name || '-'} (${c?.centerCode || c?.code || '-'})`,
            value: safeTrim(c?.centerId || c?._id),
          }));
          this.centerOptions = [{ label: 'All', value: '' }].concat(opts);
          this.centerOptionsForEditor = [{ label: 'Select', value: '' }].concat(
            opts,
          );
        },
        error: () => {
          this.centersFull = [];
          this.centerOptions = [{ label: 'All', value: '' }];
          this.centerOptionsForEditor = [{ label: 'Select', value: '' }];
        },
      });
  }

  private loadAcademicYearConfigsForFilter() {
    const payload = { entiId: this.entiId };
    this.commonApi.fetchData(payload, 'ims', 'ayear/list?list=full').subscribe({
      next: (res: any) => {
        const configs = res?.data || [];
        const set = new Set<string>();
        for (const cfg of configs) {
          const yearsArr = Array.isArray(cfg?.years) ? cfg.years : [];
          for (const y of yearsArr) {
            const ay = this.normalizeAy(y?.academicYear);
            if (ay) set.add(ay);
          }
        }
        const list = Array.from(set).sort((a, b) => a.localeCompare(b));
        this.filterAcademicYearOptions = [{ label: 'All', value: '' }].concat(
          list.map((ay) => ({ label: ay, value: ay })),
        );
      },
      error: () => {
        this.filterAcademicYearOptions = [{ label: 'All', value: '' }];
      },
    });
  }

  loadBatches(event?: {
    page: number;
    pageSize: number;
    search?: string;
    sortKey?: string;
    sortDirection?: 'asc' | 'desc';
  }) {
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
    const payload = { entiId: this.entiId };
    this.loading = true;
    this.commonApi.fetchData(payload, this.moduleName, `list${qp}`).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.totalRecords = Number(res?.count || 0);
        this.batchRows = (res?.data || []).map((b: any) => ({ ...b, _raw: b }));
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Failed to load batches');
      },
    });
  }

  openCreate() {
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
    this.showEditorModal = true;
  }

  closeEditorModal() {
    this.showEditorModal = false;
  }

  private onProgramChanged(programId: any) {
    const pid = safeTrim(programId);
    const p = (this.programsFull || []).find(
      (x: any) => safeTrim(x?.programId || x?._id) === pid,
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
    const cid = safeTrim(centerId);
    const c = (this.centersFull || []).find(
      (x: any) => safeTrim(x?.centerId || x?._id) === cid,
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
    const pid = safeTrim(programId);
    if (!pid) return 0;
    const p = (this.programsFull || []).find(
      (x: any) => safeTrim(x?.programId || x?._id) === pid,
    );
    const d = Number(p?.duration) || 1;
    return Number.isFinite(d) && d > 0 ? d : 0;
  }

  private onCreateInputsChanged() {
    if (!this.showEditorModal) return;
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
    const cur = this.ayInfoDoc || null;
    const curPid = safeTrim(cur?.programId);
    const curCohort = safeTrim(cur?.cohortAy);
    if (
      cur &&
      curPid === safeTrim(programId) &&
      curCohort === safeTrim(cohortAy)
    ) {
      this.applyAyInfoToEditor(cur, courseStartYear, firstAy);
      return;
    }
    const payload: any = {
      entiId: this.entiId,
      programId,
      courseStartYear,
      cohortAy,
    };

    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, this.ayInfoEndpoint)
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          const doc = res?.data || null;
          if (!doc) {
            this.ayInfoDoc = null;
            this.alert.error(
              'Academic Year config not found for this Program/Cohort',
            );
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

  private applyAyInfoToEditor(
    doc: any,
    _courseStartYear: number,
    firstAy: string,
  ) {
    const yearsArr = Array.isArray(doc?.years) ? doc.years : [];
    const yr =
      yearsArr.find(
        (y: any) =>
          this.normalizeAy(y?.academicYear) === this.normalizeAy(firstAy),
      ) ||
      yearsArr[0] ||
      null;

    const startOn = yr?.startOn ?? null;
    const endOn = yr?.endOn ?? null;
    const patch: any = {};
    if (startOn && Number(startOn) > 0)
      patch.startDate = this.epochMsToDateInput(startOn);
    if (endOn && Number(endOn) > 0)
      patch.endDate = this.epochMsToDateInput(endOn);
    if (Object.keys(patch).length) {
      this.editorForm.patchValue(patch, { emitEvent: false });
    }
  }

  saveBatch() {
    if (this.loading) return;
    this.onCreateInputsChanged();
    if (this.editorForm.invalid) {
      this.editorForm.markAllAsTouched();
      this.alert.error('Please fill all required fields');
      return;
    }
    const v = this.editorForm.getRawValue() || {};
    const programId = safeTrim(v.programId);
    const centerId = safeTrim(v.centerId);
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
      this.alert.error('Cohort / Academic Year not computed. Check AY config.');
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
    const duration = Number(this.ayInfoDoc?.duration || 0) || null;
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
      duration,
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

  openEdit(row: any) {
    const b = row?._raw || row;
    this.editorForm.patchValue({
      batchName: b.batchName,
      batchCode: b.batchCode,
      courseStartYear: Number(b.academicYear?.split('-')?.[0]),
      cohortAy: b.cohortAy,
      academicYear: b.academicYear,
      programId: b.programId,
      programName: b.programName,
      programCode: b.programCode,
      centerId: b.centerId,
      centerName: b.centerName,
      centerCode: b.centerCode,
      remarks: b.remarks || '',
      startDate: this.epochMsToDateInput(b.startDate),
      endDate: this.epochMsToDateInput(b.endDate),
      status: b.status,
    });
    if ((b.studentCount || 0) > 0) {
      this.editorForm.get('programId')?.disable();
      this.editorForm.get('centerId')?.disable();
      this.editorForm.get('courseStartYear')?.disable();
    } else {
      this.editorForm.get('programId')?.enable();
      this.editorForm.get('centerId')?.enable();
      this.editorForm.get('courseStartYear')?.enable();
    }
    this.showEditorModal = true;
  }

  openAssignStaff(row: any) {
    const b = row?._raw || row;
    this.alert.success(`Staff mapping for "${b.batchName}" – next step`);
  }

  openAssignStudents(row: any) {
    const b = row?._raw || row;
    const batchId = safeTrim(b?.batchId);
    if (!batchId) return;
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
    const payload = {
      entiId: this.entiId,
      batchId,
    };
    this.loading = true;
    this.commonApi.fetchData(payload, 'batch', 'students/eligible').subscribe({
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
    if (!q) {
      this.eligibleStudentsFiltered = [...this.eligibleStudents];
      return;
    }
    this.eligibleStudentsFiltered = (this.eligibleStudents || []).filter(
      (s: any) => {
        const n = safeTrim(s?.student?.name).toLowerCase();
        const p = safeTrim(s?.student?.phone).toLowerCase();
        const ad = safeTrim(s?.admissionNo).toLowerCase();
        return n.includes(q) || p.includes(q) || ad.includes(q);
      },
    );
  }

  resetEligibleFilter() {
    this.eligibleSearch = '';
    this.applyEligibleFilter(true);
  }

  toggleStudent(id: any, checked: boolean) {
    if (this.loading) return;
    const sid = safeTrim(id);
    if (!sid) return;
    if (checked) this.selectedStudentIds.add(sid);
    else this.selectedStudentIds.delete(sid);
  }

  assignStudents() {
    if (!this.selectedStudentIds.size) {
      this.alert.error('Select at least one student');
      return;
    }
    const batchId = safeTrim(this.activeBatch?.batchId);
    if (!batchId) return;
    const payload = {
      entiId: this.entiId,
      batchId,
      studentIds: Array.from(this.selectedStudentIds),
    };
    this.loading = true;
    this.commonApi.fetchData(payload, 'batch', 'students/assign').subscribe({
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

  // ---------------- VIEW ----------------
  openView(row: any) {
    const b = row?._raw || row;
    this.router.navigate(['/app/batches/view', b?.batchId]);
  }

  loadStaffFull() {
    const payload = { entiId: this.entiId };
    this.commonApi.fetchData(payload, 'ims', 'staff/list?list=full').subscribe({
      next: (res: any) => {
        const all = res?.data || [];
        this.staffListFull = (all || []).filter((s: any) => {
          return safeTrim(s?.facultyType).toUpperCase() === 'TEACHING';
        });
        this.staffOptions = [{ label: 'Select', value: '' }].concat(
          (this.staffListFull || []).map((s: any) => ({
            label: `${s?.staffName || '-'} (${s?.staffCode || '-'})`,
            value: safeTrim(s?.staffId || s?._id),
          })),
        );
        this.staffOptionsAll = [...this.staffOptions];
        this.staffOptionsFiltered = [...this.staffOptions];
      },
      error: () => {
        this.staffListFull = [];
        this.staffOptions = [{ label: 'Select', value: '' }];
        this.staffOptionsAll = [{ label: 'Select', value: '' }];
        this.staffOptionsFiltered = [{ label: 'Select', value: '' }];
      },
    });
  }

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
    this.staffOptionsFiltered = [...(this.staffOptionsAll?.length ? this.staffOptionsAll : this.staffOptions)];
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
    const payload = { entiId: this.entiId, batchId };
    this.commonApi.fetchData(payload, this.moduleName, 'subjects').subscribe({
      next: (res: any) => {
        const arr = res?.data || [];
        this.batchSubjectOptions = [{ label: 'Select', value: '' }].concat(
          arr.map((s: any) => ({
            label: `${s?.subjectName || '-'} (${s?.subjectCode || '-'})`,
            value: safeTrim(s?.subjectId || s?._id),
          })),
        );
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
    const already = (this.staffMapRows || []).some(
      (r: any) => safeTrim(r?.subjectId) === subjId,
    );
    if (already) {
      this.alert.error('This subject already mapped. Remove and add again.');
      return;
    }
    const subjOpt = (this.batchSubjectOptions || []).find(
      (x: any) => safeTrim(x?.value) === subjId,
    );
    const staffOpt = (this.staffOptions || []).find(
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
    if (i < 0 || i >= this.staffMapRows.length) return;
    this.staffMapRows.splice(i, 1);
  }

  saveStaffMap() {
    if (this.loading) return;
    const batchId = safeTrim(this.activeBatchForStaff?.batchId);
    if (!batchId) return;
    const payload = {
      entiId: this.entiId,
      batchId,
      staffMap: (this.staffMapRows || []).map((x: any) => ({
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

  private canTeachSubject(staff: any, subjectId: string): boolean {
    const sid = safeTrim(subjectId);
    if (!sid) return true;
    return safeTrim(staff?.subject) === sid;
  }

  onStaffDraftSubjectChanged(subjectId: any) {
    const sid = safeTrim(subjectId);
    const filtered = (this.staffListFull || []).filter((st: any) =>
      this.canTeachSubject(st, sid),
    );
    this.staffOptionsFiltered = [{ label: 'Select', value: '' }].concat(
      filtered.map((s: any) => ({
        label: `${s?.staffName || '-'} (${s?.staffCode || '-'})`,
        value: safeTrim(s?.staffId || s?._id),
      })),
    );
    const curStaffId = safeTrim(this.staffDraft?.staffId);
    if (curStaffId) {
      const ok = (this.staffOptionsFiltered || []).some(
        (o: any) => safeTrim(o?.value) === curStaffId,
      );
      if (!ok) this.staffDraft.staffId = '';
    }
  }
}
