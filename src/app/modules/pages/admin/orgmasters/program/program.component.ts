import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { AlertService } from '../../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';

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
  programData: any[] = [];
  loading = false;
  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  savingProgram = false;
  editingRecId: string | null = null;
  showView = false;
  viewData: any | null = null;
  viewLoading = false;
  showImport = false;
  importMode: ImportMode = 'upsert';
  importFileName = '';
  importPreviewRows: any[] = [];
  importHasInvalidRows = false;
  importInvalidCount = 0;
  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';
  subjectOptions: any[] = [];
  private subjectByCode = new Map<string, any>();
  private subjectByName = new Map<string, any>();
  examCategoryOptions: any[] = [];
  examSubCategoryOptions: any[] = [];
  private examSubByCat = new Map<string, any[]>();
  private examCatById = new Map<string, any>();
  private examSubById = new Map<string, any>();
  showSubjectsModal = false;
  subjectsTargetRecId: string | null = null;
  existingSubjectIds = new Set<string>();
  private modalSelectedSubjectSet = new Set<string>();
  modalSelectedSubjects: string[] = [];
  addingSubjects = false;
  showExamMappingModal = false;
  examMappingTargetRecId: string | null = null;
  savingExamMappings = false;
  examMapForm!: FormGroup;
  private lastTableParams: any = { page: 1, pageSize: 10 };
  private moduleName = 'ims';
  entiId: any;
  showRemoveSubjectsModal = false;
  removeSubjectsTargetRecId: string | null = null;
  removeSubjectsExisting: any[] = [];
  selectedSubjectsToRemove = new Set<string>();
  removingSubjects = false;
  columns = [
    { key: 'name', label: 'Program Name', sortable: true },
    { key: 'code', label: 'Code', sortable: false },
    { key: 'stream', label: 'Stream', sortable: true },
    { key: 'eligibleToClass', label: 'Eligible Class', sortable: true },
    { key: 'startingClass', label: 'Start Class', sortable: true },
    { key: 'duration', label: 'Duration', sortable: true },
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
    (n) => ({
      label: String(n),
      value: n,
    }),
  );
  startingClassOptions = Array.from({ length: 8 }, (_, i) => 5 + i).map(
    (n) => ({
      label: String(n),
      value: n,
    }),
  );
  examMappingSubjectOptions: any[] = [];
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
      icon: 'fa-solid fa-layer-group',
      tooltip: 'Add Subjects',
      callback: (row: any) => this.openSubjectsModal(row),
    },
    {
      type: 'icon',
      icon: 'fa-solid fa-circle-minus',
      tooltip: 'Remove Subjects',
      callback: (row: any) => this.openRemoveSubjectsModal(row),
    },
    {
      type: 'icon',
      icon: 'fa-solid fa-diagram-project',
      tooltip: 'Exam Mapping',
      callback: (row: any) => this.openExamMappingModal(row),
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
    private cdr: ChangeDetectorRef,
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Org Configs' },
      { label: 'Programs' },
    ]);
  }

  ngOnInit(): void {
    this.initForm();
    this.initExamMapForm();
    this.bindDerivedFields();
    this.loadMasters();
  }

  // ================= TABLE LIST =================
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

    const query: any = { page: params.page, limit: params.pageSize };
    if (sortParam) query.sort = sortParam;
    if (params.search) query.search = params.search;

    const queryString = Object.keys(query)
      .map(
        (key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`,
      )
      .join('&');

    const body = { entiId: this.entiId };

    this.commonApi
      .fetchData(body, this.moduleName, `program/list?${queryString}`)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: any) => {
          const rows = res?.data || [];
          this.programData = rows.map((p: any) => {
            const subs = Array.isArray(p.subjects) ? p.subjects : [];
            const maps = Array.isArray(p.examMappings) ? p.examMappings : [];
            return {
              recId: p._id,
              name: p.programName,
              code: p.programCodes || '-',
              stream: p.target || '-',
              eligibleToClass: p.eligibleToClass ?? '-',
              startingClass: p.startingClass ?? '-',
              endingClass: p.endingClass ?? '-',
              duration: p.duration ?? '-',
              version: p.version || '-',
              subjectsCount: subs.length,
              examMappingsCount: maps.length,
              isActive: p.status === 'Active',
              _raw: p,
            };
          });
          this.totalRecords = res?.count || 0;
        },
        error: (err) => {
          this.alert.error(err?.error?.message || 'Error loading programs');
        },
      });
  }

  private refreshTable() {
    const p = this.lastTableParams || { page: 1, pageSize: 10 };
    this.fetchTableData(p);
  }

  // ================= FORMS =================
  initForm() {
    this.programForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', [Validators.required, this.csvCodesValidator]],
      stream: ['', Validators.required],
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
      endingClass: [{ value: null, disabled: true }],
      version: ['', Validators.required],
      subjects: [[]],
      isActive: [true],
    });
  }

  private initExamMapForm() {
    this.examMapForm = this.fb.group({
      examMappings: this.fb.array([]),
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
    compute();
  }

  private csvCodesValidator(control: any) {
    const raw = (control?.value || '').toString();
    const parts = raw
      .split(',')
      .map((x: string) => (x || '').trim())
      .filter(Boolean);
    return parts.length ? null : { csvInvalid: true };
  }

  // ================= MASTERS (RxJS optimized) =================
  private loadMasters() {
    const subjects$ = this.commonApi
      .fetchData(
        { entiId: this.entiId },
        this.moduleName,
        `subject/list?list=full`,
      )
      .pipe(catchError(() => of({ status: false, data: [] })));

    // IMPORTANT: keep your current API paths (as in your current code)
    const examCats$ = this.commonApi
      .fetchData(
        { entiId: this.entiId },
        this.moduleName,
        `exam/category/list?list=full`,
      )
      .pipe(catchError(() => of({ status: false, data: [] })));

    const examSubs$ = this.commonApi
      .fetchData(
        { entiId: this.entiId },
        this.moduleName,
        `exam/subcategory/list?list=full`,
      )
      .pipe(catchError(() => of({ status: false, data: [] })));

    forkJoin([subjects$, examCats$, examSubs$]).subscribe({
      next: ([subRes, catRes, subCatRes]: any[]) => {
        // Subjects
        const sRows = subRes?.data || [];
        this.subjectOptions = sRows.map((s: any) => ({
          label: s.subjectName,
          value: s._id,
          code: (s.subjectCode || '').toString(),
        }));

        this.subjectByCode.clear();
        this.subjectByName.clear();
        this.subjectOptions.forEach((s: any) => {
          const code = this.normKey(s.code);
          const name = this.normKey(s.label);
          if (code) this.subjectByCode.set(code, s);
          if (name) this.subjectByName.set(name, s);
        });

        // Exam Categories
        const cRows = catRes?.data || [];
        this.examCategoryOptions = cRows.map((c: any) => ({
          label: c.categoryName || c.name || c.categoryCode || c.categoryId,
          value: c.categoryId,
        }));
        this.examCatById.clear();
        this.examCategoryOptions.forEach((x: any) =>
          this.examCatById.set(String(x.value), x),
        );

        // Exam Sub Categories
        const scRows = subCatRes?.data || [];
        this.examSubCategoryOptions = scRows.map((s: any) => ({
          label:
            s.subCategoryName || s.name || s.subCategoryCode || s.subCategoryId,
          value: s.subCategoryId,
          categoryId: s.categoryId,
        }));

        this.examSubById.clear();
        this.examSubByCat.clear();
        for (const s of this.examSubCategoryOptions) {
          this.examSubById.set(String(s.value), s);
          const catId = String(s.categoryId || '');
          if (!catId) continue;
          if (!this.examSubByCat.has(catId)) this.examSubByCat.set(catId, []);
          this.examSubByCat.get(catId)!.push(s);
        }
      },
      error: () => {
        // forkJoin should not error because each stream catchError -> but keep safe
        this.subjectOptions = [];
        this.examCategoryOptions = [];
        this.examSubCategoryOptions = [];
        this.subjectByCode.clear();
        this.subjectByName.clear();
        this.examCatById.clear();
        this.examSubById.clear();
        this.examSubByCat.clear();
      },
    });
  }

  // ================= VIEW =================
  openView(row: any) {
    const recId = row?.recId || row?._raw?._id;
    if (!recId) return;

    this.viewLoading = true;

    this.commonApi
      .fetchData(
        { entiId: this.entiId, recId },
        this.moduleName,
        'program/view',
      )
      .pipe(finalize(() => (this.viewLoading = false)))
      .subscribe({
        next: (res: any) => {
          this.viewData = res?.data || null;
          this.showView = true;
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Failed to load program'),
      });
  }

  closeView() {
    this.showView = false;
    this.viewData = null;
  }

  // ================= CREATE / EDIT =================
  add() {
    this.formMode = 'create';
    this.editingRecId = null;

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

  edit(row: any) {
    const p = row?._raw || {};
    this.formMode = 'edit';
    this.editingRecId = p._id || null;

    const subs = Array.isArray(p.subjects)
      ? p.subjects
          .map((x: any) => (typeof x === 'string' ? x : x?._id))
          .filter(Boolean)
      : [];

    this.programForm.patchValue({
      name: p.programName,
      code: p.programCodes,
      stream: p.target,
      eligibleToClass: this.toNum(p.eligibleToClass),
      startingClass: this.toNum(p.startingClass),
      duration: this.toNum(p.duration),
      endingClass: this.toNum(p.endingClass),
      version: p.version,
      subjects: subs, // locked in edit via HTML
      isActive: p.status === 'Active',
    });

    this.showForm = true;
  }

  save() {
    if (this.savingProgram) return;

    if (this.programForm.invalid) {
      this.programForm.markAllAsTouched();
      this.alert.error('Please fill all required fields');
      return;
    }

    const start = this.toNum(this.programForm.get('startingClass')?.value);
    const dur = this.toNum(this.programForm.get('duration')?.value);
    const end = start && dur ? start + dur - 1 : 0;

    if (end > 13) {
      this.alert.error(
        'Ending class exceeds max 13. Adjust starting class or duration.',
      );
      return;
    }

    const raw = this.programForm.getRawValue() || {};

    const payload: any = {
      entiId: this.entiId,
      eligibleToClass: this.toNum(raw.eligibleToClass),
      startingClass: this.toNum(raw.startingClass),
      duration: this.toNum(raw.duration),
      programName: raw.name,
      programCodes: raw.code,
      target: raw.stream,
      version: raw.version,
      status: raw.isActive ? 'Active' : 'Inactive',
    };

    if (this.formMode === 'create') {
      payload.subjects = Array.isArray(raw.subjects)
        ? raw.subjects.map((x: any) => String(x)).filter(Boolean)
        : [];
    }

    if (this.formMode === 'edit') {
      payload.recId = this.editingRecId;
    }

    const endpoint =
      this.formMode === 'create' ? 'program/create' : 'program/edit';

    this.savingProgram = true;

    this.commonApi
      .fetchData(payload, this.moduleName, endpoint)
      .pipe(finalize(() => (this.savingProgram = false)))
      .subscribe({
        next: () => {
          this.alert.success(
            this.formMode === 'create'
              ? 'Program created successfully'
              : 'Program updated successfully',
          );
          this.showForm = false;
          this.refreshTable();
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Operation failed'),
      });
  }

  cancel() {
    if (this.savingProgram) return;
    this.showForm = false;
  }

  // ================= SUBJECTS (Create form) =================
  isSubjectChecked(subjectId: string): boolean {
    const list = (this.programForm.get('subjects')?.value || []) as any[];
    return list.some((x: any) => String(x) === String(subjectId));
  }

  toggleSubject(subjectId: string, checked: boolean) {
    // disabled in edit mode via HTML, but keep safe
    if (this.formMode === 'edit') return;

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

  // ================= Add Subjects Modal (UPDATED REQUIREMENT) =================
  openSubjectsModal(row: any) {
    const recId = row?.recId || row?._raw?._id;
    if (!recId) return;

    this.subjectsTargetRecId = recId;
    this.existingSubjectIds.clear();
    this.modalSelectedSubjectSet.clear();
    this.modalSelectedSubjects = [];
    this.addingSubjects = false;
    this.showSubjectsModal = true;

    // Load current subjects and preselect them (NOT disabled)
    this.commonApi
      .fetchData(
        { entiId: this.entiId, recId },
        this.moduleName,
        'program/view',
      )
      .subscribe({
        next: (res: any) => {
          const v = res?.data || {};
          const subs = Array.isArray(v.subjects)
            ? v.subjects
                .map((x: any) => (typeof x === 'string' ? x : x?._id))
                .filter(Boolean)
            : [];

          this.existingSubjectIds = new Set(subs.map((x: any) => String(x)));

          // ✅ Requirement: keep already added subjects as selected (checked)
          this.modalSelectedSubjectSet = new Set(
            Array.from(this.existingSubjectIds),
          );
          this.modalSelectedSubjects = Array.from(this.modalSelectedSubjectSet);
        },
        error: () => {
          // keep modal open, just empty state
          this.existingSubjectIds.clear();
          this.modalSelectedSubjectSet.clear();
          this.modalSelectedSubjects = [];
        },
      });
  }

  closeSubjectsModal() {
    if (this.addingSubjects) return;
    this.showSubjectsModal = false;
    this.subjectsTargetRecId = null;
    this.existingSubjectIds.clear();
    this.modalSelectedSubjectSet.clear();
    this.modalSelectedSubjects = [];
    this.addingSubjects = false;
    this.cdr.detectChanges();
  }

  isModalSubjectChecked(subjectId: string): boolean {
    return this.modalSelectedSubjectSet.has(String(subjectId));
  }

  toggleModalSubject(subjectId: string, checked: boolean) {
    const id = String(subjectId);
    if (checked) this.modalSelectedSubjectSet.add(id);
    else this.modalSelectedSubjectSet.delete(id);
    this.modalSelectedSubjects = Array.from(this.modalSelectedSubjectSet);
  }

  confirmAddSubjects() {
    if (this.addingSubjects) return;
    if (!this.subjectsTargetRecId) return;
    const selected = Array.from(this.modalSelectedSubjectSet);
    const toAdd = selected.filter(
      (x) => !this.existingSubjectIds.has(String(x)),
    );
    if (!toAdd.length) {
      this.alert.error('No new subjects selected to add');
      return;
    }
    this.addingSubjects = true;
    const payload = {
      entiId: this.entiId,
      recId: this.subjectsTargetRecId,
      subjects: toAdd,
    };
    this.commonApi
      .fetchData(payload, this.moduleName, 'program/addsubjects')
      .pipe(finalize(() => (this.addingSubjects = false)))
      .subscribe({
        next: () => {
          this.alert.success('Subjects added to program');
          this.addingSubjects = false;
          this.closeSubjectsModal();
          this.refreshTable();
        },
        error: (err: any) => {
          this.alert.error(err?.error?.message || 'Failed to add subjects');
        },
      });
  }

  // ================= Exam Mapping Modal =================
  // openExamMappingModal(row: any) {
  //   const recId = row?.recId || row?._raw?._id;
  //   if (!recId) return;
  //   this.examMappingTargetRecId = recId;
  //   this.savingExamMappings = false;
  //   this.showExamMappingModal = true;
  //   this.examMappingsFA.clear();
  //   this.commonApi
  //     .fetchData(
  //       { entiId: this.entiId, recId },
  //       this.moduleName,
  //       'program/view',
  //     )
  //     .subscribe({
  //       next: (res: any) => {
  //         const v = res?.data || {};
  //         const maps = Array.isArray(v.examMappings) ? v.examMappings : [];
  //         for (const m of maps) {
  //           this.examMappingsFA.push(this.makeExamMappingRow(m));
  //         }
  //       },
  //       error: (err: any) => {
  //         this.alert.error(
  //           err?.error?.message || 'Failed to load exam mappings',
  //         );
  //       },
  //     });
  // }

  openExamMappingModal(row: any) {
    const recId = row?.recId || row?._raw?._id;
    if (!recId) return;
    this.examMappingTargetRecId = recId;
    this.savingExamMappings = false;
    this.examMappingSubjectOptions = [];
    this.showExamMappingModal = true;
    this.examMappingsFA.clear();
    this.commonApi
      .fetchData(
        { entiId: this.entiId, recId },
        this.moduleName,
        'program/view',
      )
      .subscribe({
        next: (res: any) => {
          const v = res?.data || {};
          const maps = Array.isArray(v.examMappings) ? v.examMappings : [];
          const progSubs = Array.isArray(v.subjects) ? v.subjects : [];
          this.examMappingSubjectOptions = progSubs.map((s: any) => ({
            value: String(s?._id || s),
            label: s?.subjectName || s?.subjectCode || String(s?._id || s),
            code: s?.subjectCode || '',
          }));
          for (const m of maps) {
            this.examMappingsFA.push(this.makeExamMappingRow(m));
          }
        },
        error: (err: any) => {
          this.alert.error(
            err?.error?.message || 'Failed to load exam mappings',
          );
        },
      });
  }

  closeExamMappingModal() {
    if (this.savingExamMappings) return;
    this.showExamMappingModal = false;
    this.examMappingTargetRecId = null;
    this.savingExamMappings = false;
    this.examMappingsFA.clear();
    this.cdr.detectChanges();
  }

  get examMappingsFA(): FormArray {
    return this.examMapForm.get('examMappings') as FormArray;
  }

  // private makeExamMappingRow(v?: any) {
  //   return this.fb.group({
  //     categoryId: [String(v?.categoryId || ''), Validators.required],
  //     subCategoryId: [String(v?.subCategoryId || ''), Validators.required],
  //     sortOrder: [this.toNum(v?.sortOrder) || 0, []],
  //   });
  // }

  private makeExamMappingRow(v?: any) {
    const existingIds = Array.isArray(v?.subjectIds)
      ? v.subjectIds
          .map((x: any) =>
            typeof x === 'object' ? String(x?._id || x) : String(x),
          )
          .filter(Boolean)
      : [];
    return this.fb.group({
      categoryId: [String(v?.categoryId || ''), Validators.required],
      subCategoryId: [String(v?.subCategoryId || ''), Validators.required],
      subjectIds: [existingIds],
      sortOrder: [this.toNum(v?.sortOrder) || 0],
    });
  }

  addExamMappingRow() {
    this.examMappingsFA.push(this.makeExamMappingRow({ sortOrder: 0 }));
  }

  removeExamMappingRow(i: number) {
    if (i < 0 || i >= this.examMappingsFA.length) return;
    this.examMappingsFA.removeAt(i);
  }

  onExamCategoryChanged(i: number) {
    const g = this.examMappingsFA.at(i) as FormGroup;
    if (!g) return;
    g.patchValue({ subCategoryId: '' }, { emitEvent: false });
  }

  getSubCategoryOptionsForRow(i: number): any[] {
    const g = this.examMappingsFA.at(i) as FormGroup;
    const catId = String(g?.get('categoryId')?.value || '');
    return catId ? this.examSubByCat.get(catId) || [] : [];
  }

  // saveExamMappings() {
  //   if (this.savingExamMappings) return;
  //   if (!this.examMappingTargetRecId) return;
  //   this.examMappingsFA.markAllAsTouched();
  //   if (this.examMappingsFA.invalid) {
  //     this.alert.error('Please fix exam mapping rows');
  //     return;
  //   }
  //   const rows = (this.examMappingsFA.value || []).map((x: any) => ({
  //     categoryId: String(x.categoryId || '').trim(),
  //     subCategoryId: String(x.subCategoryId || '').trim(),
  //     sortOrder: this.toNum(x.sortOrder),
  //   }));
  //   const map = new Map<string, any>();
  //   for (const r of rows) {
  //     if (!r.categoryId || !r.subCategoryId) continue;
  //     const key = `${r.categoryId}__${r.subCategoryId}`;
  //     if (!map.has(key)) map.set(key, r);
  //   }
  //   const clean = Array.from(map.values());
  //   if (!clean.length) {
  //     this.alert.error('No valid mappings to save');
  //     return;
  //   }
  //   this.savingExamMappings = true;
  //   const payload = {
  //     entiId: this.entiId,
  //     recId: this.examMappingTargetRecId,
  //     rows: clean,
  //   };
  //   this.commonApi
  //     .fetchData(payload, this.moduleName, 'program/updateExamMappings')
  //     .pipe(finalize(() => (this.savingExamMappings = false)))
  //     .subscribe({
  //       next: () => {
  //         this.alert.success('Exam mappings saved');
  //         this.savingExamMappings = false;
  //         this.closeExamMappingModal();
  //         this.refreshTable();
  //       },
  //       error: (err: any) => {
  //         this.alert.error(
  //           err?.error?.message || 'Failed to save exam mappings',
  //         );
  //       },
  //     });
  // }

  saveExamMappings() {
    if (this.savingExamMappings) return;
    if (!this.examMappingTargetRecId) return;
    this.examMappingsFA.markAllAsTouched();
    if (this.examMappingsFA.invalid) {
      this.alert.error('Please fix exam mapping rows');
      return;
    }
    const rows = (this.examMappingsFA.value || []).map((x: any) => ({
      categoryId: String(x.categoryId || '').trim(),
      subCategoryId: String(x.subCategoryId || '').trim(),
      subjectIds: Array.isArray(x.subjectIds)
        ? x.subjectIds.map((s: any) => String(s)).filter(Boolean)
        : [],
      sortOrder: this.toNum(x.sortOrder),
    }));
    const map = new Map<string, any>();
    for (const r of rows) {
      if (!r.categoryId || !r.subCategoryId) continue;
      const key = `${r.categoryId}__${r.subCategoryId}`;
      if (!map.has(key)) {
        map.set(key, { ...r, subjectIds: [] });
      }
      const entry = map.get(key)!;
      const existing = new Set(entry.subjectIds);
      for (const sid of r.subjectIds) {
        if (!existing.has(sid)) {
          entry.subjectIds.push(sid);
          existing.add(sid);
        }
      }
    }
    const clean = Array.from(map.values());
    if (!clean.length) {
      this.alert.error('No valid mappings to save');
      return;
    }
    this.savingExamMappings = true;
    const payload = {
      entiId: this.entiId,
      recId: this.examMappingTargetRecId,
      rows: clean,
    };
    this.commonApi
      .fetchData(payload, this.moduleName, 'program/updateExamMappings')
      .subscribe({
        next: () => {
          this.savingExamMappings = false;
          this.alert.success('Exam mappings saved');
          this.closeExamMappingModal();
          this.refreshTable();
        },
        error: (err: any) => {
          this.savingExamMappings = false;
          this.alert.error(
            err?.error?.message || 'Failed to save exam mappings',
          );
        },
      });
  }

  // ================= DELETE =================
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
          this.refreshTable();
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Delete failed'),
      });

    this.deleteTarget = null;
  }

  // ================= IMPORT (kept + fixed) =================
  openImport() {
    this.showImport = true;
    this.resetImport();
  }

  closeImport() {
    this.showImport = false;
    this.resetImport();
    this.cdr.detectChanges();
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

    const payload = { entiId: this.entiId, mode: 'upsert', rows };

    this.commonApi
      .fetchData(payload, this.moduleName, 'program/import')
      .subscribe({
        next: () => {
          this.alert.success('Import completed');
          this.showImport = false;
          this.closeImport();
          this.refreshTable();
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Import failed'),
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

  // ================= LABEL HELPERS =================
  getExamCategoryLabel(categoryId: any): string {
    const hit = this.examCatById.get(String(categoryId || ''));
    return hit?.label || String(categoryId || '-');
  }

  getExamSubCategoryLabel(subCategoryId: any): string {
    const hit = this.examSubById.get(String(subCategoryId || ''));
    return hit?.label || String(subCategoryId || '-');
  }

  // ================= BASIC HELPERS =================
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
    const s = v === null || v === undefined ? '' : String(v).trim();
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

  // ================= Remove Subjects Modal =================
  openRemoveSubjectsModal(row: any) {
    const recId = row?.recId || row?._raw?._id;
    if (!recId) return;

    this.removeSubjectsTargetRecId = recId;
    this.removeSubjectsExisting = [];
    this.selectedSubjectsToRemove.clear();
    this.removingSubjects = false;
    this.showRemoveSubjectsModal = true;

    this.commonApi
      .fetchData(
        { entiId: this.entiId, recId },
        this.moduleName,
        'program/view',
      )
      .subscribe({
        next: (res: any) => {
          const v = res?.data || {};
          const subs = Array.isArray(v.subjects) ? v.subjects : [];
          this.removeSubjectsExisting = subs.map((s: any) => ({
            value: String(s?._id || s),
            label: s?.subjectName || s?.subjectCode || String(s?._id || s),
            code: s?.subjectCode || '',
          }));
        },
        error: () => {
          this.removeSubjectsExisting = [];
        },
      });
  }

  closeRemoveSubjectsModal() {
    if (this.removingSubjects) return;
    this.showRemoveSubjectsModal = false;
    this.removeSubjectsTargetRecId = null;
    this.removeSubjectsExisting = [];
    this.selectedSubjectsToRemove.clear();
    this.removingSubjects = false;
  }

  toggleRemoveSubject(subjectId: string, checked: boolean) {
    const id = String(subjectId);
    checked
      ? this.selectedSubjectsToRemove.add(id)
      : this.selectedSubjectsToRemove.delete(id);
  }

  confirmRemoveSubjects() {
    if (this.removingSubjects) return;
    if (!this.removeSubjectsTargetRecId) return;
    if (!this.selectedSubjectsToRemove.size) {
      this.alert.error('Select at least one subject to remove');
      return;
    }
    this.removingSubjects = true;
    const payload = {
      entiId: this.entiId,
      recId: this.removeSubjectsTargetRecId,
      subjects: Array.from(this.selectedSubjectsToRemove),
    };
    this.commonApi
      .fetchData(payload, this.moduleName, 'program/removesubjects')
      .subscribe({
        next: (res: any) => {
          this.removingSubjects = false;
          this.alert.success(
            `${res?.data?.subjectsRemoved || ''} subject(s) removed. ` +
              `${res?.data?.remainingExamMappings ?? ''} exam mapping(s) remain.`,
          );
          this.closeRemoveSubjectsModal();
          this.refreshTable();
        },
        error: (err: any) => {
          this.removingSubjects = false;
          this.alert.error(err?.error?.message || 'Failed to remove subjects');
        },
      });
  }

  getSubjectLabels(subjectIds: any[]): string {
    if (!Array.isArray(subjectIds) || !subjectIds.length) return '-';
    return subjectIds
      .map((s: any) => {
        const id = typeof s === 'object' ? String(s?._id || s) : String(s);
        const opt = this.subjectOptions.find(
          (x: any) => String(x.value) === id,
        );
        return opt ? opt.label : id;
      })
      .join(', ');
  }

  toggleRowSubject(i: number, subjectId: string, checked: boolean) {
    const g = this.examMappingsFA.at(i) as FormGroup;
    const ctrl = g?.get('subjectIds');
    if (!ctrl) return;
    const current = [...((ctrl.value as string[]) || [])];
    const id = String(subjectId);
    if (checked && !current.includes(id)) {
      ctrl.setValue([...current, id]);
    } else if (!checked) {
      ctrl.setValue(current.filter((x) => x !== id));
    }
    ctrl.markAsDirty();
  }

  isRowSubjectChecked(i: number, subjectId: string): boolean {
    return this.getRowSubjectIds(i).includes(String(subjectId));
  }

  getRowSubjectIds(i: number): string[] {
    const g = this.examMappingsFA.at(i) as FormGroup;
    return (g?.get('subjectIds')?.value as string[]) || [];
  }
}
