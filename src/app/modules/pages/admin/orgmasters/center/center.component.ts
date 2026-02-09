import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CenterService } from '../../../../../service/admin/orgmasters/center.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-center',
  standalone: false,
  templateUrl: './center.component.html',
  styleUrl: './center.component.scss'
})
export class CenterComponent implements OnInit {

  centerForm!: FormGroup;
  formMode: 'create' | 'edit' = 'create';
  showForm = false;
  editingId: string | null = null;
  deleteModalVisible = false;
  deleteTarget: any | null = null;
  deleteMessage = '';
  loading = false;
  totalRecords = 0;
  centerData: any[] = [];
  entiId: any;
  institutes = [
    { id: 1, name: 'Z7i Institute - Main' },
    { id: 2, name: 'Z7i Institute - Chennai' }
  ];

  instituteOptions = this.institutes.map(i => ({
    label: i.name,
    value: i.id
  }));

  columns = [
    { key: 'centerName', label: 'Center Name', sortable: false },
    { key: 'centerCode', label: 'Code', sortable: false },
    { key: 'city', label: 'City', sortable: false },
    { key: 'state', label: 'State', sortable: false },
    { key: 'status', label: 'Status', sortable: false }
  ];

  actions = [
  {
    type: 'icon',
    icon: 'fa-regular fa-eye',
    tooltip: 'View',
    callback: (row: any) => this.view(row)
  },
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
    hoverColor: '#D42B2B',
    callback: (row: any) => this.openDelete(row)
  }
  ];
  saving = false;

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alertService: AlertService,
    private centerService: CenterService,
    private api: CommonapiService,
    private router : Router
  ) {
    this.entiId = localStorage.getItem('tenantId')
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Masters' },
      { label: 'Centers' }
    ]);
  }

  ngOnInit(): void {
    this.centerForm = this.fb.group({
       name: ['', Validators.required],
      code: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      isActive: [true],
      contactName: ['', Validators.required],
      address1: ['', Validators.required],
      address2: ['', Validators.required],
      area: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    });
  }

  loadCenters(): void {
    this.centerService.listCenters(this.entiId).subscribe({
      next: (res) => {
        this.centerData = res?.data || [];
      },
      error: (err) => this.alertService.error(err)
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

    // Pagination & Sort
    let sortParam = '';
    if (params.sortKey) {
      sortParam =
        params.sortDirection === 'desc'
          ? `-${params.sortKey}`
          : params.sortKey;
    }

    const query: any = {
      page: params.page,
      limit: params.pageSize
    };
    if (sortParam) query.sort = sortParam;
    if (params.search) query.search = params.search;

    // Build query string
    const queryString = Object.keys(query)
      .map(
        (key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`
      )
      .join('&');

    const body = {
      entiId: localStorage.getItem('tenantId')
    };

    this.api.fetchData(body, 'ims/center', `list?list=full`).subscribe({
      next: (res: any) => {
        this.centerData = res.data;
        this.totalRecords = res.data?.total || 0;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.alertService.error('Error loading admissions');
      }
    });
  }

  add(): void {
    this.formMode = 'create';
    this.editingId = null;

    this.centerForm.reset({
      isActive: true
    });

    this.showForm = true;
  }

  edit(row: any): void {
    this.formMode = 'edit';
    this.editingId = row.recId || row._id;
    this.centerForm.patchValue({
      name: row.centerName,
      code: row.centerCode,
      instituteId: row.instituteId,
      city: row.city,
      state: row.state,
      isActive: row.status === 'Active',
      phone: row.phone,
      contactName: row.cntatName,
      address1: row.address1,
      address2: row.address2,
      area: row.area,
      pincode: row.pincode
    });
    this.showForm = true;
  }

  save(): void {
    if (this.saving) return;
    if (this.centerForm.invalid) {
      this.centerForm.markAllAsTouched();
      return;
    }
    this.saving = true;
    const f = this.centerForm.value;
    const payload: any = {
      entiId: this.entiId,
      centerName: f.name,
      centerCode: f.code,
      phone: f.phone,
      contactName: f.contactName,
      address1: f.address1,
      address2: f.address2,
      area: f.area,
      city: f.city,
      state: f.state,
      country: 'India',
      pincode: f.pincode,
      status: f.isActive ? 'Active' : 'Inactive'
    };
    const api$ =
      this.formMode === 'create'
        ? this.centerService.createCenter(payload)
        : this.centerService.updateCenter({ ...payload, recId: this.editingId });
    api$
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (res: any) => {
          if (res?.status === false || (res?.success === false && !res.data)) {
            this.alertService.error(res?.message || 'Operation failed');
            return;
          }
          this.alertService.success(
            this.formMode === 'create'
              ? 'Center created successfully'
              : 'Center updated successfully'
          );
          this.showForm = false;
          this.loadCenters();
        },
        error: (err) => {
          this.alertService.error(err || 'Server error');
        }
      });
  }

  cancel(): void {
    if (this.saving) return;
    this.showForm = false;
  }

  openDelete(row: any): void {
    this.deleteTarget = row;
    this.deleteMessage = `Are you sure you want to delete center "${row.centerName}"?`;
    this.deleteModalVisible = true;
  }

  onDeleteModalClosed(confirmed: boolean): void {
    this.deleteModalVisible = false;
    if (!confirmed || !this.deleteTarget) return;
    this.centerService
      .deleteCenter(this.entiId, this.deleteTarget._id)
      .subscribe({
        next: () => {
          this.alertService.success('Center deleted');
          this.loadCenters();
        },
        error: (err) => this.alertService.error(err)
      });
    this.deleteTarget = null;
  }

  view(row: any) {
  const id = row?._id || row?.recId;
  if (!id) return;
  this.router.navigate(['/app/admin/masters/centers/view', id]);
}
}
