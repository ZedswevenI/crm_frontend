import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

const safeTrim = (v: any) =>
  v === undefined || v === null ? '' : String(v).trim();

@Component({
  selector: 'app-batchbackup',
  standalone: false,
  templateUrl: './batchbackup.component.html',
  styleUrl: './batchbackup.component.scss'
})
export class BatchbackupComponent implements OnInit {
  loading = false;
  entiId: any;
  private moduleName = 'batch';
  totalRecords = 0;
  batchRows: any[] = [];
  filterForm!: FormGroup;
  editorForm!: FormGroup;
  editorMode: 'create' | 'edit' = 'create';
  showEditorModal = false;
  academicYears: string[] = ['2024-2025', '2025-2026', '2026-2027'];
  programsFull: any[] = [];
  centersFull: any[] = [];
  showAssignPanel = false;
  activeBatchForAssign: any | null = null;
  eligibleRows: any[] = [];
  eligibleCount = 0;
  eligibleQuery = { page: 1, limit: 20, search: '' };
  selectedStudentIds = new Set<string>();

  // ✅ IMPROVED: Added 'badge' type and colors for Status column
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
        'ACTIVE': 'badge bg-success-subtle text-success',
        'DRAFT': 'badge bg-secondary-subtle text-secondary',
        'CLOSED': 'badge bg-danger-subtle text-danger',
        'INACTIVE': 'badge bg-dark-subtle text-dark'
      }
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
      tooltip: 'Edit',
      callback: (row: any) => this.openEdit(row),
    },
    {
      type: 'icon',
      icon: 'fa-solid fa-users-gear',
      tooltip: 'Add Faculty',
      callback: (row: any) => this.openView(row),
    },
    {
      type: 'icon',
      icon: 'fa-solid fa-user-plus',
      tooltip: 'Assign Students',
      callback: (row: any) => this.openAssign(row),
    },
    {
      type: 'icon',
      icon: 'fa-solid fa-lock',
      tooltip: 'Close Batch',
      callback: (row: any) => this.closeBatch(row),
    },
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService
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
    this.loadProgramsFull();
    this.loadCentersFull();
    this.loadBatches({ page: 1, pageSize: 20 });
  }

  // ---------------- Forms ----------------
  initForms() {
    this.filterForm = this.fb.group({
      search: [''],
      status: ['ALL'],
      academicYear: [''],
      programId: [''],
      centerId: [''],
    });

    this.editorForm = this.fb.group({
      batchId: [null],
      batchName: ['', [Validators.required]],
      batchCode: ['', [Validators.required]],
      academicYear: ['', [Validators.required]],
      programId: ['', [Validators.required]],
      programName: [''],
      programCode: [''],
      centerId: ['', [Validators.required]],
      centerName: [''],
      centerCode: [''],
      startDate: ['', [Validators.required]],
      endDate: ['', [Validators.required]],
      status: ['ACTIVE', [Validators.required]],
      remarks: [''],
    });
  }

  private buildQueryParams(params: Record<string, any>) {
    const keys = Object.keys(params || {}).filter(
      (k) => params[k] !== undefined && params[k] !== null && params[k] !== ''
    );
    if (!keys.length) return '';
    const qs = keys
      .map(
        (k) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`
      )
      .join('&');
    return `?${qs}`;
  }

  loadProgramsFull() {
    const payload = { entiId: this.entiId };
    this.commonApi
      .fetchData(payload, 'ims', 'program/list?list=full')
      .subscribe({
        next: (res: any) => {
          this.programsFull = res?.data || [];
        },
        error: () => {
          this.programsFull = [];
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
        },
        error: () => {
          this.centersFull = [];
        },
      });
  }

  onProgramChanged(programId: string) {
    const p = this.programsFull.find(
      (x: any) =>
        safeTrim(x.programId) === safeTrim(programId) ||
        safeTrim(x._id) === safeTrim(programId)
    );
    this.editorForm.patchValue({
      programName: p?.programName || p?.name || '',
      programCode: p?.programCode || p?.code || '',
    });
  }

  onCenterChanged(centerId: string) {
    const c = this.centersFull.find(
      (x: any) =>
        safeTrim(x.centerId) === safeTrim(centerId) ||
        safeTrim(x._id) === safeTrim(centerId)
    );
    this.editorForm.patchValue({
      centerName: c?.centerName || c?.name || '',
      centerCode: c?.centerCode || c?.code || '',
    });
  }

  // ---------------- LIST ----------------
  loadBatches(event?: {
    page: number;
    pageSize: number;
    search?: string;
    sortKey?: string;
    sortDirection?: 'asc' | 'desc';
  }) {
    const page = event?.page || 1;
    const limit = event?.pageSize || 20;
    const f = this.filterForm.value || {};
    const search = safeTrim(event?.search || f.search);
    const sortMap: any = {
      batchName: 'batchName',
      batchCode: 'batchCode',
      academicYear: 'academicYear',
      status: 'status',
    };
    const sortKey = event?.sortKey ? sortMap[event.sortKey] : null;
    const sort = sortKey
      ? event?.sortDirection === 'asc'
        ? sortKey
        : `-${sortKey}`
      : '';
    const status = safeTrim(f.status);
    const academicYear = safeTrim(f.academicYear);
    const programId = safeTrim(f.programId);
    const centerId = safeTrim(f.centerId);
    const qp = this.buildQueryParams({
      page,
      limit,
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
      ...(status && status !== 'ALL' ? { status } : { status: 'ALL' }),
      ...(academicYear ? { academicYear } : {}),
      ...(programId ? { programId } : {}),
      ...(centerId ? { centerId } : {}),
    });
    const payload = { entiId: this.entiId };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, `list${qp}`)
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.totalRecords = res?.count || 0;
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

  refresh() {
    this.loadBatches({ page: 1, pageSize: 20 });
  }

  // ---------------- Modal Open/Close ----------------
  openCreate() {
    this.editorMode = 'create';
    // Ensure all fields are enabled for create
    this.editorForm.get('programId')?.enable();
    this.editorForm.get('centerId')?.enable();
    this.editorForm.get('academicYear')?.enable();

    this.editorForm.reset({
      batchId: null,
      batchName: '',
      batchCode: '',
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

  private dateToEpochMs(dateStr: any): number {
    const s = safeTrim(dateStr);
    if (!s) return 0;
    // Forces midnight local time for the date picker string
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

  openEdit(row: any) {
    const b = row?._raw || row;
    this.editorMode = 'edit';
    this.editorForm.patchValue({
      batchId: b?.batchId,
      batchName: b?.batchName,
      batchCode: b?.batchCode,
      academicYear: b?.academicYear,
      programId: b?.programId,
      programName: b?.programName,
      programCode: b?.programCode,
      centerId: b?.centerId,
      centerName: b?.centerName,
      centerCode: b?.centerCode,
      startDate: this.epochMsToDateInput(b?.startDate),
      endDate: this.epochMsToDateInput(b?.endDate),
      status: b?.status || 'ACTIVE',
      remarks: b?.remarks || '',
    });

    // ✅ IMPROVED: Lock core fields if students are assigned
    const count = Number(b?.studentCount || 0);
    if (count > 0) {
      this.editorForm.get('programId')?.disable();
      this.editorForm.get('centerId')?.disable();
      this.editorForm.get('academicYear')?.disable();
    } else {
      this.editorForm.get('programId')?.enable();
      this.editorForm.get('centerId')?.enable();
      this.editorForm.get('academicYear')?.enable();
    }

    this.showEditorModal = true;
  }

  closeEditorModal() {
    this.showEditorModal = false;
  }

  // ---------------- SAVE ----------------
  saveBatch() {
    if (this.editorForm.invalid) {
      this.editorForm.markAllAsTouched();
      this.alert.error('Please fill all required fields');
      return;
    }
    
    // ✅ IMPROVED: Use getRawValue() to include disabled fields
    const v = this.editorForm.getRawValue() || {};
    
    // ✅ IMPROVED: Validate Start Date < End Date
    const startMs = this.dateToEpochMs(v.startDate);
    const endMs = this.dateToEpochMs(v.endDate);

    if (startMs >= endMs) {
      this.alert.error('End Date must be after Start Date');
      return;
    }

    const payload: any = {
      entiId: this.entiId,
      batchName: safeTrim(v.batchName),
      batchCode: safeTrim(v.batchCode),
      academicYear: safeTrim(v.academicYear),
      programId: safeTrim(v.programId),
      programName: safeTrim(v.programName) || null,
      programCode: safeTrim(v.programCode) || null,
      centerId: safeTrim(v.centerId),
      centerName: safeTrim(v.centerName) || null,
      centerCode: safeTrim(v.centerCode) || null,
      startDate: startMs,
      endDate: endMs,
      status: safeTrim(v.status) || 'ACTIVE',
      remarks: safeTrim(v.remarks) || null,
    };

    const endpoint = this.editorMode === 'create' ? 'create' : 'update';
    if (this.editorMode === 'edit') payload.batchId = safeTrim(v.batchId);
    
    this.loading = true;
    this.commonApi.fetchData(payload, this.moduleName, endpoint).subscribe({
      next: () => {
        this.loading = false;
        this.alert.success(
          this.editorMode === 'create'
            ? 'Batch created successfully'
            : 'Batch updated successfully'
        );
        this.showEditorModal = false;
        this.refresh();
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Operation failed');
      },
    });
  }

  // ---------------- VIEW ----------------
  openView(row: any) {
    const b = row?._raw || row;
    this.router.navigate(['/app/batches/view', b?.batchId]);
  }

  // ---------------- CLOSE ----------------
  closeBatch(row: any) {
    const b = row?._raw || row;
    const batchId = safeTrim(b?.batchId);
    if (!batchId) return;
    if (
      !confirm(
        `Close batch ${b?.batchName || ''}? This will release all students.`
      )
    )
      return;
    const payload = { entiId: this.entiId, batchId };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'batch/close')
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Batch closed and students released');
          this.refresh();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Close failed');
        },
      });
  }

  // ---------------- Assign Students ----------------
  openAssign(row: any) {
    this.activeBatchForAssign = row?._raw || row;
    this.showAssignPanel = true;
    this.selectedStudentIds.clear();
    this.eligibleQuery = { page: 1, limit: 20, search: '' };
    this.loadEligible();
  }

  closeAssignPanel() {
    this.showAssignPanel = false;
    this.activeBatchForAssign = null;
    this.eligibleRows = [];
    this.eligibleCount = 0;
    this.selectedStudentIds.clear();
  }

  toggleStudent(id: string, checked: boolean) {
    const sid = safeTrim(id);
    if (!sid) return;
    if (checked) this.selectedStudentIds.add(sid);
    else this.selectedStudentIds.delete(sid);
  }

  loadEligible() {
    const b = this.activeBatchForAssign;
    const batchId = safeTrim(b?.batchId);
    if (!batchId) return;
    const qp = this.buildQueryParams({
      page: this.eligibleQuery.page,
      limit: this.eligibleQuery.limit,
      ...(safeTrim(this.eligibleQuery.search)
        ? { search: safeTrim(this.eligibleQuery.search) }
        : {}),
    });
    const payload = { entiId: this.entiId, batchId };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, `students/eligible${qp}`)
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.eligibleRows = res?.data || [];
          this.eligibleCount = Number(res?.count || 0);
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(
            err?.error?.message || 'Failed to load eligible students'
          );
        },
      });
  }

  assignSelected() {
    const b = this.activeBatchForAssign;
    const batchId = safeTrim(b?.batchId);
    if (!batchId) return;
    const ids = Array.from(this.selectedStudentIds);
    if (!ids.length) {
      this.alert.error('Select at least one student');
      return;
    }
    const payload = {
      entiId: this.entiId,
      batchId,
      studentIds: ids,
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'students/assign')
      .subscribe({
        next: () => {
          this.loading = false;
          this.alert.success('Students assigned successfully');
          this.closeAssignPanel();
          this.refresh();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Assign failed');
        },
      });
  }
}