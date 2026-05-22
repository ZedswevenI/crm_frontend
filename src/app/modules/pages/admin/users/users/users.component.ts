import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { UserService } from '../../../../../service/admin/user.service';
import { CenterService } from '../../../../../service/admin/orgmasters/center.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';
import { AuthService } from '../../../../../service/auth/auth.service';
import * as XLSX from 'xlsx';

// FIX: L6 and L7 added
type RoleKey = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7';
type ImportMode = 'insert' | 'upsert';

// FIX: valid roles for import validation now includes L6 and L7
const VALID_ROLE_LEVELS: RoleKey[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];

interface RoleMeta {
  key: RoleKey;
  title: string;
  subtitle: string;
  permissions: string[];
}

@Component({
  selector: 'app-users',
  standalone: false,
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
 userForm!: FormGroup;
  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingId: string | null = null;
  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';
  roleInfoVisible = false;
  roleInfoKey: RoleKey | null = null;
  entiId: any;
  centers: any[] = [];
  centerOptions: any[] = [];
  users: any[] = [];
  totalRecords = 0;
  loading = false;
  syncing = false;
  private lastTableParams: any = { page: 1, pageSize: 10 };
  showImport = false;
  importMode: ImportMode = 'upsert';
  importFileName = '';
  importPreviewRows: any[] = [];
  importHasInvalidRows = false;
  importInvalidCount = 0;
  importing = false;

  columns = [
    { key: 'name',      label: 'User Name', sortable: true  },
    { key: 'email',     label: 'Email',     sortable: true  },
    { key: 'phone',     label: 'Phone',     sortable: false },
    { key: 'empCode',   label: 'Emp Code',  sortable: false },
    { key: 'roleLabel', label: 'Role',      sortable: false },
    { key: 'status',    label: 'Status',    sortable: false },
  ];

  actions = [
    {
      type: 'icon', icon: 'fa-solid fa-circle-info', tooltip: 'Role permissions',
      callback: (row: any) => this.openRoleInfo(row.roleLevel as RoleKey),
    },
    {
      type: 'icon', icon: 'fa-regular fa-pen-to-square', tooltip: 'Edit',
      callback: (row: any) => this.edit(row),
    },
    {
      type: 'icon', icon: 'fa-regular fa-trash-can', tooltip: 'Delete', hoverColor: '#D42B2B',
      callback: (row: any) => this.openDelete(row),
    },
  ];

  // FIX: labels now match Access Level excel exactly (L1–L7)
  roleOptions = [
    { value: 'L1', label: 'L1 - Super Admin'  },
    { value: 'L2', label: 'L2 - Admissions'   },
    { value: 'L3', label: 'L3 - AO'           },
    { value: 'L4', label: 'L4 - Teacher'      },
    { value: 'L5', label: 'L5 - Exam'         },
    { value: 'L6', label: 'L6 - Account'      },
    { value: 'L7', label: 'L7 - EDP'          },
  ];

  // FIX: permissions rewritten to match Access Level excel exactly
  private roleMetaMap: Record<RoleKey, RoleMeta> = {
    L1: {
      key: 'L1', title: 'L1 - Super Admin',
      subtitle: 'Full access with no restrictions.',
      permissions: [
        'Access to all modules without any restriction',
        'Can download all kinds of reports',
        'Can approve or override actions from all other levels',
      ],
    },
    L2: {
      key: 'L2', title: 'L2 - Admissions',
      subtitle: 'Admissions and student communication management.',
      permissions: [
        'Email ID and contact number update / edit for students',
        'Blocklist defaulters and remove from blocklist',
        'Communication and circular management',
        'Task creation',
        'Requires L1 approval for any edit or update',
        'No download option for any module',
      ],
    },
    L3: {
      key: 'L3', title: 'L3 - AO (Admin Officer)',
      subtitle: 'Academic operations and administrative control.',
      permissions: [
        'Timetable upload, edit classes, rearrange classes',
        'Attendance entry and edit',
        'Student search — view contact number and email only',
        'Assignment enabling',
        'View phase plan for all batches',
        'Activities upload',
        'Check student performance',
        'Task creation',
        'PTM scheduling',
        'Library file upload',
        'Circular creation and upload to batch / individual students',
        'Faculty feedback scheduling',
        'Communication access',
        'No download option for any module',
      ],
    },
    L4: {
      key: 'L4', title: 'L4 - Teacher',
      subtitle: 'Teaching faculty portal access.',
      permissions: [
        'View timetable for their batches',
        'Attendance entry for their classes',
        'Assignment enabling for their batches',
        'View phase plan for their assigned batches',
        'View annual activities for their batches',
        'View student performance — no sharing or downloading',
        'View tasks and update own task status',
        'Create personal tasks',
        'View PTM schedule and enter comments per student',
        'Library file upload',
        'Apply for leave',
        'No download option for any module',
      ],
    },
    L5: {
      key: 'L5', title: 'L5 - Exam',
      subtitle: 'Exam management and reporting.',
      permissions: [
        'Exam schedule management',
        'Seating plan creation',
        'Exam report print',
        'Consolidated exam report print',
        'Results publishing and mail sending',
        'Invigilation scheduling',
        'Print allowed — no file download',
      ],
    },
    L6: {
      key: 'L6', title: 'L6 - Account',
      subtitle: 'Staff and account management.',
      permissions: [
        'New teacher / staff entry',
        'View faculty profiles individually',
        'Change weekly off for faculty members',
        'Email ID and contact number update for staff',
        'Requires L1 approval for any edit or update',
        'No download option for any module',
      ],
    },
    L7: {
      key: 'L7', title: 'L7 - EDP',
      subtitle: 'Exam data preparation and question management.',
      permissions: [
        'Create exam schedule',
        'Update answer key',
        'QP print with or without answer key',
        'Create questions in LaTeX',
        'No download option for any module',
      ],
    },
  };

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService,
    private userService: UserService,
    private centerService: CenterService,
    private api: CommonapiService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,   // FIX: inject for self-delete guard
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Org configs' },
      { label: 'Users & Roles' },
    ]);
  }

  ngOnInit(): void {
    this.userForm = this.fb.group({
      name:     ['', Validators.required],
      email:    ['', [Validators.required, Validators.email]],
      phone:    ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      role:     [null, Validators.required],
      empCode:  [''],
      password: [''],
      centerId: [null, Validators.required],
      isActive: [true],
    });
    this.applyPasswordRules();
    this.loadCenters();
  }

  private applyPasswordRules() {
    const pwd = this.userForm.get('password');
    if (!pwd) return;
    if (this.formMode === 'create') {
      pwd.setValidators([Validators.required]);
      pwd.setValue('Welcome@123', { emitEvent: false });
    } else {
      pwd.clearValidators();
      pwd.setValue('', { emitEvent: false });
    }
    pwd.updateValueAndValidity({ emitEvent: false });
  }

  loadCenters(): void {
    this.centerService.listCenters(this.entiId).subscribe({
      next: (res: any) => {
        if (res?.status === false) {
          this.alertService.error(res?.message || 'Failed to load centers');
          return;
        }
        this.centers = res?.data || [];
        this.centerOptions = this.centers.map((c: any) => ({
          label:      c.centerName,
          value:      String(c.centerId || c._id || '').trim(),
          _id:        c._id,
          centerName: c.centerName,
        }));
      },
      error: () => this.alertService.error('Server error while loading centers'),
    });
  }

  get currentRoleMeta(): RoleMeta | null {
    if (!this.roleInfoKey) return null;
    return this.roleMetaMap[this.roleInfoKey];
  }

  fetchTableData(params: {
    page: number; pageSize: number;
    search?: string; sortKey?: string; sortDirection?: string;
  }) {
    this.lastTableParams = params || this.lastTableParams;
    this.loading = true;
    let sortParam = '';
    if (params.sortKey)
      sortParam = params.sortDirection === 'desc' ? `-${params.sortKey}` : params.sortKey;

    const query: any = { page: params.page, limit: params.pageSize };
    if (sortParam)     query.sort   = sortParam;
    if (params.search) query.search = params.search;
    const queryString = Object.keys(query)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join('&');

    this.api.fetchData({ entiId: this.entiId }, 'ims/user', `list?${queryString}`).subscribe({
      next: (res: any) => {
        const rows = Array.isArray(res?.data) ? res.data : [];
        this.users = rows.map((u: any) => ({
          ...u,
          empCode:   u.empCode  || '-',
          roleLabel: u.roleLabel || this.roleOptions.find((r) => r.value === u.roleLevel)?.label || u.roleLevel || '-',
        }));
        this.totalRecords = this.toNum(res?.count);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.alertService.error(err?.error?.message || 'Error loading users');
      },
    });
  }

  private refreshTable() {
    this.fetchTableData(this.lastTableParams || { page: 1, pageSize: 10 });
  }

  add(): void {
    this.formMode = 'create';
    this.editingId = null;
    this.userForm.reset({ name: '', email: '', phone: '', role: null, centerId: null, isActive: true });
    this.userForm.get('empCode')?.enable({ emitEvent: false });
    this.userForm.get('empCode')?.setValue('', { emitEvent: false });
    this.applyPasswordRules();
    this.showForm = true;
  }

  edit(row: any): void {
    this.formMode  = 'edit';
    this.editingId = row?._id || null;
    this.userForm.patchValue({
      name:     row?.name      || '',
      email:    row?.email     || '',
      phone:    row?.phone     || '',
      role:     row?.roleLevel || null,
      centerId: row?.centerId  || null,
      isActive: (row?.status || '') === 'Active',
    });
    this.userForm.get('empCode')?.setValue(row?.empCode || '', { emitEvent: false });
    this.userForm.get('empCode')?.disable({ emitEvent: false });
    this.applyPasswordRules();
    this.showForm = true;
  }

  cancel(): void {
    this.showForm  = false;
    this.editingId = null;
  }

  save(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      this.alertService.error('Please fill all required fields');
      return;
    }
    const raw      = this.userForm.getRawValue() || {};
    const centerId = String(raw.centerId || '').trim();
    const selectedCenter = this.centerOptions.find((c) => String(c.value) === centerId);

    const payload: any = {
      entiId:     this.entiId,
      name:       String(raw.name  || '').trim(),
      email:      String(raw.email || '').trim().toLowerCase(),
      phone:      String(raw.phone || '').trim(),
      roleLevel:  String(raw.role  || 'L4').trim(),
      status:     raw.isActive ? 'Active' : 'Inactive',
      centerId:   centerId || null,
      centerName: selectedCenter?.centerName || null,
    };

    const empCode = String(raw.empCode || '').trim();
    if (empCode) payload.empCode = empCode;

    if (this.formMode === 'create') {
      payload.password = 'Welcome@123';
    } else {
      payload.recId = this.editingId;
    }

    const api$ = this.formMode === 'create'
      ? this.userService.createUser(payload)
      : this.userService.updateUser(payload);

    api$.subscribe({
      next: (res: any) => {
        if (res?.status === false) { this.alertService.error(res?.message || 'Operation failed'); return; }
        this.alertService.success(this.formMode === 'create' ? 'User created successfully' : 'User updated successfully');
        this.showForm = false;
        this.refreshTable();
      },
      error: (err: any) => this.alertService.error(err?.error?.message || 'Server error'),
    });
  }

  openDelete(row: any): void {
    // FIX: block L1 deletion
    if (row?.roleLevel === 'L1') {
      this.alertService.error('Super Admin (L1) users cannot be deleted.');
      return;
    }
    // FIX: self-deletion guard — logged-in user cannot delete themselves
    const currentUserId = localStorage.getItem('userid');
    if (row?.userId && row.userId === currentUserId) {
      this.alertService.error('You cannot delete your own account.');
      return;
    }
    this.deleteTarget  = row;
    this.deleteMessage = `Are you sure you want to delete user "${row?.name || ''}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean): void {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;
    this.userService.deleteUser(this.entiId, this.deleteTarget._id).subscribe({
      next: (res: any) => {
        if (res?.status === false) { this.alertService.error(res?.message || 'Delete failed'); return; }
        this.alertService.success('User deleted');
        this.refreshTable();
      },
      error: (err: any) => this.alertService.error(err?.error?.message || 'Server error'),
    });
    this.deleteTarget = null;
  }

  openRoleInfo(role: RoleKey | null): void {
    if (!role || !this.roleMetaMap[role]) return;
    this.roleInfoKey     = role;
    this.roleInfoVisible = true;
  }

  closeRoleInfo(): void {
    this.roleInfoVisible = false;
    this.roleInfoKey     = null;
  }

  openImport()  { this.showImport = true;  this.resetImport(); }
  closeImport() { this.showImport = false; this.importing = false; this.resetImport(); this.cdr.detectChanges(); }

  private resetImport() {
    this.importFileName       = '';
    this.importPreviewRows    = [];
    this.importHasInvalidRows = false;
    this.importInvalidCount   = 0;
    this.importMode           = 'upsert';
    this.importing            = false;
  }

  onExcelSelected(ev: any) {
    const file: File = ev?.target?.files?.[0];
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      this.alertService.error('Please upload a valid Excel file (.xlsx / .xls)');
      return;
    }
    this.importFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const wb  = XLSX.read(e.target.result as ArrayBuffer, { type: 'array' });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
        this.importPreviewRows = rawRows.map((r, idx) => this.mapExcelRow(r, idx + 2));
        this.computeImportValidation();
      } catch {
        this.alertService.error('Unable to read Excel file');
        this.importPreviewRows = [];
        this.computeImportValidation();
      }
    };
    reader.onerror = () => this.alertService.error('Unable to read file');
    reader.readAsArrayBuffer(file);
  }

  private mapExcelRow(r: any, rowNo: number) {
    const get = (...keys: string[]) => {
      for (const k of keys) {
        if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') return String(r[k]).trim();
      }
      return '';
    };

    const name       = get('Name', 'Full Name', 'User Name', 'name');
    const email      = get('Email', 'email').toLowerCase();
    const phone      = get('Phone', 'phone');
    const roleLevel  = (get('Role', 'Role Level', 'roleLevel') || '').toUpperCase();
    const centerName = get('Center', 'Center Name', 'centerName');
    const centerCode = get('Center Code', 'CenterCode', 'centerCode');
    const empCode    = get('EmpCode', 'Employee Code', 'empCode');

    const errors: string[] = [];
    if (!name)  errors.push('Name required');
    if (!email) errors.push('Email required');
    if (email && !this.isEmail(email)) errors.push('Invalid email');
    if (!phone) errors.push('Phone required');
    if (phone && !/^\d{10}$/.test(phone)) errors.push('Phone must be 10 digits');

    // FIX: validate against full L1–L7 list
    if (!VALID_ROLE_LEVELS.includes(roleLevel as RoleKey))
      errors.push(`Role must be one of: ${VALID_ROLE_LEVELS.join(', ')}`);

    if (!centerName && !centerCode) errors.push('Center required');

    const centerHit = this.centers.find((c: any) => {
      const nameMatch = String(c?.centerName || '').trim().toLowerCase() === String(centerName || '').trim().toLowerCase();
      const codeMatch = String(c?.centerCode || '').trim().toUpperCase() === String(centerCode || '').trim().toUpperCase();
      return nameMatch || (centerCode && codeMatch);
    });
    if (!centerHit) errors.push(`Center not found: "${centerName || centerCode}"`);

    return {
      _rowNo:     rowNo,
      _valid:     errors.length === 0,
      _errors:    errors,
      name, email, phone,
      roleLevel:  VALID_ROLE_LEVELS.includes(roleLevel as RoleKey) ? roleLevel : '',
      empCode:    empCode || null,
      centerId:   centerHit ? String(centerHit.centerId || centerHit._id || '') : null,
      centerName: centerHit?.centerName || centerName || null,
      status:     'Active',
    };
  }

  private computeImportValidation() {
    const invalid         = (this.importPreviewRows || []).filter((x) => !x._valid || x._importOk === false);
    this.importInvalidCount   = invalid.length;
    this.importHasInvalidRows = invalid.length > 0;
  }

  confirmImport() {
    if (!this.importPreviewRows.length) { this.alertService.error('Please upload an Excel file first'); return; }
    if (this.importHasInvalidRows)      { this.alertService.error('Fix invalid rows before importing'); return; }

    const rows    = this.importPreviewRows.map((r: any) => ({
      _rowNo: r._rowNo, name: r.name, email: r.email, phone: r.phone,
      roleLevel: r.roleLevel, empCode: r.empCode || null,
      centerId: r.centerId, centerName: r.centerName, status: 'Active',
    }));
    const payload = { entiId: this.entiId, mode: this.importMode, rows };
    this.importing = true;

    this.api.fetchData(payload, 'ims/user', 'import').subscribe({
      next: (res: any) => {
        const { summary, results, skippedRows } = this.pickImportPayload(res);
        if (results.length)     this.applyImportResultsToPreview(results);
        if (skippedRows.length) this.applySkippedRowsToPreview(skippedRows);

        const inserted = Number(summary?.inserted || 0);
        const updated  = Number(summary?.updated  || 0);
        const skipped  = Number(summary?.skipped  || skippedRows.length || 0);
        const failed   = Number(summary?.failed   || 0) || results.filter((x: any) => !(x?.ok === true || x?.status === true)).length;

        this.importing = false;
        const msg = `Import done. Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`;
        if (failed > 0) { this.alertService.error(msg); return; }
        this.alertService.success(msg);
        this.closeImport();
        this.refreshTable();
      },
      error: (err: any) => {
        const resp = err?.error || err;
        const { results, skippedRows } = this.pickImportPayload(resp);
        if (results.length)     this.applyImportResultsToPreview(results);
        if (skippedRows.length) this.applySkippedRowsToPreview(skippedRows);
        this.importing = false;
        this.alertService.error(resp?.message || 'Import failed');
      },
    });
  }

  downloadSampleExcel() {
    const rows = [{
      Name: 'Arun Kumar', Email: 'arun@z7i.com', Phone: '9876543210',
      'Role Level': 'L4', Center: this.centers?.[0]?.centerName || 'Coimbatore',
      EmpCode: 'EMP-0004',
    }];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, 'User_Import_Sample.xlsx');
  }

  syncUsersWithStaff() {
    if (this.syncing) return;
    this.syncing = true;
    this.api.fetchData({ entiId: this.entiId }, 'ims', 'user/link/staff').subscribe({
      next: (res: any) => {
        this.syncing = false;
        if (res?.status === false) { this.alertService.error(res?.message || 'Sync failed'); return; }
        this.alertService.success(res?.message || 'Sync completed');
        this.refreshTable();
      },
      error: (err: any) => {
        this.syncing = false;
        this.alertService.error(err?.error?.message || 'Sync failed');
      },
    });
  }

  private isEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
  }

  private toNum(v: any): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    const m = String(v).trim().match(/-?\d+/);
    return m ? (Number.isFinite(Number(m[0])) ? Number(m[0]) : 0) : 0;
  }

  private pickImportPayload(resp: any) {
    const root        = resp || {};
    const data        = root?.data && typeof root.data === 'object' ? root.data : null;
    const summary     = data?.summary     || root?.summary     || {};
    const resultsRaw  = data?.results     || root?.results     || [];
    const invalidRaw  = data?.invalidRows || root?.invalidRows || [];
    const skippedRaw  = data?.skippedRows || root?.skippedRows || [];

    const results     = Array.isArray(resultsRaw) ? resultsRaw : [];
    const invalidRows = Array.isArray(invalidRaw)  ? invalidRaw : [];
    const skippedRows = Array.isArray(skippedRaw)  ? skippedRaw : [];

    const normalizedFromInvalid = invalidRows.map((x: any) => ({
      rowNo:   Number(x?.rowNo ?? (x?.index != null ? x.index + 2 : 0)),
      ok:      false,
      message: x?.message || x?.error || (Array.isArray(x?.errors) ? x.errors.join(', ') : 'Invalid'),
    }));

    return { summary, skippedRows, results: results.length ? results : normalizedFromInvalid };
  }

  private applyImportResultsToPreview(results: any[]) {
    const map = new Map<number, any>();
    (results || []).forEach((x: any) => {
      const rn = Number(x?.rowNo ?? x?._rowNo ?? x?.index);
      if (Number.isFinite(rn) && rn > 0) map.set(rn, x);
    });
    this.importPreviewRows = (this.importPreviewRows || []).map((r: any) => {
      const rr = map.get(Number(r._rowNo));
      if (!rr) return r;
      const ok  = rr?.ok === true || rr?.status === true;
      const msg = rr?.message || rr?.error || rr?.reason || (Array.isArray(rr?.errors) ? rr.errors.join(', ') : '') || '';
      return ok
        ? { ...r, _importOk: true,  _importError: '' }
        : { ...r, _importOk: false, _importError: msg || 'Import failed', _valid: false, _errors: [msg || 'Import failed'] };
    });
    this.computeImportValidation();
  }

  private applySkippedRowsToPreview(skippedRows: any[]) {
    const emailMap = new Map<string, string>();
    (skippedRows || []).forEach((x: any) => {
      if (x?.email) emailMap.set(String(x.email).toLowerCase(), x.reason || 'Skipped');
    });
    this.importPreviewRows = (this.importPreviewRows || []).map((r: any) => {
      const reason = emailMap.get(String(r.email || '').toLowerCase());
      if (!reason) return r;
      return { ...r, _importOk: false, _importError: reason, _valid: false, _errors: [reason] };
    });
    this.computeImportValidation();
  }
}