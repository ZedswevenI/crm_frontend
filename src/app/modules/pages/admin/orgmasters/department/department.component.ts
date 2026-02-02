import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-department',
  standalone: false,
  templateUrl: './department.component.html',
  styleUrl: './department.component.scss',
})
export class DepartmentComponent implements OnInit {
  deptForm!: FormGroup;
  totalRecords = 0;
  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingRecId: string | null = null;
  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';
  entiId: any;
  showImport = false;
  importFileName = '';
  importPreviewRows: any[] = [];
  importHasInvalidRows = false;
  importInvalidCount = 0;
  departmentData: any[] = [];
  private moduleName = 'ims';
  columns = [
    { key: 'departmentName', label: 'Department Name', sortable: true },
    { key: 'departmentCode', label: 'Code', sortable: false },
    { key: 'isActive', label: 'Active', sortable: false },
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

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Departments' },
    ]);
  }

  ngOnInit(): void {
    this.initForm();
    // this.loadDepartments({ page: 1, pageSize: 10 });
  }

  // ---------------- FORM ----------------
  initForm() {
    this.deptForm = this.fb.group({
      departmentCode: [''],
      departmentName: ['', Validators.required],
      isActive: [true],
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
    };
    const sortKey = event?.sortKey ? sortMap[event.sortKey] : null;
    const sort = sortKey
      ? event?.sortDirection === 'asc'
        ? sortKey
        : `-${sortKey}`
      : '';
    const payload = {
      entiId: this.entiId,
    };
    const qp = this.buildQueryParams({
      page,
      limit,
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
    });
    this.commonApi.fetchData(payload, this.moduleName, `dept/list${qp}`).subscribe({
      next: (res: any) => {
        this.totalRecords = res?.count || 0;
        this.departmentData = (res?.data || []).map((d: any) => ({
          recId: d._id,
          departmentName: d.departmentName,
          departmentCode: d.departmentCode || '-',
          isActive: !!d.isActive,
          _raw: d,
        }));
      },
      error: () => this.alert.error('Failed to load departments'),
    });
  }

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
    const d = row._raw;

    this.formMode = 'edit';
    this.editingRecId = d._id;

    this.deptForm.patchValue({
      departmentCode: d.departmentCode || '',
      departmentName: d.departmentName || '',
      isActive: !!d.isActive,
    });

    this.showForm = true;
  }

  // ---------------- SAVE ----------------
  save() {
    if (this.deptForm.invalid) {
      this.deptForm.markAllAsTouched();
      this.alert.error('Please fill all required fields');
      return;
    }

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

    this.commonApi.fetchData(payload, this.moduleName, endpoint).subscribe({
      next: () => {
        this.alert.success(
          this.formMode === 'create'
            ? 'Department created successfully'
            : 'Department updated successfully'
        );
        this.showForm = false;
        this.loadDepartments({ page: 1, pageSize: 10 });
      },
      error: (err: any) =>
        this.alert.error(err?.error?.message || 'Operation failed'),
    });
  }

  cancel() {
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
        next: () => {
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
    this.showImport = true;
    this.resetImport();
  }

  closeImport() {
    this.showImport = false;
  }

  resetImport() {
    this.importFileName = '';
    this.importPreviewRows = [];
    this.importHasInvalidRows = false;
    this.importInvalidCount = 0;
  }

  onExcelSelected(ev: any) {
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

        const mapped = rawRows.map((r: any, idx: number) =>
          this.mapExcelRow(r, idx + 2)
        );
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
        if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '')
          return String(r[k]).trim();
      }
      return '';
    };

    const departmentNameRaw = get(
      'Department Name',
      'DepartmentName',
      'departmentName'
    );
    const departmentName = (departmentNameRaw || '').trim().toUpperCase();
    const departmentCode =
      get('Department Code', 'DepartmentCode', 'departmentCode') || null;

    const statusRaw = get('Status', 'status');
    const status = statusRaw === 'Inactive' ? 'Inactive' : 'Active';

    const errors: string[] = [];
    if (!departmentName) errors.push('Department Name required');

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
    if (!this.importPreviewRows.length) {
      this.alert.error('Please upload an Excel file first');
      return;
    }
    if (this.importHasInvalidRows) {
      this.alert.error('Fix invalid rows before importing');
      return;
    }

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
      .subscribe({
        next: (res: any) => {
          const inserted = res?.insertedCount;
          const skipped = res?.skippedCount;
          if (inserted !== undefined)
            this.alert.success(
              `Import completed. Inserted: ${inserted}, Skipped: ${
                skipped || 0
              }`
            );
          else this.alert.success('Import completed');

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
