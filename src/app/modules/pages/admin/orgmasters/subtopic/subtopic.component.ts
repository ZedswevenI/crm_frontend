import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { finalize } from 'rxjs/operators';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';
@Component({
  selector: 'app-subtopic',
  standalone: false,
  templateUrl: './subtopic.component.html',
  styleUrl: './subtopic.component.scss',
})
export class SubtopicComponent implements OnInit {
 moduleName = 'ims';
  entiId = localStorage.getItem('tenantId');
  form!: FormGroup;
  classOptions = Array.from({ length: 8 }, (_, i) => ({
    label: `${6 + i}`,
    value: 6 + i,
  }));
  subjectOptions: any[] = [];
  topicOptions: any[] = [];
  topicLoading = false;
  private subjectById = new Map<string, any>();
  private subjectNameToId = new Map<string, string>();
  private subjectCodeToId = new Map<string, string>();
  private topicCache = new Map<string, any[]>();
  private topicNameToIdByKey = new Map<string, Map<string, string>>();
  private topicCodeToIdByKey = new Map<string, Map<string, string>>();
  tableData: any[] = [];
  totalRecords = 0;
  loading = false;
  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  saving = false;
  deleteModalVisible = false;
  deleteTarget: any = null;
  deleteMessage = '';
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
    { key: 'subTopicName', label: 'Sub-Topic', sortable: true },
  ];

  actions = [
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
    private alert: AlertService,
    private api: CommonapiService,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadSubjects();
  }

  get subtopicRows(): FormArray {
    return this.form.get('subtopicRows') as FormArray;
  }

  private createSubtopicRow(): FormGroup {
    return this.fb.group({
      subTopicName: ['', [Validators.required, Validators.maxLength(140)]],
      subTopicCode: ['', [Validators.maxLength(30)]],
      sortOrder: [0],
    });
  }

  addSubtopicRow(): void {
    this.subtopicRows.push(this.createSubtopicRow());
  }

  removeSubtopicRow(index: number): void {
    if (this.subtopicRows.length > 1) {
      this.subtopicRows.removeAt(index);
    }
  }

  private initForm() {
    this.form = this.fb.group({
      classNo: [null, Validators.required],
      subjectId: [null, Validators.required],
      topicId: [null, Validators.required],
      subTopicId: [null],
      subTopicName: ['', [Validators.maxLength(140)]],
      subTopicCode: ['', [Validators.maxLength(30)]],
      sortOrder: [0],
      subtopicRows: this.fb.array([this.createSubtopicRow()]),
    });
  }

  private loadSubjects() {
    this.api
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
          this.fetchTableData({ page: 1, pageSize: 10 });
        },
        error: () => {
          this.subjectOptions = [];
          this.subjectById.clear();
          this.subjectNameToId.clear();
          this.subjectCodeToId.clear();
          this.fetchTableData({ page: 1, pageSize: 10 });
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

  onClassOrSubjectChanged() {
    this.form.patchValue({ topicId: null });
    this.topicOptions = [];
    this.loadTopicsForSelected();
  }

  private loadTopicsForSelected() {
    const classNo = this.form.get('classNo')?.value;
    const subjectId = this.form.get('subjectId')?.value;
    if (!classNo || !subjectId) return;
    const key = `${classNo}::${String(subjectId)}`;
    if (this.topicCache.has(key)) {
      this.topicOptions = (this.topicCache.get(key) || []).map((t: any) => ({
        label: t.topicName,
        value: t.topicId,
      }));
      return;
    }
    this.topicLoading = true;
    const qp = this.buildQueryParams({ list: 'full', classNo, subjectId });
    this.api
      .fetchData({ entiId: this.entiId }, this.moduleName, `topic/list${qp}`)
      .pipe(finalize(() => (this.topicLoading = false)))
      .subscribe({
        next: (res: any) => {
          const rows = Array.isArray(res?.data) ? res.data : [];
          this.topicCache.set(key, rows);
          const byName = new Map<string, string>();
          const byCode = new Map<string, string>();
          for (const t of rows) {
            const nm = String(t.topicName || '')
              .trim()
              .toUpperCase();
            const cd = String(t.topicCode || '')
              .trim()
              .toUpperCase();
            const id = String(t.topicId || '');
            if (nm && id) byName.set(nm, id);
            if (cd && id) byCode.set(cd, id);
          }
          this.topicNameToIdByKey.set(key, byName);
          this.topicCodeToIdByKey.set(key, byCode);
          this.topicOptions = rows.map((t: any) => ({
            label: t.topicName,
            value: t.topicId,
          }));
        },
        error: () => {
          this.topicOptions = [];
        },
      });
  }

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
      subjectName: 'subjectId',
      topicName: 'topicId',
      subTopicName: 'subTopicName',
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
    this.api
      .fetchData({ entiId: this.entiId }, this.moduleName, `subtopic/list${qp}`)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: any) => {
          const rows = Array.isArray(res?.data) ? res.data : [];
          this.totalRecords = res?.count || 0;
          this.tableData = rows.map((x: any) => {
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
              subTopicId: x.subTopicId,
              classNo: x.classNo,
              subjectId,
              subjectName,
              topicId: x.topicId.topicId,
              topicName: x.topicId.topicName,
              subTopicName: x.subTopicName,
              subTopicCode: x.subTopicCode || '-',
              sortOrder: x.sortOrder ?? 0,
              _raw: x,
            };
          });
        },
        error: () => this.alert.error('Failed to load subtopics'),
      });
  }

  add() {
    this.formMode = 'create';
    this.form.reset({
      classNo: null,
      subjectId: null,
      topicId: null,
      subTopicId: null,
      subTopicName: '',
      subTopicCode: '',
      sortOrder: 0,
    });
    this.subtopicRows.clear();
    this.subtopicRows.push(this.createSubtopicRow());
    this.topicOptions = [];
    this.showForm = true;
    this.deleteTarget = null;
  }

  edit(row: any) {
    const x = row?._raw || row;
    const subjObj =
      x?.subjectId && typeof x.subjectId === 'object' ? x.subjectId : null;
    const subjectId = subjObj
      ? String(subjObj?._id || '')
      : String(x.subjectId || '');
    this.formMode = 'edit';

    // Clear FormArray so it doesn't block validation in edit mode
    this.subtopicRows.clear();

    // Add required validator for single-row edit field
    this.form.get('subTopicName')?.setValidators([Validators.required, Validators.maxLength(140)]);
    this.form.get('subTopicName')?.updateValueAndValidity();

    this.form.patchValue({
      classNo: x.classNo,
      subjectId: subjectId,
      topicId: x.topicId,
      subTopicId: x.subTopicId,
      subTopicName: x.subTopicName,
      subTopicCode: x.subTopicCode || '',
      sortOrder: x.sortOrder ?? 0,
    });
    this.loadTopicsForSelected();
    this.deleteTarget = {
      classNo: x.classNo,
      subjectId: subjectId,
      topicId: x.topicId,
      subTopicId: x.subTopicId,
      subTopicName: x.subTopicName,
    };
    this.showForm = true;
  }

  save() {
    if (this.saving) return;

    if (this.formMode === 'edit') {
      if (this.form.invalid) {
        this.form.markAllAsTouched();
        this.alert.error('Fill required fields');
        return;
      }
      const v = this.form.value || {};
      const payload: any = {
        entiId: this.entiId,
        userId: localStorage.getItem('userId') || '',
        classNo: v.classNo,
        subjectId: v.subjectId,
        topicId: (v.topicId || '').toString().trim(),
        subTopicName: (v.subTopicName || '').toString().trim(),
        subTopicCode: (v.subTopicCode || '').toString().trim() || null,
        sortOrder: Number(v.sortOrder || 0),
        subTopicId: v.subTopicId,
      };
      this.saving = true;
      this.api
        .fetchData(payload, this.moduleName, 'subtopic/update')
        .pipe(finalize(() => (this.saving = false)))
        .subscribe({
          next: (res: any) => {
            if (res?.status === false) {
              this.alert.error(res?.message || 'Save failed');
              return;
            }
            this.alert.success('Sub-topic updated');
            this.showForm = false;
            this.fetchTableData({ page: 1, pageSize: 10 });
          },
          error: (err: any) =>
            this.alert.error(err?.error?.message || 'Save failed'),
        });
      return;
    }

    // Create mode — validate shared fields + subtopicRows
    const classNo = this.form.get('classNo')?.value;
    const subjectId = this.form.get('subjectId')?.value;
    const topicId = this.form.get('topicId')?.value;
    if (!classNo || !subjectId || !topicId) {
      this.form.markAllAsTouched();
      this.alert.error('Select Class, Subject and Topic');
      return;
    }
    if (this.subtopicRows.invalid) {
      this.subtopicRows.markAllAsTouched();
      this.alert.error('Fill Sub-Topic Name for all rows');
      return;
    }

    const rows = this.subtopicRows.value || [];
    if (!rows.length) return;

    this.saving = true;
    let completed = 0;
    let failed = 0;

    for (const row of rows) {
      const payload = {
        entiId: this.entiId,
        userId: localStorage.getItem('userId') || '',
        classNo,
        subjectId,
        topicId: (topicId || '').toString().trim(),
        subTopicName: (row.subTopicName || '').toString().trim(),
        subTopicCode: (row.subTopicCode || '').toString().trim() || null,
        sortOrder: Number(row.sortOrder || 0),
      };
      this.api.fetchData(payload, this.moduleName, 'subtopic/create').subscribe({
        next: (res: any) => {
          completed++;
          if (res?.status === false) failed++;
          this.checkCreateCompletion(rows.length, completed, failed);
        },
        error: () => {
          completed++;
          failed++;
          this.checkCreateCompletion(rows.length, completed, failed);
        },
      });
    }
  }

  private checkCreateCompletion(total: number, completed: number, failed: number): void {
    if (completed < total) return;
    this.saving = false;
    const success = total - failed;
    if (success > 0) {
      this.alert.success(`${success} sub-topic(s) created${failed > 0 ? `, ${failed} failed` : ''}`);
    } else {
      this.alert.error('All sub-topic creations failed');
    }
    this.showForm = false;
    this.fetchTableData({ page: 1, pageSize: 10 });
  }

  cancel() {
    if (this.saving) return;
    this.showForm = false;
  }

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
      subTopicId: x.subTopicId,
      subTopicName: x.subTopicName,
    };
    this.deleteMessage = `Delete "${x.subTopicName}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean) {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;
    const x = this.deleteTarget;
    const payload = {
      entiId: this.entiId,
      userId: localStorage.getItem('userId') || '',
      classNo: x.classNo,
      subjectId: x.subjectId,
      topicId: x.topicId,
      subTopicId: x.subTopicId,
    };
    this.api.fetchData(payload, this.moduleName, `subtopic/delete`).subscribe({
      next: (res: any) => {
        if (res?.status === false) {
          this.alert.error(res?.message || 'Delete failed');
          return;
        }
        this.alert.success('Sub-topic deleted');
        this.fetchTableData({ page: 1, pageSize: 10 });
      },
      error: (err: any) =>
        this.alert.error(err?.error?.message || 'Delete failed'),
    });

    this.deleteTarget = null;
  }

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

    // ✅ Topic must be FULL TOPIC NAME only
    const topicRaw = get('Topic', 'Topic Name', 'TopicName', 'topic');

    const subTopicNameRaw = get(
      'Sub-Topic Name',
      'SubTopicName',
      'subTopicName',
    );
    const subTopicCode =
      get('Code', 'Sub-Topic Code', 'SubTopicCode', 'subTopicCode') || null;

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

    const topicNameKey = String(topicRaw || '')
      .trim()
      .toUpperCase();
    const topicLabel = topicNameKey || '-';

    if (!topicNameKey) errors.push('Topic required (full Topic Name)');

    const subTopicName = String(subTopicNameRaw || '').trim();
    if (!subTopicName) errors.push('Sub-Topic Name required');

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

      // ✅ topic name key only
      topicNameKey,
      topicLabel,

      subTopicName,
      subTopicCode: subTopicCode ? String(subTopicCode).trim() : null,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    };
  }

  private computeImportValidation() {
    const invalid = (this.importPreviewRows || []).filter((x) => !x._valid);
    this.importInvalidCount = invalid.length;
    this.importHasInvalidRows = invalid.length > 0;

    const groups = new Set<string>();
    for (const r of this.importPreviewRows || []) {
      if (r._valid && r.subjectId && r.topicLabel && r.topicLabel !== '-') {
        groups.add(`${r.classNo}::${r.subjectId}::${r.topicLabel}`);
      }
    }
    this.importGroupCount = groups.size;
  }

  private ensureTopicsForGroup(
    classNo: number,
    subjectId: string,
    done: (ok: boolean) => void,
  ) {
    const key = `${classNo}::${String(subjectId)}`;
    if (this.topicCache.has(key)) return done(true);

    const qp = this.buildQueryParams({ list: 'full', classNo, subjectId });

    this.api
      .fetchData({ entiId: this.entiId }, this.moduleName, `topic/list${qp}`)
      .subscribe({
        next: (res: any) => {
          const rows = Array.isArray(res?.data) ? res.data : [];
          this.topicCache.set(key, rows);

          // ✅ only name map
          const byName = new Map<string, string>();
          for (const t of rows) {
            const nm = String(t.topicName || '')
              .trim()
              .toUpperCase();
            const id = String(t.topicId || '');
            if (nm && id) byName.set(nm, id);
          }
          this.topicNameToIdByKey.set(key, byName);

          done(true);
        },
        error: () => done(false),
      });
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

    const rows = [...this.importPreviewRows];

    const uniqueCS = Array.from(
      new Set(rows.map((r) => `${r.classNo}::${r.subjectId}`)),
    ).map((k) => {
      const [c, s] = k.split('::');
      return { classNo: Number(c), subjectId: String(s) };
    });

    this.importing = true;

    const grouped = new Map<string, any[]>();

    const processCS = (idx: number) => {
      if (idx >= uniqueCS.length) {
        for (const r of rows) {
          const keyCS = `${r.classNo}::${r.subjectId}`;
          const byName = this.topicNameToIdByKey.get(keyCS);

          const tid = (r.topicNameKey && byName?.get(r.topicNameKey)) || null;

          if (!tid) {
            this.importing = false;
            this.alert.error(
              `Topic not found for row ${r._rowNo} (${r.topicLabel}). Use exact Topic Name.`,
            );
            return;
          }

          const gk = `${r.classNo}::${r.subjectId}::${tid}`;
          if (!grouped.has(gk)) grouped.set(gk, []);
          grouped.get(gk)!.push(r);
        }

        const keys = Array.from(grouped.keys());
        if (!keys.length) {
          this.importing = false;
          this.alert.error('No valid rows to import');
          return;
        }

        const runNext = (gidx: number) => {
          if (gidx >= keys.length) {
            this.importing = false;
            this.alert.success('Import completed');
            this.showImport = false;
            this.resetImport();

            this.fetchTableData({ page: 1, pageSize: 10 });
            return;
          }

          const k = keys[gidx];
          const [classNoStr, subjectId, topicId] = k.split('::');

          const payload = {
            entiId: this.entiId,
            classNo: Number(classNoStr),
            subjectId,
            topicId,
            rows: (grouped.get(k) || []).map((x) => ({
              subTopicName: x.subTopicName,
              subTopicCode: x.subTopicCode,
              sortOrder: x.sortOrder,
            })),
          };

          this.api
            .fetchData(payload, this.moduleName, 'subtopic/import')
            .subscribe({
              next: (res: any) => {
                if (res?.status === false) {
                  this.importing = false;
                  this.alert.error(
                    res?.message || `Import failed at group ${k}`,
                  );
                  return;
                }
                runNext(gidx + 1);
              },
              error: (err: any) => {
                this.importing = false;
                this.alert.error(
                  err?.error?.message || `Import failed at group ${k}`,
                );
              },
            });
        };

        runNext(0);
        return;
      }
      const cs = uniqueCS[idx];
      this.ensureTopicsForGroup(cs.classNo, cs.subjectId, (ok) => {
        if (!ok) {
          this.importing = false;
          this.alert.error(`Unable to load topics for Class ${cs.classNo}`);
          return;
        }
        processCS(idx + 1);
      });
    };

    processCS(0);
  }

  downloadSampleExcel() {
    const rows = [
      {
        Class: 6,
        Subject: 'MATH',
        Topic: 'Trigonometry',
        'Sub-Topic Name': 'Height & Distance',
        Code: 'HD01',
        'Sort Order': 1,
      },
      {
        Class: 6,
        Subject: 'MATH',
        Topic: 'Trigonometry',
        'Sub-Topic Name': 'Trigonometric Identities',
        Code: 'TI01',
        'Sort Order': 2,
      },
      {
        Class: 6,
        Subject: 'PHYSICS',
        Topic: 'Motion',
        'Sub-Topic Name': 'Uniform Motion',
        Code: 'UM01',
        'Sort Order': 1,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SubTopics');
    XLSX.writeFile(wb, 'SubTopic_Import_Sample.xlsx');
  }
}
