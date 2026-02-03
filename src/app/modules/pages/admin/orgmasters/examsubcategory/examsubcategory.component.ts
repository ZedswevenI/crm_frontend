import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';

@Component({
  selector: 'app-examsubcategory',
  standalone: false,
  templateUrl: './examsubcategory.component.html',
  styleUrl: './examsubcategory.component.scss'
})
export class ExamsubcategoryComponent implements OnInit {
  private moduleName = 'ims';
  entiId: any;

  form!: FormGroup;
  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  editingRecId: string | null = null;

  loading = false;
  totalRecords = 0;
  tableData: any[] = [];

  // category dropdown
  categoryOptions: any[] = [];
  private categoryById = new Map<string, any>();

  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';

  columns = [
    { key: 'categoryName', label: 'Category', sortable: true },
    { key: 'subCategoryName', label: 'Sub Category', sortable: true },
    { key: 'sortOrder', label: 'Sort', sortable: true },
    { key: 'subCategoryCode', label: 'Code', sortable: false },
    { key: 'status', label: 'Status', sortable: true },
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

  private loadCategories() {
    this.commonApi.fetchData({ entiId: this.entiId }, this.moduleName, 'exam/category/list?list=full').subscribe({
      next: (res: any) => {
        const rows = res?.data || [];
        this.categoryOptions = rows.map((x: any) => ({
          label: x.categoryName || x.categoryCode || x.categoryId,
          value: x.categoryId,
        }));

        this.categoryById.clear();
        for (const r of rows) this.categoryById.set(String(r.categoryId), r);
      },
      error: () => {
        this.categoryOptions = [];
        this.categoryById.clear();
      },
    });
  }

  fetchTableData(params: { page: number; pageSize: number; search?: string; sortKey?: string; sortDirection?: string }) {
    this.loading = true;

    let sortParam = '';
    if (params.sortKey) sortParam = params.sortDirection === 'desc' ? `-${params.sortKey}` : params.sortKey;

    const query: any = { page: params.page, limit: params.pageSize };
    if (sortParam) query.sort = sortParam;
    if (params.search) query.search = params.search;

    const queryString = Object.keys(query)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
      .join('&');

    this.commonApi.fetchData({ entiId: this.entiId }, this.moduleName, `exam/subcategory/list?${queryString}`).subscribe({
      next: (res: any) => {
        const rows = res?.data || [];
        this.tableData = rows.map((x: any) => ({
          recId: x._id,
          subCategoryId: x.subCategoryId,
          categoryId: x.categoryId,
          categoryName: x.categoryName || this.categoryById.get(String(x.categoryId))?.categoryName || '-',
          subCategoryName: x.subCategoryName,
          subCategoryCode: x.subCategoryCode || '-',
          sortOrder: this.toNum(x.sortOrder),
          status: x.status || 'Active',
          _raw: x,
        }));
        this.totalRecords = res?.count || 0;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.alert.error('Failed to load exam sub categories');
      },
    });
  }

  add() {
    this.formMode = 'create';
    this.editingRecId = null;
    this.form.reset({ categoryId: '', subCategoryName: '', subCategoryCode: '', sortOrder: 0, isActive: true });
    this.showForm = true;
  }

  edit(row: any) {
    const x = row?._raw || row;
    this.formMode = 'edit';
    this.editingRecId = x?._id;

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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.alert.error('Please fill required fields');
      return;
    }

    const raw = this.form.getRawValue();
    const payload: any = {
      entiId: this.entiId,
      categoryId: String(raw.categoryId || '').trim(),
      subCategoryName: String(raw.subCategoryName || '').trim(),
      subCategoryCode: String(raw.subCategoryCode || '').trim() || null,
      sortOrder: this.toNum(raw.sortOrder),
      status: raw.isActive ? 'Active' : 'Inactive',
    };
    if (this.formMode === 'edit') payload.recId = this.editingRecId;

    const endpoint = this.formMode === 'create' ? 'exam/subcategory/create' : 'exam/subcategory/update';

    this.commonApi.fetchData(payload, this.moduleName, endpoint).subscribe({
      next: () => {
        this.alert.success(this.formMode === 'create' ? 'Sub category created' : 'Sub category updated');
        this.showForm = false;
        this.fetchTableData({ page: 1, pageSize: 10 });
      },
      error: (err: any) => this.alert.error(err?.error?.message || 'Operation failed'),
    });
  }

  cancel() {
    this.showForm = false;
  }

  openDelete(row: any) {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete "${row.subCategoryName}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean) {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;

    const payload = { entiId: this.entiId, recId: this.deleteTarget.recId };

    this.commonApi.fetchData(payload, this.moduleName, 'exam/subcategory/delete').subscribe({
      next: () => {
        this.alert.success('Sub category deleted');
        this.fetchTableData({ page: 1, pageSize: 10 });
      },
      error: (err: any) => this.alert.error(err?.error?.message || 'Delete failed'),
    });

    this.deleteTarget = null;
  }
}
