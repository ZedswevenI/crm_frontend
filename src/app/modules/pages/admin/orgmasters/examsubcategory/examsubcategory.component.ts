import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';
import * as XLSX from 'xlsx';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-examsubcategory',
  standalone: false,
  templateUrl: './examsubcategory.component.html',
  styleUrl: './examsubcategory.component.scss',
})
export class ExamsubcategoryComponent implements OnInit {
  private moduleName = 'ims';
  entiId: any;
  form!: FormGroup;
  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  editingSubCategoryId: string | null = null;
  saving = false;
  loading = false;
  totalRecords = 0;
  tableData: any[] = [];
  categoryOptions: any[] = [];
  private categoryById = new Map<string, any>();
  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';
  showImport = false;
  importForm!: FormGroup;
  importFileName = '';
  importPreviewRows: any[] = [];
  importHasInvalidRows = false;
  importInvalidCount = 0;
  importing = false;

  columns = [
    { key: 'categoryName', label: 'Category Name', sortable: true },
    { key: 'subCategoryName', label: 'Sub-category Name', sortable: true },
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
  private categoryNameToId = new Map<string, string>();
  private categoryCodeToId = new Map<string, string>();

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
      { label: 'Exam Sub Category' },
    ]);
  }

  ngOnInit(): void {
    this.initForm();
    this.initImportForm();
    this.loadCategories();
  }

  private initForm() {
    this.form = this.fb.group({
      categoryId: ['', Validators.required],
      subCategoryName: ['', Validators.required],
      subCategoryCode: [''],
      sortOrder: [0, [Validators.required, Validators.min(0)]],
      isActive: [true],
    });
  }

  private initImportForm() {
    this.importForm = this.fb.group({});
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

  private loadCategories() {
    this.commonApi
      .fetchData(
        { entiId: this.entiId },
        this.moduleName,
        'exam/category/list?list=full',
      )
      .subscribe({
        next: (res: any) => {
          const rows = Array.isArray(res?.data) ? res.data : [];
          this.categoryOptions = rows.map((x: any) => ({
            label: x.categoryName || x.categoryCode || x.categoryId,
            value: x.categoryId,
          }));

          this.categoryById.clear();
          for (const r of rows) this.categoryById.set(String(r.categoryId), r);
          this.categoryNameToId.clear();
          this.categoryCodeToId.clear();

          for (const r of rows) {
            const id = String(r.categoryId || '').trim();
            const nm = String(r.categoryName || '')
              .trim()
              .toUpperCase();
            const cd = String(r.categoryCode || '')
              .trim()
              .toUpperCase();
            if (nm && id) this.categoryNameToId.set(nm, id);
            if (cd && id) this.categoryCodeToId.set(cd, id);
          }
        },
        error: () => {
          this.categoryOptions = [];
          this.categoryById.clear();
        },
      });
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
      categoryName: 'categoryName', // if backend supports; else harmless
      subCategoryName: 'subCategoryName',
      sortOrder: 'sortOrder',
      status: 'status',
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

    // IMPORTANT: your route is POST '/exam/subcategory/list' (not GET)
    this.commonApi
      .fetchData(
        { entiId: this.entiId },
        this.moduleName,
        `exam/subcategory/list${qp}`,
      )
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: any) => {
          const rows = Array.isArray(res?.data) ? res.data : [];

          this.tableData = rows.map((x: any) => ({
            // keep raw mongo id too
            recId: x._id,
            categoryId: x.categoryId,
            subCategoryId: x.subCategoryId,
            categoryName:
              x.categoryName ||
              this.categoryById.get(String(x.categoryId))?.categoryName ||
              '-',
            subCategoryName: x.subCategoryName,
            subCategoryCode: x.subCategoryCode || '-',
            sortOrder: this.toNum(x.sortOrder),
            status: x.status || 'Active',
            _raw: x,
          }));

          this.totalRecords = res?.count || 0;
        },
        error: () => this.alert.error('Failed to load exam sub categories'),
      });
  }

  add() {
    this.formMode = 'create';
    this.editingSubCategoryId = null;

    this.form.reset({
      categoryId: '',
      subCategoryName: '',
      subCategoryCode: '',
      sortOrder: 0,
      isActive: true,
    });

    this.showForm = true;
  }

  edit(row: any) {
    const x = row?._raw || row;
    this.formMode = 'edit';

    // backend edit needs subCategoryId + categoryId
    this.editingSubCategoryId = String(x?.subCategoryId || '');

    this.form.patchValue({
      categoryId: String(x?.categoryId || ''),
      subCategoryName: x?.subCategoryName || '',
      subCategoryCode: x?.subCategoryCode || '',
      sortOrder: this.toNum(x?.sortOrder),
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
      categoryId: String(raw.categoryId || '').trim(),
      subCategoryName: String(raw.subCategoryName || '').trim(),
      subCategoryCode: String(raw.subCategoryCode || '').trim() || null,
      sortOrder: this.toNum(raw.sortOrder),
      status: raw.isActive ? 'Active' : 'Inactive',
    };

    const endpoint =
      this.formMode === 'create'
        ? 'exam/subcategory/create'
        : 'exam/subcategory/update';

    // IMPORTANT: backend update requires subCategoryId + categoryId
    if (this.formMode === 'edit')
      payload.subCategoryId = this.editingSubCategoryId;

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
              ? 'Sub category created'
              : 'Sub category updated',
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
      subCategoryId: String(x?.subCategoryId || ''),
      subCategoryName: x?.subCategoryName || '',
    };

    this.deleteMessage = `Are you sure you want to delete "${this.deleteTarget.subCategoryName}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean) {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;

    const payload = {
      entiId: this.entiId,
      userId: localStorage.getItem('userId') || '',
      categoryId: this.deleteTarget.categoryId,
      subCategoryId: this.deleteTarget.subCategoryId,
    };

    this.commonApi
      .fetchData(payload, this.moduleName, 'exam/subcategory/delete')
      .subscribe({
        next: (res: any) => {
          if (res?.status === false) {
            this.alert.error(res?.message || 'Delete failed');
            return;
          }
          this.alert.success('Sub category deleted');
          this.fetchTableData({ page: 1, pageSize: 10 });
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

    const categoryRaw = get(
      'Category',
      'Category Name',
      'CategoryName',
      'category',
      'categoryName',
    );
    const categoryCodeRaw = get(
      'Category Code',
      'CategoryCode',
      'categoryCode',
    );

    const subCategoryName = get(
      'Sub Category Name',
      'SubCategoryName',
      'subCategoryName',
    ).trim();
    const subCategoryCode =
      get('Sub Category Code', 'SubCategoryCode', 'subCategoryCode').trim() ||
      null;

    const sortOrderRaw = get('Sort Order', 'SortOrder', 'sortOrder');
    const sortOrder = this.toNum(sortOrderRaw);

    const errors: string[] = [];

    const catNameKey = String(categoryRaw || '')
      .trim()
      .toUpperCase();
    const catCodeKey = String(categoryCodeRaw || '')
      .trim()
      .toUpperCase();

    let categoryId: string | null = null;
    if (catCodeKey && this.categoryCodeToId.has(catCodeKey))
      categoryId = this.categoryCodeToId.get(catCodeKey) || null;
    else if (catNameKey && this.categoryNameToId.has(catNameKey))
      categoryId = this.categoryNameToId.get(catNameKey) || null;

    if (!categoryId) errors.push('Category not found');
    if (!subCategoryName) errors.push('Sub Category Name required');

    const categoryLabel =
      (catCodeKey ? catCodeKey : '') || (catNameKey ? catNameKey : '') || '-';

    return {
      _rowNo: rowNo,
      _valid: errors.length === 0,
      _errors: errors,

      categoryId,
      categoryLabel,

      subCategoryName,
      subCategoryCode,
      sortOrder,
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

    // group by categoryId (so user can upload entire institute in one file)
    const grouped = new Map<string, any[]>();
    for (const r of this.importPreviewRows) {
      const cid = String(r.categoryId || '').trim();
      if (!cid) continue;
      if (!grouped.has(cid)) grouped.set(cid, []);
      grouped.get(cid)!.push(r);
    }

    const keys = Array.from(grouped.keys());
    if (!keys.length) {
      this.alert.error('No valid rows to import');
      return;
    }

    this.importing = true;

    const runNext = (idx: number) => {
      if (idx >= keys.length) {
        this.importing = false;
        this.alert.success('Import completed');

        // force close + reset
        this.showImport = false;
        this.resetImport();

        this.fetchTableData({ page: 1, pageSize: 10 });
        return;
      }

      const categoryId = keys[idx];
      const rows = (grouped.get(categoryId) || []).map((x) => ({
        subCategoryName: x.subCategoryName,
        subCategoryCode: x.subCategoryCode,
        sortOrder: this.toNum(x.sortOrder),
      }));

      const payload = {
        entiId: this.entiId,
        categoryId,
        rows,
      };

      this.commonApi
        .fetchData(payload, this.moduleName, 'exam/subcategory/import')
        .subscribe({
          next: (res: any) => {
            if (res?.status === false) {
              this.importing = false;
              this.alert.error(
                res?.message || `Import failed for category ${categoryId}`,
              );
              return;
            }
            runNext(idx + 1);
          },
          error: (err: any) => {
            this.importing = false;
            this.alert.error(
              err?.error?.message || `Import failed for category ${categoryId}`,
            );
          },
        });
    };

    runNext(0);
  }

  downloadSampleExcel() {
    const rows = [
      {
        Category: 'UNIT TEST', // Category Name OR Category Code
        'Sub Category Name': 'Unit Test - 1',
        'Sub Category Code': 'UT1',
        'Sort Order': 1,
      },
      {
        Category: 'UNIT TEST',
        'Sub Category Name': 'Unit Test - 2',
        'Sub Category Code': 'UT2',
        'Sort Order': 2,
      },
      {
        Category: 'BOARD', // Category Name OR Category Code
        'Sub Category Name': 'Board - Model',
        'Sub Category Code': 'BM',
        'Sort Order': 3,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ExamSubCategories');
    XLSX.writeFile(wb, 'ExamSubCategory_Import_Sample.xlsx');
  }
}
