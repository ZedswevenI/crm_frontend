import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';
import * as XLSX from 'xlsx';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-subject',
  standalone: false,
  templateUrl: './subject.component.html',
  styleUrl: './subject.component.scss',
})
export class SubjectComponent implements OnInit {
  subjectForm!: FormGroup;

  // table
  loading = false;
  totalRecords = 0;
  subjectData: any[] = [];

  // modal form
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
    { key: 'subjectName', label: 'Subject Name', sortable: true },
    { key: 'subjectCode', label: 'Code', sortable: false },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'status', label: 'Status', sortable: false },
  ];

  categoryOptions = [
    { label: 'Academic', value: 'academic' },
    { label: 'Aptitude', value: 'aptitude' },
    { label: 'Language', value: 'language' },
    { label: 'Other', value: 'other' },
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
      { label: 'Org Configs' },
      { label: 'Subject' },
    ]);
  }

  ngOnInit(): void {
    this.initForm();
  }

  // ---------------- FORM ----------------
  initForm() {
    this.subjectForm = this.fb.group({
      subjectCode: [
        '',
        [
          Validators.maxLength(10),
          Validators.pattern(/^[A-Za-z0-9-]*$/), // optional, but if present: A-Z/0-9/-
        ],
      ],
      subjectName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(60)]],
      category: ['academic', Validators.required],
      isActive: [true],
    });
  }

  private buildQueryParams(params: Record<string, any>) {
    const keys = Object.keys(params || {}).filter(
      (k) => params[k] !== undefined && params[k] !== null && params[k] !== ''
    );
    if (!keys.length) return '';
    const qs = keys
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`)
      .join('&');
    return `?${qs}`;
  }

  // ---------------- LIST ----------------
  loadSubjects(event?: {
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
      subjectName: 'subjectName',
      subjectCode: 'subjectCode',
      category: 'category',
      status: 'isActive',
    };

    const sortKey = event?.sortKey ? sortMap[event.sortKey] : null;
    const sort = sortKey
      ? event?.sortDirection === 'asc'
        ? sortKey
        : `-${sortKey}`
      : '';

    const qp = this.buildQueryParams({
      page,
      limit,
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
    });

    const payload = { entiId: this.entiId };

    this.loading = true;

    this.commonApi
      .fetchData(payload, this.moduleName, `subject/list${qp}`)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: any) => {
          this.totalRecords = res?.count || 0;

          this.subjectData = (res?.data || []).map((s: any) => ({
            recId: s._id,
            subjectName: s.subjectName,
            subjectCode: s.subjectCode || '-',
            category: s.category || 'academic',
            status: s.isActive ? 'Active' : 'Inactive',
            _raw: s,
          }));
        },
        error: () => this.alert.error('Failed to load subjects'),
      });
  }

  // ---------------- CREATE ----------------
  add() {
    this.formMode = 'create';
    this.editingRecId = null;

    this.subjectForm.reset({
      subjectCode: '',
      subjectName: '',
      category: 'academic',
      isActive: true,
    });

    this.showForm = true;
  }

  // ---------------- EDIT ----------------
  edit(row: any) {
    const s = row?._raw || {};

    this.formMode = 'edit';
    this.editingRecId = s._id;

    this.subjectForm.patchValue({
      subjectCode: s.subjectCode || '',
      subjectName: s.subjectName || '',
      category: s.category || 'academic',
      isActive: s.isActive === false ? false : true,
    });

    this.showForm = true;
  }

  // ---------------- SAVE ----------------
  save() {
    if (this.saving) return;

    if (this.subjectForm.invalid) {
      this.subjectForm.markAllAsTouched();
      return;
    }

    this.saving = true;

    const form = this.subjectForm.value || {};
    const payload: any = {
      entiId: this.entiId,
      subjectCode: (form.subjectCode || '').toString().trim() || null,
      subjectName: (form.subjectName || '').toString().trim().toUpperCase(),
      category: (form.category || 'academic').toString().trim().toLowerCase(),
      isActive: form.isActive === false ? false : true,
    };

    const endpoint = this.formMode === 'create' ? 'subject/create' : 'subject/update';
    if (this.formMode === 'edit') payload.subjectId = this.editingRecId;

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
              ? 'Subject created successfully'
              : 'Subject updated successfully'
          );

          this.showForm = false;
          this.loadSubjects({ page: 1, pageSize: 10 });
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
    this.deleteMessage = `Are you sure you want to delete "${row.subjectName}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean) {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;

    const payload = { entiId: this.entiId, subjectId: this.deleteTarget.recId };

    this.commonApi.fetchData(payload, this.moduleName, 'subject/delete').subscribe({
      next: (res: any) => {
        if (res?.status === false) {
          this.alert.error(res?.message || 'Delete failed');
          return;
        }
        this.alert.success('Subject deleted successfully');
        this.loadSubjects({ page: 1, pageSize: 10 });
      },
      error: (err: any) => this.alert.error(err?.error?.message || 'Delete failed'),
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
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];

        const mapped = rawRows.map((r: any, idx: number) => this.mapExcelRow(r, idx + 2));

        // duplicates inside file by Subject Name
        const seen = new Set<string>();
        for (const row of mapped) {
          const key = String(row.subjectName || '').trim().toUpperCase();
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

    const allowedCats = ['academic', 'aptitude', 'language', 'other'];

    const subjectNameRaw = get('Subject Name', 'SubjectName', 'subjectName');
    const subjectName = (subjectNameRaw || '').trim().toUpperCase();

    const subjectCodeRaw = get('Subject Code', 'SubjectCode', 'subjectCode');
    const subjectCode = (subjectCodeRaw || '').trim() || null;

    const catRaw = get('Category', 'category');
    const category = (catRaw || 'academic').toString().trim().toLowerCase();

    const statusRaw = get('Status', 'status');
    const statusNorm = (statusRaw || '').toString().trim().toLowerCase();
    const status =
      statusNorm === 'inactive' ? 'Inactive' : 'Active';

    const errors: string[] = [];

    if (!subjectName) errors.push('Subject Name required');
    if (subjectCode && !/^[A-Za-z0-9-]{2,10}$/.test(subjectCode)) errors.push('Invalid Code');
    if (!allowedCats.includes(category)) errors.push('Invalid Category');
    if (statusNorm && statusNorm !== 'active' && statusNorm !== 'inactive') errors.push('Invalid Status');

    return {
      _rowNo: rowNo,
      _valid: errors.length === 0,
      _errors: errors,
      subjectName,
      subjectCode,
      category,
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
      subjectName: r.subjectName,
      subjectCode: r.subjectCode,
      category: r.category,
      isActive: r.status === 'Active',
    }));

    const payload = {
      entiId: this.entiId,
      subjects: rows,
    };

    this.commonApi
      .fetchData(payload, this.moduleName, 'subject/import')
      .pipe(finalize(() => (this.importing = false)))
      .subscribe({
        next: (res: any) => {
          const inserted = res?.insertedCount;
          const skipped = res?.skippedCount;

          if (inserted !== undefined) {
            this.alert.success(`Import completed. Inserted: ${inserted}, Skipped: ${skipped || 0}`);
          } else {
            this.alert.success('Import completed');
          }

          this.closeImport();
          this.loadSubjects({ page: 1, pageSize: 10 });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Import failed'),
      });
  }

  downloadSampleExcel() {
    const rows = [
      { 'Subject Name': 'PHYSICS', 'Subject Code': 'PHY', Category: 'academic', Status: 'Active' },
      { 'Subject Name': 'MATHS', 'Subject Code': 'MATH', Category: 'aptitude', Status: 'Active' },
      { 'Subject Name': 'ENGLISH', 'Subject Code': 'ENG', Category: 'language', Status: 'Active' },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Subjects');
    XLSX.writeFile(wb, 'Subject_Import_Sample.xlsx');
  }
}