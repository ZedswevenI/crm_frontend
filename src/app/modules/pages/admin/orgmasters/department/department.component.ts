import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';
import { PermissionService } from '../../../../../shared/permission.service';
import { filterActionsByTooltip } from '../../../../../shared/action-permission.util';
import * as XLSX from 'xlsx';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-department',
  standalone: false,
  templateUrl: './department.component.html',
  styleUrl: './department.component.scss',
})
export class DepartmentComponent implements OnInit {
  deptForm!: FormGroup;

  // table
  loading = false;
  totalRecords = 0;
  departmentData: any[] = [];

  // form modal
  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingRecId: string | null = null;
  saving = false;

  // delete
  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';

  // import
  showImport = false;
  importing = false;
  importFileName = '';
  importPreviewRows: any[] = [];
  importHasInvalidRows = false;
  importInvalidCount = 0;

  entiId: any;
  private moduleName = 'ims';

  columns = [
    { key: 'departmentName', label: 'Department Name', sortable: true },
    { key: 'departmentCode', label: 'Code', sortable: false },
    { key: 'status', label: 'Status', sortable: false },
  ];

  actions = [
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
      callback: (row: any) => this.openDelete(row),
    },
  ];

  get visibleActions() {
    return filterActionsByTooltip(this.actions, this.permissionService, {
      Edit: 'orgDept:edit',
      Delete: 'orgDept:delete',
    });
  }

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService,
    private permissionService: PermissionService,
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Org Configs' },
      { label: 'Departments' },
    ]);
  }

  ngOnInit(): void {
    this.initForm();
  }

  // ---------------- FORM ----------------
  initForm() {
    this.deptForm = this.fb.group({
      departmentCode: [
        '',
        [
          Validators.maxLength(10),
          Validators.pattern(/^[A-Za-z0-9-]*$/), // optional, but if present: A-Z/0-9/-
        ],
      ],
      departmentName: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(60),
        ],
      ],
      isActive: [true],
    });
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

  // ---------------- LIST ----------------
  loadDepartments(event?: {
    page: number;
    pageSize: number;
    search?: string;
    sortKey?: string;
    sortDirection?: 'asc' | 'desc';
  }) {
    const page = event?.page || 1;
    const limit = event?.pageSize || 10;

    const search = (event?.search || '').toString().trim();
    const sortMap: any = {
      departmentName: 'departmentName',
      departmentCode: 'departmentCode',
      status: 'isActive',
    };

    const sortKey = event?.sortKey ? sortMap[event.sortKey] : null;
    const sort = sortKey
      ? event?.sortDirection === 'asc'
        ? sortKey
        : `-${sortKey}`
      : '';

    const payload = { entiId: this.entiId };

    const qp = this.buildQueryParams({
      page,
      limit,
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
    });

    this.loading = true;

    this.commonApi
      .fetchData(payload, this.moduleName, `dept/list${qp}`)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: any) => {
          this.totalRecords = res?.count || 0;

          this.departmentData = (res?.data || []).map((d: any) => ({
            recId: d._id,
            departmentName: d.departmentName,
            departmentCode: d.departmentCode || '-',
            status: d.isActive ? 'Active' : 'Inactive',
            _raw: d,
          }));
        },
        error: () => this.alert.error('Failed to load departments'),
      });
  }

  // ---------------- CREATE ----------------
  add() {
    this.formMode = 'create';
    this.editingRecId = null;

    this.deptForm.reset({
      departmentCode: '',
      departmentName: '',
      isActive: true,
    });

    this.showForm = true;
  }

  // ---------------- EDIT ----------------
  edit(row: any) {
    const d = row?._raw || {};

    this.formMode = 'edit';
    this.editingRecId = d._id;

    this.deptForm.patchValue({
      departmentCode: d.departmentCode || '',
      departmentName: d.departmentName || '',
      isActive: d.isActive === false ? false : true,
    });

    this.showForm = true;
  }

  // ---------------- SAVE ----------------
  save() {
    if (this.saving) return;

    if (this.deptForm.invalid) {
      this.deptForm.markAllAsTouched();
      return;
    }

    this.saving = true;

    const form = this.deptForm.value || {};
    const payload: any = {
      entiId: this.entiId,
      departmentCode: (form.departmentCode || '').toString().trim() || null,
      departmentName: (form.departmentName || '')
        .toString()
        .trim()
        .toUpperCase(),
      isActive: form.isActive === false ? false : true,
    };

    const endpoint = this.formMode === 'create' ? 'dept/create' : 'dept/update';
    if (this.formMode === 'edit') payload.departmentId = this.editingRecId;

    this.commonApi
      .fetchData(payload, this.moduleName, endpoint)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (res: any) => {
          if (res?.status === false) {
            this.alert.error(res?.message || 'Operation failed');
            return;
          }

          this.alert.success(
            this.formMode === 'create'
              ? 'Department created successfully'
              : 'Department updated successfully',
          );

          this.showForm = false;
          this.loadDepartments({ page: 1, pageSize: 10 });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Operation failed'),
      });
  }

  cancel() {
    if (this.saving) return;
    this.showForm = false;
  }

  // ---------------- DELETE ----------------
  openDelete(row: any) {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete "${row.departmentName}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean) {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;

    const payload = {
      entiId: this.entiId,
      departmentId: this.deleteTarget.recId,
    };

    this.commonApi
      .fetchData(payload, this.moduleName, 'dept/delete')
      .subscribe({
        next: (res: any) => {
          if (res?.status === false) {
            this.alert.error(res?.message || 'Delete failed');
            return;
          }
          this.alert.success('Department deleted successfully');
          this.loadDepartments({ page: 1, pageSize: 10 });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Delete failed'),
      });

    this.deleteTarget = null;
  }

  // ===================== IMPORT =====================

  openImport() {
    if (this.importing) return;
    this.showImport = true;
    this.resetImport();
  }

  closeImport() {
    if (this.importing) return;
    this.showImport = false;
  }

  resetImport() {
    if (this.importing) return;
    this.importFileName = '';
    this.importPreviewRows = [];
    this.importHasInvalidRows = false;
    this.importInvalidCount = 0;
  }

  onExcelSelected(ev: any) {
    if (this.importing) return;

    const file: File = ev?.target?.files?.[0];
    if (!file) return;

    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      this.alert.error('Please upload a valid Excel file (.xlsx / .xls)');
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

        // map + validate
        const mapped = rawRows.map((r: any, idx: number) =>
          this.mapExcelRow(r, idx + 2),
        );

        // extra validation: duplicates inside file (by Department Name)
        const seen = new Set<string>();
        for (const row of mapped) {
          const key = String(row.departmentName || '')
            .trim()
            .toUpperCase();
          if (!key) continue;
          if (seen.has(key)) {
            row._valid = false;
            row._errors = Array.isArray(row._errors) ? row._errors : [];
            row._errors.push('Duplicate in file');
          } else {
            seen.add(key);
          }
        }

        this.importPreviewRows = mapped;
        this.computeImportValidation();
      } catch (err) {
        this.alert.error('Unable to read Excel file');
        this.importPreviewRows = [];
        this.computeImportValidation();
      }
    };

    reader.onerror = () => this.alert.error('Unable to read file');
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

    const departmentNameRaw = get(
      'Department Name',
      'DepartmentName',
      'departmentName',
    );
    const departmentName = (departmentNameRaw || '').trim().toUpperCase();

    const departmentCodeRaw = get(
      'Department Code',
      'DepartmentCode',
      'departmentCode',
    );
    const departmentCode = (departmentCodeRaw || '').trim() || null;

    const statusRaw = get('Status', 'status');
    const statusNorm = String(statusRaw || '')
      .trim()
      .toLowerCase();
    const status = statusNorm === 'inactive' ? 'Inactive' : 'Active';

    const errors: string[] = [];

    if (!departmentName) errors.push('Department Name required');
    if (departmentCode && !/^[A-Za-z0-9-]{2,10}$/.test(departmentCode)) {
      errors.push('Invalid Code');
    }
    if (statusNorm && statusNorm !== 'active' && statusNorm !== 'inactive') {
      errors.push('Invalid Status');
    }

    return {
      _rowNo: rowNo,
      _valid: errors.length === 0,
      _errors: errors,

      departmentName,
      departmentCode,
      status,
    };
  }

  private computeImportValidation() {
    const invalid = (this.importPreviewRows || []).filter((x) => !x._valid);
    this.importInvalidCount = invalid.length;
    this.importHasInvalidRows = invalid.length > 0;
  }

  confirmImport() {
    if (this.importing) return;

    if (!this.importPreviewRows.length) {
      this.alert.error('Please upload an Excel file first');
      return;
    }
    if (this.importHasInvalidRows) {
      this.alert.error('Fix invalid rows before importing');
      return;
    }

    this.importing = true;

    const rows = this.importPreviewRows.map((r) => ({
      departmentName: r.departmentName,
      departmentCode: r.departmentCode,
      isActive: r.status === 'Active',
    }));

    const payload = {
      entiId: this.entiId,
      departments: rows,
    };

    this.commonApi
      .fetchData(payload, this.moduleName, 'dept/import')
      .pipe(finalize(() => (this.importing = false)))
      .subscribe({
        next: (res: any) => {
          const inserted = res?.insertedCount;
          const skipped = res?.skippedCount;

          if (inserted !== undefined) {
            this.alert.success(
              `Import completed. Inserted: ${inserted}, Skipped: ${skipped || 0}`,
            );
          } else {
            this.alert.success('Import completed');
          }

          this.closeImport();
          this.loadDepartments({ page: 1, pageSize: 10 });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Import failed'),
      });
  }

  downloadSampleExcel() {
    const rows = [
      {
        'Department Name': 'ACADEMICS',
        'Department Code': 'ACA',
        Status: 'Active',
      },
      {
        'Department Name': 'ADMIN',
        'Department Code': 'ADM',
        Status: 'Active',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Departments');
    XLSX.writeFile(wb, 'Department_Import_Sample.xlsx');
  }
}
