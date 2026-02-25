import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { UserService } from '../../../../../service/admin/user.service';
import { CenterService } from '../../../../../service/admin/orgmasters/center.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';
import * as XLSX from 'xlsx';

type RoleKey = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
type ImportMode = 'insert' | 'upsert';

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
  private lastTableParams: any = { page: 1, pageSize: 10 };
  showImport = false;
  importMode: ImportMode = 'upsert';
  importFileName = '';
  importPreviewRows: any[] = [];
  importHasInvalidRows = false;
  importInvalidCount = 0;
  importing = false;
  columns = [
    { key: 'name', label: 'User Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'phone', label: 'Phone', sortable: false },
    { key: 'roleLabel', label: 'Role', sortable: false },
    { key: 'status', label: 'Active', sortable: false },
  ];
  actions = [
    {
      type: 'icon',
      icon: 'fa-solid fa-circle-info',
      tooltip: 'Role permissions',
      callback: (row: any) => this.openRoleInfo(row.roleLevel as RoleKey),
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      callback: (row: any) => this.edit(row),
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      tooltip: 'Delete',
      hoverColor: '#D42B2B',
      callback: (row: any) => this.openDelete(row),
    },
  ];
  roleOptions = [
    { value: 'L1', label: 'L1 - Academic Head' },
    { value: 'L2', label: 'L2 - Admission Manager' },
    { value: 'L3', label: 'L3 - Accounts Manager' },
    { value: 'L4', label: 'L4 - Academic Operations' },
    { value: 'L5', label: 'L5 - Teaching Faculty' },
  ];

  private roleMetaMap: Record<RoleKey, RoleMeta> = {
    L1: {
      key: 'L1',
      title: 'L1 - Academic Head',
      subtitle: 'Top-level access for academics and overall control.',
      permissions: [
        'Approval for admission',
        'All types of report generation',
        'Full read / write access to all academic and operational modules',
        'Can override and approve actions from other levels',
      ],
    },
    L2: {
      key: 'L2',
      title: 'L2 - Admission Manager',
      subtitle: 'End-to-end admissions & enrolment control.',
      permissions: [
        'New enrolment / admission entry',
        'Generate enrolment numbers for admitted students',
        'Name / Address / Phone number change for students',
        'Admission-related report generations',
        'Program-wise students list export',
        'Students Selected Not Joined report',
        'Hall ticket print',
        'View enrolment report',
        'All admission-related report generations',
      ],
    },
    L3: {
      key: 'L3',
      title: 'L3 - Accounts Manager',
      subtitle: 'Fee, cheque tracking and financial reporting.',
      permissions: [
        'View admission entries (no edit / new entry)',
        'Access to cheque details',
        'MIS report for upcoming cheque deposits',
        'Mark deposited cheques as collected / dishonoured',
        'Handle replacement of dishonoured cheques',
        'Accounts report generation',
      ],
    },
    L4: {
      key: 'L4',
      title: 'L4 - Academic Operations',
      subtitle: 'Operational control for classes and attendance.',
      permissions: [
        'Timetable management',
        'Batch association',
        'Faculty mapping',
        'Attendance & academic reports',
      ],
    },
    L5: {
      key: 'L5',
      title: 'L5 - Teaching Faculty',
      subtitle: 'Operational control for classes and attendance.',
      permissions: [],
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
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Users & Roles' },
      { label: 'Users' },
    ]);
  }

  ngOnInit(): void {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      role: [null, Validators.required],
      empCode: [{ value: '', disabled: true }],
      password: ['Welcome@123',Validators.required],
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
      pwd.setValue('Welcome@123')
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
          label: c.centerName,
          value: c._id,
        }));
      },
      error: () =>
        this.alertService.error('Server error while loading centers'),
    });
  }

  get currentRoleMeta(): RoleMeta | null {
    if (!this.roleInfoKey) return null;
    return this.roleMetaMap[this.roleInfoKey];
  }

  fetchTableData(params: {
    page: number;
    pageSize: number;
    search?: string;
    sortKey?: string;
    sortDirection?: string;
  }) {
    this.lastTableParams = params || this.lastTableParams;
    this.loading = true;
    let sortParam = '';
    if (params.sortKey) {
      sortParam =
        params.sortDirection === 'desc' ? `-${params.sortKey}` : params.sortKey;
    }
    const query: any = {
      page: params.page,
      limit: params.pageSize,
    };
    if (sortParam) query.sort = sortParam;
    if (params.search) query.search = params.search;
    const queryString = Object.keys(query)
      .map(
        (key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`,
      )
      .join('&');
    const body = { entiId: this.entiId };
    this.api.fetchData(body, 'ims/user', `list?${queryString}`).subscribe({
      next: (res: any) => {
        const rows = Array.isArray(res?.data) ? res.data : [];
        this.users = rows.map((u: any) => ({
          ...u,
          roleLabel:
            u.roleLabel ||
            this.roleOptions.find((r) => r.value === u.roleLevel)?.label ||
            u.roleLevel ||
            '-',
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
    const p = this.lastTableParams || { page: 1, pageSize: 10 };
    this.fetchTableData(p);
  }

  add(): void {
    this.formMode = 'create';
    this.editingId = null;
    this.userForm.reset({
      name: '',
      email: '',
      phone: '',
      role: null,
      centerId: null,
      isActive: true,
    });
    this.userForm.get('empCode')?.setValue('', { emitEvent: false });
    this.applyPasswordRules();
    this.showForm = true;
  }

  edit(row: any): void {
    this.formMode = 'edit';
    this.editingId = row?._id || null;
    this.userForm.patchValue({
      name: row?.name || '',
      email: row?.email || '',
      phone: row?.phone || '',
      role: row?.roleLevel || null,
      centerId: row?.centerId || null,
      isActive: (row?.status || '') === 'Active',
    });
    this.userForm
      .get('empCode')
      ?.setValue(row?.empCode || '', { emitEvent: false });
    this.applyPasswordRules();
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
    this.editingId = null;
  }

  save(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      this.alertService.error('Please fill all required fields');
      return;
    }
    const raw = this.userForm.getRawValue() || {};
    const centerId = String(raw.centerId || '').trim();
    const selectedCenter = this.centers.find(
      (c: any) => String(c?._id) === centerId,
    );
    const payload: any = {
      entiId: this.entiId,
      name: String(raw.name || '').trim(),
      email: String(raw.email || '')
        .trim()
        .toLowerCase(),
      phone: String(raw.phone || '').trim(),
      roleLevel: String(raw.role || 'L4').trim(),
      status: raw.isActive ? 'Active' : 'Inactive',
      centerId: centerId || null,
      centerName: selectedCenter?.centerName
        ? String(selectedCenter.centerName)
        : null,
    };
    const empCode = String(raw.empCode || '').trim();
    if (empCode) payload.empCode = empCode;
    if (this.formMode === 'create') {
      payload.password = 'Welcome@123';
    } else {
      payload.recId = this.editingId;
    }
    const api$ =
      this.formMode === 'create'
        ? this.userService.createUser(payload)
        : this.userService.updateUser(payload);
    api$.subscribe({
      next: (res: any) => {
        if (res?.status === false) {
          this.alertService.error(res?.message || 'Operation failed');
          return;
        }
        this.alertService.success(
          this.formMode === 'create'
            ? 'User created successfully'
            : 'User updated successfully',
        );
        this.showForm = false;
        this.refreshTable();
      },
      error: (err: any) => {
        this.alertService.error(err?.error?.message || 'Server error');
      },
    });
  }

  openDelete(row: any): void {
    if (row?.roleLevel === 'L1') {
      this.alertService.error('L1 (Academic Head) users cannot be deleted.');
      return;
    }
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete user "${row?.name || ''}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean): void {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;
    const payload = { entiId: this.entiId, recId: this.deleteTarget._id };
    this.userService.deleteUser(this.entiId, this.deleteTarget._id).subscribe({
      next: (res: any) => {
        if (res?.status === false) {
          this.alertService.error(res?.message || 'Delete failed');
          return;
        }
        this.alertService.success('User deleted');
        this.refreshTable();
      },
      error: (err: any) =>
        this.alertService.error(err?.error?.message || 'Server error'),
    });
    this.deleteTarget = null;
  }

  openRoleInfo(role: RoleKey | null): void {
    if (!role || !this.roleMetaMap[role]) return;
    this.roleInfoKey = role;
    this.roleInfoVisible = true;
  }

  closeRoleInfo(): void {
    this.roleInfoVisible = false;
    this.roleInfoKey = null;
  }

  openImport() {
    this.showImport = true;
    this.resetImport();
  }

  closeImport() {
    this.showImport = false;
    this.importing = false;
    this.resetImport();
    this.cdr.detectChanges();
  }

  private resetImport() {
    this.importFileName = '';
    this.importPreviewRows = [];
    this.importHasInvalidRows = false;
    this.importInvalidCount = 0;
    this.importMode = 'upsert';
    this.importing = false;
  }

  onExcelSelected(ev: any) {
    const file: File = ev?.target?.files?.[0];
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      this.alertService.error(
        'Please upload a valid Excel file (.xlsx / .xls)',
      );
      return;
    }
    this.importFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = e.target.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, {
          defval: '',
        }) as any[];
        const mapped = rawRows.map((r: any, idx: number) =>
          this.mapExcelRow(r, idx + 2),
        );
        this.importPreviewRows = mapped;
        this.computeImportValidation();
      } catch (err) {
        this.alertService.error('Unable to read Excel file');
        this.importPreviewRows = [];
        this.computeImportValidation();
      }
    };
    reader.onerror = () => this.alertService.error('Unable to read file');
    reader.readAsBinaryString(file);
  }

  private mapExcelRow(r: any, rowNo: number) {
    const get = (...keys: string[]) => {
      for (const k of keys) {
        if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
          return String(r[k]).trim();
        }
      }
      return '';
    };
    const name = get('Name', 'Full Name', 'User Name', 'name');
    const email = get('Email', 'email').toLowerCase();
    const phone = get('Phone', 'phone');
    const roleLevel = (
      get('Role', 'Role Level', 'roleLevel') || 'L4'
    ).toUpperCase();
    const centerName = get('Center', 'Center Name', 'centerName');
    const centerId = get('CenterId', 'centerId');
    const empCode = get('EmpCode', 'Employee Code', 'empCode');
    const errors: string[] = [];
    if (!name) errors.push('Name required');
    if (!email) errors.push('Email required');
    if (email && !this.isEmail(email)) errors.push('Invalid email');
    if (!phone) errors.push('Phone required');
    if (phone && !/^\d{10}$/.test(phone))
      errors.push('Phone must be 10 digits');
    if (!['L1', 'L2', 'L3', 'L4'].includes(roleLevel))
      errors.push('Role must be L1/L2/L3/L4');
    if (!centerName) errors.push('Center required');
    const centerHit = this.centers.find(
      (c: any) =>
        String(c?.centerName || '')
          .trim()
          .toLowerCase() ===
        String(centerName || '')
          .trim()
          .toLowerCase(),
    );
    if (!centerHit) errors.push('Center not found in masters');
    return {
      _rowNo: rowNo,
      _valid: errors.length === 0,
      _errors: errors,
      name,
      email,
      phone,
      roleLevel,
      empCode: empCode || null,
      centerId: centerHit?._id || null,
      centerName: centerHit?.centerName || centerName || null,
      status: 'Active',
    };
  }

  private computeImportValidation() {
    const invalid = (this.importPreviewRows || []).filter((x) => !x._valid);
    this.importInvalidCount = invalid.length;
    this.importHasInvalidRows = invalid.length > 0;
  }

  // confirmImport() {
  //   if (!this.importPreviewRows.length) {
  //     this.alertService.error('Please upload an Excel file first');
  //     return;
  //   }
  //   if (this.importHasInvalidRows) {
  //     this.alertService.error('Fix invalid rows before importing');
  //     return;
  //   }
  //   const rows = this.importPreviewRows.map((r: any) => ({
  //     name: r.name,
  //     email: r.email,
  //     phone: r.phone,
  //     roleLevel: r.roleLevel,
  //     empCode: r.empCode || null,
  //     centerId: r.centerId,
  //     centerName: r.centerName,
  //     status: 'Active',
  //   }));
  //   const payload = {
  //     entiId: this.entiId,
  //     mode: this.importMode,
  //     rows,
  //   };
  //   this.importing = true;
  //   this.api.fetchData(payload, 'ims/user', 'import').subscribe({
  //     next: (res: any) => {
  //       if (res?.status === false) {
  //         this.importing = false;
  //         this.alertService.error(res?.message || 'Import failed');
  //         return;
  //       }
  //       this.alertService.success('Import completed');
  //       this.importing = false;
  //       this.closeImport();
  //       this.refreshTable();
  //     },
  //     error: (err: any) => {
  //       this.importing = false;
  //       this.alertService.error(err?.error?.message || 'Import failed');
  //     },
  //   });
  // }

  confirmImport() {
    if (!this.importPreviewRows.length) {
      this.alertService.error('Please upload an Excel file first');
      return;
    }
    if (this.importHasInvalidRows) {
      this.alertService.error('Fix invalid rows before importing');
      return;
    }
    const rows = this.importPreviewRows.map((r: any) => ({
      _rowNo: r._rowNo,
      name: r.name,
      email: r.email,
      phone: r.phone,
      roleLevel: r.roleLevel,
      empCode: r.empCode || null,
      centerId: r.centerId,
      centerName: r.centerName,
      status: 'Active',
    }));
    const payload = { entiId: this.entiId, mode: this.importMode, rows };
    this.importing = true;
    this.api.fetchData(payload, 'ims/user', 'import').subscribe({
      next: (res: any) => {
        const { summary, results } = this.pickImportPayload(res);
        if (results.length) this.applyImportResultsToPreview(results);
        const failed =
          Number(summary?.failed || 0) ||
          (results.length
            ? results.filter(
                (x: any) => !(x?.ok === true || x?.status === true),
              ).length
            : 0);
        this.importing = false;
        if (failed > 0) {
          this.alertService.error(
            res?.message || `Import completed with errors. Failed: ${failed}`,
          );
          return;
        }
        this.alertService.success(res?.message || 'Import completed');
        this.closeImport();
        this.refreshTable();
      },
      error: (err: any) => {
        const resp = err?.error || err;
        const { summary, results } = this.pickImportPayload(resp);
        if (results.length) this.applyImportResultsToPreview(results);
        const failed =
          Number(summary?.failed || 0) ||
          (results.length
            ? results.filter(
                (x: any) => !(x?.ok === true || x?.status === true),
              ).length
            : 0);
        this.importing = false;
        this.alertService.error(
          resp?.message || `Import completed with errors. Failed: ${failed}`,
        );
      },
    });
  }

  downloadSampleExcel() {
    const rows = [
      {
        Name: 'Arun Kumar',
        Email: 'arun@z7i.com',
        Phone: '9876543210',
        'Role Level': 'L2',
        Center: this.centers?.[0]?.centerName || 'Coimbatore',
        EmpCode: 'EMP-0004',
        Password: 'Pass@123',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, 'User_Import_Sample.xlsx');
  }

  private isEmail(v: string): boolean {
    const s = String(v || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  private toNum(v: any): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    const s = String(v).trim();
    if (!s) return 0;
    const m = s.match(/-?\d+/);
    if (!m) return 0;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : 0;
  }

  private pickImportPayload(resp: any) {
    const root = resp || {};
    const data = root?.data && typeof root.data === 'object' ? root.data : null;

    // accept multiple shapes:
    // 1) { summary, results }
    // 2) { invalidRows }
    // 3) { data: { summary, results } }
    // 4) { data: { invalidRows } }
    const summary = data?.summary || root?.summary || {};
    const resultsRaw = data?.results || root?.results || null;
    const invalidRaw = data?.invalidRows || root?.invalidRows || null;

    const results = Array.isArray(resultsRaw) ? resultsRaw : [];
    const invalidRows = Array.isArray(invalidRaw) ? invalidRaw : [];

    // Normalize invalidRows -> results-like array
    // invalidRows usually looks like: [{ index, message, ... }]
    const normalizedFromInvalid = invalidRows.map((x: any) => ({
      rowNo: Number(x?.rowNo || x?.index + 2 || x?.index), // try rowNo else excel row index + header offset
      ok: false,
      message: x?.message || x?.error || 'Import failed',
    }));

    return {
      summary,
      results: results.length ? results : normalizedFromInvalid,
    };
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
      const ok = rr?.ok === true || rr?.status === true;
      const msg =
        rr?.message ||
        rr?.error ||
        rr?.reason ||
        (Array.isArray(rr?.errors) ? rr.errors.join(', ') : '') ||
        '';
      if (ok) {
        return { ...r, _importOk: true, _importError: '' };
      }
      return {
        ...r,
        _importOk: false,
        _importError: msg || 'Import failed',
        _valid: false,
        _errors: [msg || 'Import failed'],
      };
    });

    this.computeImportValidation();
  }

  syncUsersWithStaff() {
    this.api
      .fetchData({ entiId: this.entiId }, 'ims', 'user/link/staff')
      .subscribe({
        next: (res: any) => {
          if (res?.status === false) {
            this.alertService.error(res?.message || 'Sync failed');
            return;
          }
          this.alertService.success(res?.message || 'Sync completed');
          this.refreshTable();
        },
        error: (err: any) =>
          this.alertService.error(err?.error?.message || 'Sync failed'),
      });
  }
}
