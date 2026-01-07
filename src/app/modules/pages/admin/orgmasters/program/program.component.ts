import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';
import * as XLSX from 'xlsx';

type ImportMode = 'insert' | 'upsert';

@Component({
  selector: 'app-program',
  standalone: false,
  templateUrl: './program.component.html',
  styleUrl: './program.component.scss'
})
export class ProgramComponent implements OnInit {
  programForm!: FormGroup;

  totalRecords = 0;

  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingRecId: string | null = null;

  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';

  entiId: any;

  // Import modal state
  showImport = false;
  importMode: ImportMode = 'upsert';
  importFileName = '';
  importPreviewRows: any[] = [];
  importHasInvalidRows = false;
  importInvalidCount = 0;

  // list table state
  programData: any[] = [];

  // module name for API (keep consistent with your backend route)
  private moduleName = 'ims/program';

  // ✅ table columns aligned with new model
  columns = [
    { key: 'name', label: 'Program Name', sortable: true },
    { key: 'code', label: 'Code', sortable: false },
    { key: 'stream', label: 'Stream', sortable: true },
    { key: 'eligibleToClass', label: 'Eligible To Class', sortable: true },
    { key: 'duration', label: 'Duration', sortable: true },
    { key: 'version', label: 'Version', sortable: true },
    { key: 'isActive', label: 'Active', sortable: false }
  ];

  streamOptions = [
    { label: 'JEE', value: 'JEE' },
    { label: 'NEET', value: 'NEET' },
    { label: 'Foundation', value: 'Foundation' }
  ];

  durationOptions = [
    { label: '2 Years', value: '2 Years' },
    { label: '1 Year', value: '1 Year' },
    { label: 'Crash Course', value: 'Crash Course' }
  ];

  studentBandOptions = [
    { label: 'Class 5', value: 'Class 5th' },
    { label: 'Class 6', value: 'Class 6th' },
    { label: 'Class 7', value: 'Class 7th' },
    { label: 'Class 8', value: 'Class 8th' },
    { label: 'Class 9', value: 'Class 9th' },
    { label: 'Class 10', value: 'Class 10th' },
    { label: 'Class 11', value: 'Class 11th' }
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      callback: (row: any) => this.edit(row)
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      tooltip: 'Delete',
      callback: (row: any) => this.openDelete(row)
    }
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
      { label: 'Programs' }
    ]);
  }

  ngOnInit(): void {
    this.initForm();
    this.loadPrograms({ page: 1, pageSize: 10 });
  }

  // ---------------- FORM ----------------
  initForm() {
    this.programForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', [Validators.required, this.csvCodesValidator]],
      stream: ['', Validators.required],
      duration: [null, Validators.required],
      eligibleToClass: ['', Validators.required],
      version: ['', Validators.required],
      isActive: [true]
    });
  }

  // CSV validator: must contain at least one non-empty token
  private csvCodesValidator(control: any) {
    const raw = (control?.value || '').toString();
    const parts = raw
      .split(',')
      .map((x: string) => (x || '').trim())
      .filter(Boolean);
    return parts.length ? null : { csvInvalid: true };
  }

  // ---------------- LIST ----------------
  loadPrograms(event?: {
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
      name: 'programName',
      stream: 'target',
      eligibleToClass: 'eligibleToClass',
      duration: 'duration',
      version: 'version'
    };
    const sortKey = event?.sortKey ? sortMap[event.sortKey] : null;
    const sort = sortKey ? (event?.sortDirection === 'asc' ? sortKey : `-${sortKey}`) : '';
    const qp = this.buildQueryParams({
      page,
      limit,
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {})
    });
    this.commonApi.fetchData({ entiId: this.entiId }, this.moduleName, `list${qp}`).subscribe({
      next: (res: any) => {
        this.totalRecords = res?.count || 0;

        this.programData = (res?.data || []).map((p: any) => ({
          recId: p._id,
          name: p.programName,
          code: p.programCodes || '-',
          stream: p.target || '-',
          eligibleToClass: p.eligibleToClass || '-',
          duration: p.duration || '-',
          version: p.version || '-',
          isActive: p.status === 'Active',
          _raw: p
        }));
      },
      error: () => this.alert.error('Failed to load programs')
    });
  }

  private buildQueryParams(params: Record<string, any>) {
    const keys = Object.keys(params || {}).filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '');
    if (!keys.length) return '';
    const qs = keys
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`)
      .join('&');
    return `?${qs}`;
  }

  // ---------------- ADD ----------------
  add() {
    this.formMode = 'create';
    this.editingRecId = null;
    this.programForm.reset({
      name: '',
      code: '',
      stream: '',
      duration: null,
      eligibleToClass: '',
      version: '',
      isActive: true
    });
    this.showForm = true;
  }

  // ---------------- EDIT ----------------
  edit(row: any) {
    const p = row._raw;

    this.formMode = 'edit';
    this.editingRecId = p._id;

    this.programForm.patchValue({
      name: p.programName,
      code: p.programCodes,
      stream: p.target,
      duration: p.duration,
      eligibleToClass: p.eligibleToClass,
      version: p.version,
      isActive: p.status === 'Active'
    });

    this.showForm = true;
  }

  // ---------------- SAVE ----------------
  save() {
    if (this.programForm.invalid) {
      this.programForm.markAllAsTouched();
      this.alert.error('Please fill all required fields');
      return;
    }
    const payload = this.buildPayload(this.programForm.value, this.editingRecId || '');

    const endpoint = this.formMode === 'create' ? 'create' : 'edit';

    this.commonApi.fetchData(payload, this.moduleName, endpoint).subscribe({
      next: (res: any) => {
        this.alert.success(this.formMode === 'create' ? 'Program created successfully' : 'Program updated successfully');
        this.showForm = false;
        this.loadPrograms({ page: 1, pageSize: 10 });
      },
      error: (err: any) => {
        const msg = err?.error?.message || 'Operation failed';
        this.alert.error(msg);
      }
    });
  }

  cancel() {
    this.showForm = false;
  }

  // ---------------- DELETE ----------------
  openDelete(row: any) {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete "${row.name}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean) {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;

    const payload = { entiId: this.entiId, recId: this.deleteTarget.recId };

    this.commonApi.fetchData(payload, this.moduleName, 'delete').subscribe({
      next: () => {
        this.alert.success('Program deleted successfully');
        this.loadPrograms({ page: 1, pageSize: 10 });
      },
      error: (err: any) => this.alert.error(err?.error?.message || 'Delete failed')
    });

    this.deleteTarget = null;
  }

  // ---------------- PAYLOAD BUILDER ----------------
  private buildPayload(form: any, recId?: string) {
    return {
      entiId: this.entiId,
      ...(recId ? { recId } : {}),
      eligibleToClass: form.eligibleToClass,
      programName: form.name,
      programCodes: form.code,        // CSV string
      target: form.stream,            // maps to backend target
      duration: form.duration,
      version: form.version,
      status: form.isActive ? 'Active' : 'Inactive'
    };
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
    this.importMode = 'upsert';
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
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];

        const mapped = rawRows.map((r: any, idx: number) => this.mapExcelRow(r, idx + 2)); // +2 header line
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
    // Accept common header variations
    const get = (...keys: string[]) => {
      for (const k of keys) {
        if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') return String(r[k]).trim();
      }
      return '';
    };

    const excelIdStr = get('ID', 'Id', 'id');
    const excelId = excelIdStr ? Number(excelIdStr) : null;

    const programName = get('Program Name', 'ProgramName', 'programName');
    const eligibleToClass = get('Eligible Class', 'EligibleClass', 'eligibleToClass');
    const programCodes = get('Program Code', 'ProgramCode', 'programCodes');
    const target = get('Target', 'Stream', 'target');
    const duration = get('Duration', 'duration');
    const version = get('Program Version', 'ProgramVersion', 'version');
    const programType = get('Program Type', 'ProgramType', 'programType');
    const statusRaw = get('Status', 'status');

    const status = statusRaw === 'Inactive' ? 'Inactive' : 'Active';

    // validation
    const errors: string[] = [];
    if (!programName) errors.push('Program Name required');
    if (!eligibleToClass) errors.push('Eligible Class required');
    if (!programCodes) errors.push('Program Code required');
    if (!version) errors.push('Version required');

    const parts = (programCodes || '')
      .split(',')
      .map((x) => (x || '').trim())
      .filter(Boolean);
    if (!parts.length) errors.push('Program Code invalid');

    return {
      _rowNo: rowNo,
      _valid: errors.length === 0,
      _errors: errors,

      excelId: Number.isFinite(excelId as any) ? excelId : null,
      programName,
      eligibleToClass,
      programCodes,
      target: target || null,
      duration: duration || null,
      version,
      programType: programType || null,
      status
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
      excelId: r.excelId ?? null,
      programName: r.programName,
      eligibleToClass: r.eligibleToClass,
      programCodes: r.programCodes,
      target: r.target,
      duration: r.duration,
      version: r.version,
      programType: r.programType,
      status: r.status
    }));
    const payload = {
      entiId: this.entiId,
      mode: this.importMode,
      rows
    };

    this.commonApi.fetchData(payload, this.moduleName, 'import').subscribe({
      next: (res: any) => {
        const inserted = res?.summary?.inserted;
        const upserted = res?.summary?.upserted;
        if (inserted !== undefined) this.alert.success(`Import completed. Inserted: ${inserted}`);
        else if (upserted !== undefined) this.alert.success(`Import completed. Upserted: ${upserted}`);
        else this.alert.success('Import completed');
        this.closeImport();
        this.loadPrograms({ page: 1, pageSize: 10 });
      },
      error: (err: any) => {
        const msg = err?.error?.message || 'Import failed';
        this.alert.error(msg);
      }
    });
  }

  downloadSampleExcel() {
    const rows = [
      {
        ID: 1,
        'Program Name': 'ARISE - One Year Foundation',
        'Eligible Class': 'Class 10th',
        'Program Type': 'CRP',
        Duration: '1 Year',
        Target: 'Foundation',
        'Program Version': 'Special Sunday / Regular',
        'Program Code': 'C6053, M6053, U6053',
        Status: 'Active'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Programs');
    XLSX.writeFile(wb, 'Program_Import_Sample.xlsx');
  }
}