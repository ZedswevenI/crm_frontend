import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { finalize } from 'rxjs/operators';
import { AlertService } from '../../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';

@Component({
  selector: 'app-examcategory',
  standalone: false,
  templateUrl: './examcategory.component.html',
  styleUrl: './examcategory.component.scss',
})
export class ExamcategoryComponent implements OnInit {
 private moduleName = 'ims';
  entiId: any;
  form!: FormGroup;
  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  editingCategoryId: string | null = null;
  loading = false;
  totalRecords = 0;
  tableData: any[] = [];
  saving = false;
  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';
  showImport = false;
  importFileName = '';
  importPreviewRows: any[] = [];
  importHasInvalidRows = false;
  importInvalidCount = 0;
  importing = false;

  // Add Sub-Category from Category
  showSubcategoryForm = false;
  subcategoryParent: any = null;
  subcategoryForm!: FormGroup;
  savingSubcategories = false;

  columns = [
    { key: 'categoryName', label: 'Category Name', sortable: true },
    { key: 'categoryCode', label: 'Code', sortable: false },
    { key: 'status', label: 'Status', sortable: true },
  ];

  actions = [
    {
      type: 'icon',
      icon: 'fa-solid fa-layer-group',
      tooltip: 'Add Sub-Categories',
      callback: (row: any) => this.openAddSubcategory(row),
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
      { label: 'Exam Category' },
    ]);
  }

  ngOnInit(): void {
    this.initForm();
  }

  private initForm() {
    this.form = this.fb.group({
      categoryName: ['', [Validators.required, Validators.maxLength(120)]],
      categoryCode: ['', [Validators.maxLength(40)]],
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

  fetchTableData(params: {
    page: number;
    pageSize: number;
    search?: string;
    sortKey?: string;
    sortDirection?: string;
  }) {
    this.loading = true;
    const search = (params.search || '').toString().trim();
    const sortKey = (params.sortKey || '').toString().trim();
    const sortDir = (params.sortDirection || '').toString().toLowerCase();

    const sortMap: any = {
      categoryName: 'categoryName',
      status: 'status',
      categoryCode: 'categoryCode',
    };

    const apiSortKey = sortKey ? sortMap[sortKey] || sortKey : '';
    const sortParam = apiSortKey
      ? sortDir === 'desc'
        ? `-${apiSortKey}`
        : apiSortKey
      : '';

    const qp = this.buildQueryParams({
      page: params.page,
      limit: params.pageSize,
      ...(sortParam ? { sort: sortParam } : {}),
      ...(search ? { search } : {}),
    });

    this.commonApi
      .fetchData(
        { entiId: this.entiId },
        this.moduleName,
        `exam/category/list${qp}`,
      )
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: any) => {
          const rows = Array.isArray(res?.data) ? res.data : [];
          this.tableData = rows.map((x: any) => ({
            recId: x._id,
            categoryId: x.categoryId,
            categoryName: x.categoryName,
            categoryCode: x.categoryCode || '-',
            status: x.status || 'Active',
            _raw: x,
          }));
          this.totalRecords = res?.count || 0;
        },
        error: () => this.alert.error('Failed to load exam categories'),
      });
  }

  add() {
    this.formMode = 'create';
    this.editingCategoryId = null;
    this.form.reset({ categoryName: '', categoryCode: '', isActive: true });
    this.showForm = true;
  }

  edit(row: any) {
    const x = row?._raw || row;
    this.formMode = 'edit';
    this.editingCategoryId = String(x?.categoryId || '');
    this.form.patchValue({
      categoryName: x?.categoryName || '',
      categoryCode: x?.categoryCode || '',
      isActive: (x?.status || 'Active') === 'Active',
    });
    this.showForm = true;
  }

  save() {
    if (this.saving) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.alert.error('Please fill required fields');
      return;
    }
    const raw = this.form.getRawValue();
    const payload: any = {
      entiId: this.entiId,
      userId: localStorage.getItem('userId') || '',
      categoryName: String(raw.categoryName || '').trim(),
      categoryCode: String(raw.categoryCode || '').trim() || null,
      status: raw.isActive ? 'Active' : 'Inactive',
    };
    const endpoint =
      this.formMode === 'create'
        ? 'exam/category/create'
        : 'exam/category/update';
    if (this.formMode === 'edit') payload.categoryId = this.editingCategoryId;
    this.saving = true;
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
              ? 'Category created'
              : 'Category updated',
          );
          this.showForm = false;
          this.fetchTableData({ page: 1, pageSize: 10 });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Operation failed'),
      });
  }

  cancel() {
    if (this.saving) return;
    this.showForm = false;
  }

  openDelete(row: any) {
    const x = row?._raw || row;
    this.deleteTarget = {
      categoryId: String(x?.categoryId || ''),
      categoryName: x?.categoryName || '',
    };
    this.deleteMessage = `Are you sure you want to delete "${this.deleteTarget.categoryName}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean) {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;
    const payload = {
      entiId: this.entiId,
      userId: localStorage.getItem('userId') || '',
      categoryId: this.deleteTarget.categoryId,
    };
    this.commonApi
      .fetchData(payload, this.moduleName, 'exam/category/delete')
      .subscribe({
        next: (res: any) => {
          if (res?.status === false) {
            this.alert.error(res?.message || 'Delete failed');
            return;
          }
          this.alert.success('Category deleted');
          this.fetchTableData({ page: 1, pageSize: 10 });
        },
        error: (err: any) =>
          this.alert.error(err?.error?.message || 'Delete failed'),
      });

    this.deleteTarget = null;
  }

  // ============== ADD SUB-CATEGORIES FROM CATEGORY ==============
  get subcategoryRows(): FormArray {
    return this.subcategoryForm?.get('rows') as FormArray;
  }

  private createSubcategoryRow(): FormGroup {
    return this.fb.group({
      subCategoryName: ['', [Validators.required, Validators.maxLength(120)]],
      subCategoryCode: ['', [Validators.maxLength(40)]],
      sortOrder: [0],
    });
  }

  openAddSubcategory(row: any) {
    this.subcategoryParent = {
      categoryId: row.categoryId,
      categoryName: row.categoryName,
    };
    this.subcategoryForm = this.fb.group({
      rows: this.fb.array([this.createSubcategoryRow()]),
    });
    this.showSubcategoryForm = true;
  }

  addSubcategoryRow(): void {
    this.subcategoryRows.push(this.createSubcategoryRow());
  }

  removeSubcategoryRow(index: number): void {
    if (this.subcategoryRows.length > 1) {
      this.subcategoryRows.removeAt(index);
    }
  }

  cancelSubcategory(): void {
    if (this.savingSubcategories) return;
    this.showSubcategoryForm = false;
    this.subcategoryParent = null;
  }

  saveSubcategories(): void {
    if (this.savingSubcategories) return;
    if (this.subcategoryRows.invalid) {
      this.subcategoryRows.markAllAsTouched();
      this.alert.error('Fill Sub-Category Name for all rows');
      return;
    }

    const rows = this.subcategoryRows.value || [];
    if (!rows.length) return;

    const p = this.subcategoryParent;
    this.savingSubcategories = true;
    let completed = 0;
    let failed = 0;

    for (const row of rows) {
      const payload = {
        entiId: this.entiId,
        userId: localStorage.getItem('userId') || '',
        categoryId: p.categoryId,
        subCategoryName: (row.subCategoryName || '').toString().trim(),
        subCategoryCode: (row.subCategoryCode || '').toString().trim() || null,
        sortOrder: Number(row.sortOrder || 0),
        status: 'Active',
      };
      this.commonApi.fetchData(payload, this.moduleName, 'exam/subcategory/create').subscribe({
        next: (res: any) => {
          completed++;
          if (res?.status === false) failed++;
          this.checkSubcategoryCompletion(rows.length, completed, failed);
        },
        error: () => {
          completed++;
          failed++;
          this.checkSubcategoryCompletion(rows.length, completed, failed);
        },
      });
    }
  }

  private checkSubcategoryCompletion(total: number, completed: number, failed: number): void {
    if (completed < total) return;
    this.savingSubcategories = false;
    const success = total - failed;
    if (success > 0) {
      this.alert.success(`${success} sub-category(s) created${failed > 0 ? `, ${failed} failed` : ''}`);
    } else {
      this.alert.error('All sub-category creations failed');
    }
    this.showSubcategoryForm = false;
    this.subcategoryParent = null;
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
    const categoryName = get(
      'Category Name',
      'CategoryName',
      'categoryName',
    ).trim();
    const categoryCode =
      get('Category Code', 'CategoryCode', 'categoryCode').trim() || null;
    const errors: string[] = [];
    if (!categoryName) errors.push('Category Name required');
    return {
      _rowNo: rowNo,
      _valid: errors.length === 0,
      _errors: errors,
      categoryName,
      categoryCode,
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
    const payload = {
      entiId: this.entiId,
      userId: localStorage.getItem('userId') || '',
      rows: this.importPreviewRows.map((r) => ({
        categoryName: r.categoryName,
        categoryCode: r.categoryCode,
      })),
    };
    this.importing = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'exam/category/import')
      .pipe(finalize(() => (this.importing = false)))
      .subscribe({
        next: (res: any) => {
          if (res?.status === false) {
            this.alert.error(res?.message || 'Import failed');
            return;
          }
          const d = res?.data || {};
          const msg = `Import completed. Accepted: ${d.accepted ?? '-'}, Upserted: ${d.upserted ?? '-'}`;
          this.alert.success(msg);
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
      { 'Category Name': 'Unit Test', 'Category Code': 'UT' },
      { 'Category Name': 'Board Exam', 'Category Code': 'BE' },
      { 'Category Name': 'Quarterly', 'Category Code': 'QT' },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ExamCategories');
    XLSX.writeFile(wb, 'ExamCategory_Import_Sample.xlsx');
  }
}
