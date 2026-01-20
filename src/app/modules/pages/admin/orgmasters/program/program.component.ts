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
  styleUrl: './program.component.scss',
})
export class ProgramComponent implements OnInit {
  programForm!: FormGroup;

  totalRecords = 0;

  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingRecId: string | null = null;
  showView = false;
  viewData: any | null = null;
  subjectOptions: any[] = [];
  private subjectByCode = new Map<string, any>();
  private subjectByName = new Map<string, any>();
  private existingSubjectIds = new Set<string>();
  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';
  entiId: any;
  showImport = false;
  importMode: ImportMode = 'upsert';
  importFileName = '';
  importPreviewRows: any[] = [];
  importHasInvalidRows = false;
  importInvalidCount = 0;
  programData: any[] = [];
  private moduleName = 'ims';
  columns = [
    { key: 'name', label: 'Program Name', sortable: true },
    { key: 'code', label: 'Code', sortable: false },
    { key: 'stream', label: 'Stream', sortable: true },
    { key: 'eligibleToClass', label: 'Eligible Class', sortable: true },
    { key: 'duration', label: 'Duration', sortable: true },
    { key: 'startingClass', label: 'Start Class', sortable: true },
    { key: 'version', label: 'Version', sortable: true },
    { key: 'subjects', label: 'Subjects', sortable: false },
    { key: 'isActive', label: 'Active', sortable: false },
  ];
  streamOptions = [
    { label: 'JEE', value: 'JEE' },
    { label: 'NEET', value: 'NEET' },
    { label: 'Foundation', value: 'Foundation' },
  ];
  durationOptions = [1, 2, 3, 4, 5, 6].map((n) => ({
    label: String(n),
    value: n,
  }));
  eligibleClassOptions = Array.from({ length: 9 }, (_, i) => 5 + i).map(
    (n) => ({ label: String(n), value: n }),
  );
  startingClassOptions = Array.from({ length: 8 }, (_, i) => 5 + i).map(
    (n) => ({ label: String(n), value: n }),
  );
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
    private commonApi: CommonapiService,
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Programs' },
    ]);
  }

  ngOnInit(): void {
    this.initForm();
    this.loadMasters();
    this.bindDerivedFields();
    this.loadPrograms({ page: 1, pageSize: 10 });
  }

  // ---------------- FORM ----------------
  initForm() {
    this.programForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', [Validators.required, this.csvCodesValidator]],
      stream: ['', Validators.required],

      // ✅ numeric fields
      eligibleToClass: [
        null,
        [Validators.required, Validators.min(5), Validators.max(13)],
      ],
      startingClass: [
        null,
        [Validators.required, Validators.min(5), Validators.max(13)],
      ],
      duration: [
        null,
        [Validators.required, Validators.min(1), Validators.max(6)],
      ],
      endingClass: [{ value: null, disabled: true }], // computed display

      version: ['', Validators.required],

      // ✅ subjects array (checkboxes)
      subjects: [[]],

      isActive: [true],
    });
  }

  private bindDerivedFields() {
    const startCtrl = this.programForm.get('startingClass');
    const durCtrl = this.programForm.get('duration');
    const endCtrl = this.programForm.get('endingClass');

    const compute = () => {
      const start = this.toNum(startCtrl?.value);
      const dur = this.toNum(durCtrl?.value);
      if (!start || !dur) {
        endCtrl?.setValue(null, { emitEvent: false });
        return;
      }
      const end = start + dur - 1;
      endCtrl?.setValue(end, { emitEvent: false });
    };

    startCtrl?.valueChanges.subscribe(() => compute());
    durCtrl?.valueChanges.subscribe(() => compute());

    // initial compute
    compute();
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

  // ---------------- MASTERS ----------------
  private loadMasters() {
    this.commonApi
      .fetchData(
        { entiId: this.entiId },
        this.moduleName,
        `subject/list?list=full`,
      )
      .subscribe({
        next: (res: any) => {
          const rows = res?.data || [];
          this.subjectOptions = rows.map((s: any) => ({
            label: s.subjectName,
            value: s._id,
            code: (s.subjectCode || '').toString(),
          }));

          // build lookup maps for import validation (UPPER compare)
          this.subjectByCode.clear();
          this.subjectByName.clear();
          this.subjectOptions.forEach((s: any) => {
            const code = this.normKey(s.code);
            const name = this.normKey(s.label);
            if (code) this.subjectByCode.set(code, s);
            if (name) this.subjectByName.set(name, s);
          });
        },
        error: () => {
          this.subjectOptions = [];
          this.subjectByCode.clear();
          this.subjectByName.clear();
        },
      });
  }

  // ---------------- CHECKBOX SUBJECTS ----------------
  isSubjectChecked(subjectId: string): boolean {
    const list = (this.programForm.get('subjects')?.value || []) as any[];
    return list.some((x: any) => String(x) === String(subjectId));
  }

  toggleSubject(subjectId: string, checked: boolean) {
    const ctrl = this.programForm.get('subjects');
    const list = Array.isArray(ctrl?.value) ? [...ctrl!.value] : [];
    const id = String(subjectId);

    const exists = list.some((x: any) => String(x) === id);
    if (checked && !exists) list.push(id);
    if (!checked && exists) {
      const next = list.filter((x: any) => String(x) !== id);
      ctrl?.setValue(next);
      ctrl?.markAsDirty();
      return;
    }
    ctrl?.setValue(list);
    ctrl?.markAsDirty();
  }

  // ✅ separate method: add only new subjects to current program
  addSubjectsToCurrentProgram() {
    if (!this.editingRecId) return;

    const selected = (this.programForm.get('subjects')?.value ||
      []) as string[];
    const toAdd = selected.filter(
      (x) => !this.existingSubjectIds.has(String(x)),
    );

    if (!toAdd.length) {
      this.alert.error('No new subjects selected to add');
      return;
    }

    const payload = {
      entiId: this.entiId,
      recId: this.editingRecId,
      subjects: toAdd,
    };

    // ✅ endpoint name: make sure your route maps this to addProgramSubjects()
    this.commonApi
      .fetchData(payload, this.moduleName, 'program/addsubjects')
      .subscribe({
        next: () => {
          toAdd.forEach((x) => this.existingSubjectIds.add(String(x)));
          this.alert.success('Subjects added to program');
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Failed to add subjects'),
      });
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
      startingClass: 'startingClass',
      endingClass: 'endingClass',
      duration: 'duration',
      version: 'version',
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

    this.commonApi
      .fetchData({ entiId: this.entiId }, this.moduleName, `program/list${qp}`)
      .subscribe({
        next: (res: any) => {
          this.totalRecords = res?.count || 0;
          this.programData = (res?.data || []).map((p: any) => ({
            recId: p._id,
            name: p.programName,
            code: p.programCodes || '-',
            stream: p.target || '-',
            eligibleToClass: p.eligibleToClass ?? '-',
            startingClass: p.startingClass ?? '-',
            endingClass: p.endingClass ?? '-',
            duration: p.duration ?? '-',
            version: p.version || '-',
            subjects: Array.isArray(p.subjects) ? p.subjects.length : 0,
            isActive: p.status === 'Active',
            _raw: p,
          }));
        },
        error: () => this.alert.error('Failed to load programs'),
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

  // ---------------- VIEW ----------------
  openView(row: any) {
    const recId = row?.recId || row?._raw?._id;
    if (!recId) return;

    this.commonApi
      .fetchData(
        { entiId: this.entiId, recId },
        this.moduleName,
        'program/view',
      )
      .subscribe({
        next: (res: any) => {
          this.viewData = res?.data || null;
          this.showView = true;
        },
        error: () => this.alert.error('Failed to load program'),
      });
  }

  closeView() {
    this.showView = false;
    this.viewData = null;
  }

  // ---------------- ADD ----------------
  add() {
    this.formMode = 'create';
    this.editingRecId = null;
    this.existingSubjectIds.clear();

    this.programForm.reset({
      name: '',
      code: '',
      stream: '',
      eligibleToClass: null,
      startingClass: null,
      duration: null,
      endingClass: null,
      version: '',
      subjects: [],
      isActive: true,
    });

    this.showForm = true;
  }

  // ---------------- EDIT ----------------
  edit(row: any) {
    const p = row._raw;

    this.formMode = 'edit';
    this.editingRecId = p._id;

    const subs = Array.isArray(p.subjects)
      ? p.subjects
          .map((x: any) => (typeof x === 'string' ? x : x?._id))
          .filter(Boolean)
      : [];

    this.existingSubjectIds = new Set(subs.map((x: any) => String(x)));

    this.programForm.patchValue({
      name: p.programName,
      code: p.programCodes,
      stream: p.target,

      eligibleToClass: this.toNum(p.eligibleToClass),
      startingClass: this.toNum(p.startingClass),
      duration: this.toNum(p.duration),
      endingClass: this.toNum(p.endingClass),

      version: p.version,
      subjects: subs,
      isActive: p.status === 'Active',
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

    // extra derived validations (frontend)
    const start = this.toNum(this.programForm.get('startingClass')?.value);
    const dur = this.toNum(this.programForm.get('duration')?.value);
    const end = start && dur ? start + dur - 1 : 0;
    if (end > 13) {
      this.alert.error(
        'Ending class exceeds max 13. Adjust starting class or duration.',
      );
      return;
    }

    const payload = this.buildPayload(
      this.programForm.getRawValue(),
      this.editingRecId || '',
    );
    const endpoint = this.formMode === 'create' ? 'create' : 'edit';

    this.commonApi
      .fetchData(payload, this.moduleName, `program/${endpoint}`)
      .subscribe({
        next: () => {
          this.alert.success(
            this.formMode === 'create'
              ? 'Program created successfully'
              : 'Program updated successfully',
          );
          this.showForm = false;
          this.loadPrograms({ page: 1, pageSize: 10 });
        },
        error: (err: any) => {
          const msg = err?.error?.message || 'Operation failed';
          this.alert.error(msg);
        },
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

    this.commonApi
      .fetchData(payload, this.moduleName, 'program/delete')
      .subscribe({
        next: () => {
          this.alert.success('Program deleted successfully');
          this.loadPrograms({ page: 1, pageSize: 10 });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Delete failed'),
      });

    this.deleteTarget = null;
  }

  // ---------------- PAYLOAD BUILDER ----------------
  private buildPayload(form: any, recId?: string) {
    const subjects = Array.isArray(form.subjects)
      ? form.subjects.map((x: any) => String(x)).filter(Boolean)
      : [];

    return {
      entiId: this.entiId,
      ...(recId ? { recId } : {}),
      eligibleToClass: this.toNum(form.eligibleToClass),
      startingClass: this.toNum(form.startingClass),
      duration: this.toNum(form.duration),

      programName: form.name,
      programCodes: form.code, // CSV string
      target: form.stream, // backend target
      version: form.version,

      subjects, // ✅ array

      status: form.isActive ? 'Active' : 'Inactive',
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
    this.importMode = 'upsert'; // ✅ fixed
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
          this.mapExcelRow(r, idx + 2),
        ); // +2 header line
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
    const excelIdStr = get('ID', 'Id', 'id');
    const excelId = excelIdStr ? Number(excelIdStr) : null;
    const programName = get('Program Name', 'ProgramName', 'programName');
    const eligibleToClass = this.toNum(
      get('Eligible Class', 'EligibleClass', 'eligibleToClass'),
    );
    const startingClass = this.toNum(
      get('Starting Class', 'Start Class', 'startingClass'),
    );
    const duration = this.toNum(get('Duration', 'duration'));
    const programCodes = get('Program Code', 'ProgramCode', 'programCodes');
    const target = get('Target', 'Stream', 'target');
    const version = get('Program Version', 'ProgramVersion', 'version');
    const programType = get('Program Type', 'ProgramType', 'programType');
    const subjectsRaw = get('Subjects', 'Subject', 'subjects', 'subject');
    const statusRaw = get('Status', 'status');
    const status = statusRaw === 'Inactive' ? 'Inactive' : 'Active';
    const errors: string[] = [];
    if (!programName) errors.push('Program Name required');
    if (!eligibleToClass) errors.push('Eligible Class required');
    if (eligibleToClass && (eligibleToClass < 5 || eligibleToClass > 13))
      errors.push('Eligible Class must be 5..13');
    if (!startingClass) errors.push('Starting Class required');
    if (startingClass && (startingClass < 5 || startingClass > 13))
      errors.push('Starting Class must be 5..13');
    if (!duration) errors.push('Duration required');
    if (duration && (duration < 1 || duration > 6))
      errors.push('Duration must be 1..6');
    const endingClass =
      startingClass > 0 && duration > 0 ? startingClass + duration - 1 : 0;
    if (endingClass && endingClass > 13)
      errors.push('Calculated endingClass exceeds 13');
    if (!programCodes) errors.push('Program Code required');
    const codeParts = (programCodes || '')
      .split(',')
      .map((x) => (x || '').trim())
      .filter(Boolean);
    if (!codeParts.length) errors.push('Program Code invalid');
    const subjectTokens = this.splitCsv(subjectsRaw);
    const subjectIds: string[] = [];
    if (subjectTokens.length) {
      const missing: string[] = [];
      for (const tok of subjectTokens) {
        const key = this.normKey(tok);
        const hit = this.subjectByCode.get(key) || this.subjectByName.get(key);
        if (!hit) missing.push(tok);
        else subjectIds.push(String(hit.value));
      }
      if (missing.length)
        errors.push(`Invalid subjects: ${missing.join(', ')}`);
    }
    return {
      _rowNo: rowNo,
      _valid: errors.length === 0,
      _errors: errors,
      excelId: Number.isFinite(excelId as any) ? excelId : null,
      programName,
      eligibleToClass,
      startingClass,
      endingClass: endingClass || null,
      duration,
      programCodes,
      target: target || null,
      version,
      programType: programType || null,
      subjectsRaw,
      subjects: Array.from(new Set(subjectIds)),
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
      excelId: r.excelId ?? null,
      programName: r.programName,
      eligibleToClass: r.eligibleToClass,
      startingClass: r.startingClass,
      duration: r.duration,
      endingClass: r.endingClass ?? null,
      programCodes: r.programCodes,
      target: r.target,
      version: r.version,
      programType: r.programType,
      subjects: r.subjects || [],
      status: r.status,
    }));
    const payload = {
      entiId: this.entiId,
      mode: 'upsert',
      rows,
    };
    this.commonApi
      .fetchData(payload, this.moduleName, 'program/import')
      .subscribe({
        next: () => {
          this.alert.success('Import completed');
          this.closeImport();
          this.loadPrograms({ page: 1, pageSize: 10 });
        },
        error: (err: any) => {
          const msg = err?.error?.message || 'Import failed';
          this.alert.error(msg);
        },
      });
  }

  downloadSampleExcel() {
    const rows = [
      {
        ID: 1,
        'Program Name': 'ARISE - One Year Foundation',
        'Eligible Class': 10,
        'Starting Class': 9,
        Duration: 2,
        Target: 'Foundation',
        'Program Version': 'Special Sunday / Regular',
        'Program Code': 'C6053',
        Subjects: 'MATHS, PHYSICS',
        Status: 'Active',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Programs');
    XLSX.writeFile(wb, 'Program_Import_Sample.xlsx');
  }

  // ---------------- HELPERS ----------------
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

  private splitCsv(v: any): string[] {
    const s = (v === null || v === undefined ? '' : String(v)).trim();
    if (!s) return [];
    return s
      .split(',')
      .map((x) => String(x || '').trim())
      .filter(Boolean);
  }

  private normKey(v: any): string {
    return (v === null || v === undefined ? '' : String(v))
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
  }
}
