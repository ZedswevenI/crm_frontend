import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';

@Component({
  selector: 'app-examcategory',
  standalone: false,
  templateUrl: './examcategory.component.html',
  styleUrl: './examcategory.component.scss'
})
export class ExamcategoryComponent implements OnInit {
  private moduleName = 'ims';
  entiId: any;

  form!: FormGroup;
  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  editingRecId: string | null = null;

  loading = false;
  totalRecords = 0;
  tableData: any[] = [];

  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';

  columns = [
    { key: 'categoryName', label: 'Category Name', sortable: true },
    { key: 'categoryCode', label: 'Code', sortable: false },
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
      { label: 'Exam Category' },
    ]);
  }

  ngOnInit(): void {
    this.initForm();
  }

  private initForm() {
    this.form = this.fb.group({
      categoryName: ['', Validators.required],
      categoryCode: [''],
      isActive: [true],
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

    this.commonApi.fetchData({ entiId: this.entiId }, this.moduleName, `exam/category/list?${queryString}`).subscribe({
      next: (res: any) => {
        const rows = res?.data || [];
        this.tableData = rows.map((x: any) => ({
          recId: x._id,
          categoryId: x.categoryId,
          categoryName: x.categoryName,
          categoryCode: x.categoryCode || '-',
          status: x.status || 'Active',
          _raw: x,
        }));
        this.totalRecords = res?.count || 0;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.alert.error('Failed to load exam categories');
      },
    });
  }

  add() {
    this.formMode = 'create';
    this.editingRecId = null;
    this.form.reset({ categoryName: '', categoryCode: '', isActive: true });
    this.showForm = true;
  }

  edit(row: any) {
    const x = row?._raw || row;
    this.formMode = 'edit';
    this.editingRecId = x?._id;

    this.form.patchValue({
      categoryName: x?.categoryName || '',
      categoryCode: x?.categoryCode || '',
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
      categoryName: String(raw.categoryName || '').trim(),
      categoryCode: String(raw.categoryCode || '').trim() || null,
      status: raw.isActive ? 'Active' : 'Inactive',
    };
    if (this.formMode === 'edit') payload.recId = this.editingRecId;

    const endpoint = this.formMode === 'create' ? 'exam/category/create' : 'exam/category/update';

    this.commonApi.fetchData(payload, this.moduleName, endpoint).subscribe({
      next: () => {
        this.alert.success(this.formMode === 'create' ? 'Category created' : 'Category updated');
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
    this.deleteMessage = `Are you sure you want to delete "${row.categoryName}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean) {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;

    const payload = { entiId: this.entiId, recId: this.deleteTarget.recId };

    this.commonApi.fetchData(payload, this.moduleName, 'exam/category/delete').subscribe({
      next: () => {
        this.alert.success('Category deleted');
        this.fetchTableData({ page: 1, pageSize: 10 });
      },
      error: (err: any) => this.alert.error(err?.error?.message || 'Delete failed'),
    });

    this.deleteTarget = null;
  }
}
