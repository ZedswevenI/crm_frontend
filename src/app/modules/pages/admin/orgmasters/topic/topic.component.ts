import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { finalize } from 'rxjs/operators';
import { AlertService } from '../../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';
@Component({
  selector: 'app-topic',
  standalone: false,
  templateUrl: './topic.component.html',
  styleUrl: './topic.component.scss',
})
export class TopicComponent implements OnInit {
  private moduleName = 'ims';
  entiId: any;

  form!: FormGroup;

  subjectOptions: any[] = [];
  private subjectById = new Map<string, any>();
  private subjectNameToId = new Map<string, string>();
  private subjectCodeToId = new Map<string, string>();

  classOptions = Array.from({ length: 8 }, (_, i) => 6 + i).map((n) => ({
    label: String(n),
    value: n,
  }));

  loading = false;
  totalRecords = 0;
  tableData: any[] = [];

  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  saving = false;

  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';

  // Add Sub-Topic from Topic
  showSubtopicForm = false;
  subtopicParent: any = null;
  subtopicForm!: FormGroup;
  savingSubtopics = false;

  // import
  showImport = false;
  importFileName = '';
  importPreviewRows: any[] = [];
  importHasInvalidRows = false;
  importInvalidCount = 0;
  importGroupCount = 0;
  importing = false;

  columns = [
    { key: 'classNo', label: 'Class', sortable: true },
    { key: 'subjectName', label: 'Subject', sortable: true },
    { key: 'topicName', label: 'Topic', sortable: true },
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-solid fa-layer-group',
      tooltip: 'Add Sub-Topics',
      callback: (r: any) => this.openAddSubtopic(r),
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-pen-to-square',
      tooltip: 'Edit',
      callback: (r: any) => this.edit(r),
    },
    {
      type: 'icon',
      icon: 'fa-regular fa-trash-can',
      tooltip: 'Delete',
      callback: (r: any) => this.openDelete(r),
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
      { label: 'Org Configs' },
      { label: 'Topics' },
    ]);
  }

  ngOnInit(): void {
    this.initForm();
    this.loadSubjects();
  }

  // ---------------- FORM ---------------------
  private initForm() {
    this.form = this.fb.group({
      classNo: [null, Validators.required],
      subjectId: [null, Validators.required],
      topicId: [null], // only for edit
      topicName: ['', [Validators.required, Validators.maxLength(120)]],
      topicCode: ['', [Validators.maxLength(30)]],
      sortOrder: [0],
    });
  }

  // ---------------- SUBJECT LIST ---------------------
  private loadSubjects() {
    this.commonApi
      .fetchData(
        { entiId: this.entiId },
        this.moduleName,
        `subject/list?list=full`,
      )
      .subscribe({
        next: (res: any) => {
          const rows = Array.isArray(res?.data) ? res.data : [];

          this.subjectOptions = rows.map((s: any) => ({
            label: s.subjectName,
            value: s._id,
          }));

          this.subjectById.clear();
          this.subjectNameToId.clear();
          this.subjectCodeToId.clear();

          for (const s of rows) {
            const id = String(s._id || '');
            this.subjectById.set(id, s);

            const nm = String(s.subjectName || '')
              .trim()
              .toUpperCase();
            const cd = String(s.subjectCode || '')
              .trim()
              .toUpperCase();

            if (nm) this.subjectNameToId.set(nm, id);
            if (cd) this.subjectCodeToId.set(cd, id);
          }
        },
        error: () => {
          this.subjectOptions = [];
          this.subjectById.clear();
          this.subjectNameToId.clear();
          this.subjectCodeToId.clear();
        },
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

  // ---------------- LISTING ---------------------
  fetchTableData(event?: {
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
      classNo: 'classNo',
      subjectName: 'subjectId', // backend sorts on fields; we keep stable
      topicName: 'topicName',
      sortOrder: 'sortOrder',
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

    this.loading = true;

    this.commonApi
      .fetchData({ entiId: this.entiId }, this.moduleName, `topic/list${qp}`)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: any) => {
          const rows = Array.isArray(res?.data) ? res.data : [];
          this.totalRecords = res?.count || 0;

          this.tableData = rows.map((x: any) => {
            // backend listTopics populates subjectId sometimes
            const subjObj =
              x?.subjectId && typeof x.subjectId === 'object'
                ? x.subjectId
                : null;
            const subjectId = subjObj
              ? String(subjObj?._id || '')
              : String(x.subjectId || '');

            const subjectName =
              subjObj?.subjectName ||
              this.subjectById.get(subjectId)?.subjectName ||
              '-';

            return {
              recId: x._id,
              topicId: x.topicId,
              classNo: x.classNo,
              subjectId: subjectId,
              subjectName,
              topicName: x.topicName,
              topicCode: x.topicCode || '-',
              sortOrder: x.sortOrder ?? 0,
              _raw: x,
            };
          });
        },
        error: () => this.alert.error('Failed to load topics'),
      });
  }

  // ---------------- ADD ---------------------
  add() {
    this.formMode = 'create';
    this.form.reset({
      classNo: null,
      subjectId: null,
      topicId: null,
      topicName: '',
      topicCode: '',
      sortOrder: 0,
    });
    this.showForm = true;
    this.deleteTarget = null;
  }

  // ---------------- EDIT ---------------------
  edit(row: any) {
    const x = row?._raw || row;

    const subjObj =
      x?.subjectId && typeof x.subjectId === 'object' ? x.subjectId : null;
    const subjectId = subjObj
      ? String(subjObj?._id || '')
      : String(x.subjectId || '');

    this.formMode = 'edit';

    this.form.patchValue({
      classNo: x.classNo,
      subjectId: subjectId,
      topicId: x.topicId, // IMPORTANT: backend updateTopic uses topicId
      topicName: x.topicName,
      topicCode: x.topicCode || '',
      sortOrder: x.sortOrder ?? 0,
    });

    this.deleteTarget = {
      classNo: x.classNo,
      subjectId: subjectId,
      topicId: x.topicId,
      topicName: x.topicName,
    };

    this.showForm = true;
  }

  // ---------------- SAVE ---------------------
  save() {
    if (this.saving) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.alert.error('Please fill required fields');
      return;
    }

    const v = this.form.value || {};
    const payload: any = {
      entiId: this.entiId,
      userId: localStorage.getItem('userId') || '',
      classNo: v.classNo,
      subjectId: v.subjectId,
      topicName: (v.topicName || '').toString().trim(),
      topicCode: (v.topicCode || '').toString().trim() || null,
      sortOrder: Number(v.sortOrder || 0),
    };

    // endpoint choose
    const endpoint =
      this.formMode === 'create' ? 'topic/create' : 'topic/update';
    if (this.formMode === 'edit') payload.topicId = v.topicId;

    this.saving = true;

    this.commonApi
      .fetchData(payload, this.moduleName, endpoint)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (res: any) => {
          if (res?.status === false) {
            this.alert.error(res?.message || 'Save failed');
            return;
          }
          this.alert.success(
            this.formMode === 'create' ? 'Topic created' : 'Topic updated',
          );
          this.showForm = false;
          this.fetchTableData({ page: 1, pageSize: 10 });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Save failed'),
      });
  }

  // ---------------- DELETE ---------------------
  openDelete(row: any) {
    const x = row?._raw || row;

    const subjObj =
      x?.subjectId && typeof x.subjectId === 'object' ? x.subjectId : null;
    const subjectId = subjObj
      ? String(subjObj?._id || '')
      : String(x.subjectId || '');

    this.deleteTarget = {
      classNo: x.classNo,
      subjectId: subjectId,
      topicId: x.topicId,
      topicName: x.topicName,
    };

    this.deleteMessage = `Are you sure you want to delete "${x.topicName}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean) {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;

    const payload = {
      entiId: this.entiId,
      userId: localStorage.getItem('userId') || '',
      classNo: this.deleteTarget.classNo,
      subjectId: this.deleteTarget.subjectId,
      topicId: this.deleteTarget.topicId,
    };

    this.commonApi
      .fetchData(payload, this.moduleName, 'topic/delete')
      .subscribe({
        next: (res: any) => {
          if (res?.status === false) {
            this.alert.error(res?.message || 'Delete failed');
            return;
          }
          this.alert.success('Topic deleted');
          this.fetchTableData({ page: 1, pageSize: 10 });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Delete failed'),
      });

    this.deleteTarget = null;
  }

  cancel() {
    if (this.saving) return;
    this.showForm = false;
  }

  // ============== ADD SUB-TOPICS FROM TOPIC ==============
  get subtopicRows(): FormArray {
    return this.subtopicForm?.get('rows') as FormArray;
  }

  private createSubtopicRow(): FormGroup {
    return this.fb.group({
      subTopicName: ['', [Validators.required, Validators.maxLength(140)]],
      subTopicCode: ['', [Validators.maxLength(30)]],
      sortOrder: [0],
    });
  }

  openAddSubtopic(row: any) {
    this.subtopicParent = {
      classNo: row.classNo,
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      topicId: row.topicId,
      topicName: row.topicName,
    };
    this.subtopicForm = this.fb.group({
      rows: this.fb.array([this.createSubtopicRow()]),
    });
    this.showSubtopicForm = true;
  }

  addSubtopicRow(): void {
    this.subtopicRows.push(this.createSubtopicRow());
  }

  removeSubtopicRow(index: number): void {
    if (this.subtopicRows.length > 1) {
      this.subtopicRows.removeAt(index);
    }
  }

  cancelSubtopic(): void {
    if (this.savingSubtopics) return;
    this.showSubtopicForm = false;
    this.subtopicParent = null;
  }

  saveSubtopics(): void {
    if (this.savingSubtopics) return;
    if (this.subtopicRows.invalid) {
      this.subtopicRows.markAllAsTouched();
      this.alert.error('Fill Sub-Topic Name for all rows');
      return;
    }

    const rows = this.subtopicRows.value || [];
    if (!rows.length) return;

    const p = this.subtopicParent;
    this.savingSubtopics = true;
    let completed = 0;
    let failed = 0;

    for (const row of rows) {
      const payload = {
        entiId: this.entiId,
        userId: localStorage.getItem('userId') || '',
        classNo: p.classNo,
        subjectId: p.subjectId,
        topicId: p.topicId,
        subTopicName: (row.subTopicName || '').toString().trim(),
        subTopicCode: (row.subTopicCode || '').toString().trim() || null,
        sortOrder: Number(row.sortOrder || 0),
      };
      this.commonApi.fetchData(payload, this.moduleName, 'subtopic/create').subscribe({
        next: (res: any) => {
          completed++;
          if (res?.status === false) failed++;
          this.checkSubtopicCompletion(rows.length, completed, failed);
        },
        error: () => {
          completed++;
          failed++;
          this.checkSubtopicCompletion(rows.length, completed, failed);
        },
      });
    }
  }

  private checkSubtopicCompletion(total: number, completed: number, failed: number): void {
    if (completed < total) return;
    this.savingSubtopics = false;
    const success = total - failed;
    if (success > 0) {
      this.alert.success(`${success} sub-topic(s) created${failed > 0 ? `, ${failed} failed` : ''}`);
    } else {
      this.alert.error('All sub-topic creations failed');
    }
    this.showSubtopicForm = false;
    this.subtopicParent = null;
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
    this.importGroupCount = 0;
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

        const mapped = rawRows.map((r: any, idx: number) =>
          this.mapExcelRow(r, idx + 2),
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

    const classRaw = get('Class', 'classNo', 'ClassNo');
    const classNo = Number(String(classRaw || '').trim());

    const subjectRaw = get('Subject', 'Subject Name', 'SubjectName', 'subject');
    const subjectCodeRaw = get('Subject Code', 'SubjectCode', 'subjectCode');

    const topicNameRaw = get('Topic Name', 'TopicName', 'topicName');
    const topicCode = get('Topic Code', 'TopicCode', 'topicCode') || null;

    const sortRaw = get('Sort Order', 'SortOrder', 'sortOrder');
    const sortOrder =
      sortRaw === '' || sortRaw === null || sortRaw === undefined
        ? 0
        : Number(String(sortRaw).trim());

    const errors: string[] = [];

    if (!Number.isFinite(classNo) || classNo < 6 || classNo > 13)
      errors.push('Invalid Class (6..13)');

    const subjNameKey = String(subjectRaw || '')
      .trim()
      .toUpperCase();
    const subjCodeKey = String(subjectCodeRaw || '')
      .trim()
      .toUpperCase();

    let subjectId: string | null = null;
    if (subjCodeKey && this.subjectCodeToId.has(subjCodeKey))
      subjectId = this.subjectCodeToId.get(subjCodeKey) || null;
    else if (subjNameKey && this.subjectNameToId.has(subjNameKey))
      subjectId = this.subjectNameToId.get(subjNameKey) || null;

    if (!subjectId) errors.push('Subject not found');

    const topicName = String(topicNameRaw || '').trim();
    if (!topicName) errors.push('Topic Name required');

    if (sortOrder !== 0 && !Number.isFinite(sortOrder))
      errors.push('Invalid Sort Order');

    const subjectLabel =
      (subjCodeKey ? subjCodeKey : '') ||
      (subjNameKey ? subjNameKey : '') ||
      '-';

    return {
      _rowNo: rowNo,
      _valid: errors.length === 0,
      _errors: errors,

      classNo: Number.isFinite(classNo) ? classNo : classRaw,
      subjectId,
      subjectLabel,
      topicName,
      topicCode: topicCode ? String(topicCode).trim() : null,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    };
  }

  private computeImportValidation() {
    const invalid = (this.importPreviewRows || []).filter((x) => !x._valid);
    this.importInvalidCount = invalid.length;
    this.importHasInvalidRows = invalid.length > 0;
    const groups = new Set<string>();
    for (const r of this.importPreviewRows || []) {
      if (r._valid && r.subjectId && r.classNo)
        groups.add(`${r.classNo}::${r.subjectId}`);
    }
    this.importGroupCount = groups.size;
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

    const rows = (this.importPreviewRows || []).map((x) => ({
      classNo: Number(x.classNo),
      subjectId: x.subjectId,
      topicName: (x.topicName || '').toString().trim(),
      topicCode: (x.topicCode || '').toString().trim() || null,
      sortOrder: Number(x.sortOrder || 0),
    }));

    if (!rows.length) {
      this.alert.error('No valid rows to import');
      return;
    }

    const payload = {
      entiId: this.entiId,
      rows,
    };

    this.importing = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'topic/import') 
      .pipe(finalize(() => (this.importing = false)))
      .subscribe({
        next: (res: any) => {
          if (res?.status === false) {
            this.alert.error(res?.message || 'Import failed');
            return;
          }
          const accepted = res?.data?.accepted ?? rows.length;
          const upserted = res?.data?.upserted ?? 0;
          this.alert.success(
            `Import completed (Accepted: ${accepted}, Upserted: ${upserted})`,
          );
          this.importing = false;
           this.showImport = false;
          this.closeImport();
          this.resetImport();
          this.fetchTableData({ page: 1, pageSize: 10 });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Import failed'),
      });
  }

  downloadSampleExcel() {
    const rows = [
      {
        Class: 6,
        Subject: 'MATH',
        'Topic Name': 'Trigonometry',
        'Topic Code': 'TRI',
        'Sort Order': 1,
      },
      {
        Class: 6,
        Subject: 'MATH',
        'Topic Name': 'Algebra',
        'Topic Code': 'ALG',
        'Sort Order': 2,
      },
      {
        Class: 6,
        Subject: 'PHYSICS',
        'Topic Name': 'Motion',
        'Topic Code': 'MOT',
        'Sort Order': 1,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Topics');
    XLSX.writeFile(wb, 'Topic_Import_Sample.xlsx');
  }
}
