import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

@Component({
  selector: 'app-neft-register',
  standalone: false,
  templateUrl: './neft-register.component.html',
  styleUrl: './neft-register.component.scss'
})
export class NeftRegisterComponent implements OnInit {
  entiId: any;
  private moduleName = 'accounts';

  filterForm!: FormGroup;
  statusList = ['PENDING', 'SUBMITTED', 'CANCELLED'];
  paymentCategoryOptions = [
    'ADMISSION',
    'HOSTEL',
    'TRANSPORT',
    'MISCELLANEOUS',
  ];

  neftData: any[] = [];
  totalRecords = 0;

  loading = false;

  currentPage = 1;
  pageSize = 20;

  sortKey: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  paginationItems: Array<{ page: number | '...'; isActive?: boolean }> = [];

  showViewModal = false;
  viewRow: any = null;

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([{ label: 'Accounts' }, { label: 'NEFT Register' }]);
  }

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      search: [''],
      status: ['ALL'],
      paymentCategory: ['ALL'],
      includeInactive: [false],
    });

    this.loadNeft({ page: 1, pageSize: this.pageSize });
  }

  get totalPages(): number {
    return Math.ceil(this.totalRecords / this.pageSize) || 1;
  }

  private buildQueryParams(params: Record<string, any>) {
    const keys = Object.keys(params || {}).filter(
      (k) => params[k] !== undefined && params[k] !== null && params[k] !== ''
    );
    if (!keys.length) return '';
    const qs = keys
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`)
      .join('&');
    return `?${qs}`;
  }

  loadNeft(event?: { page: number; pageSize: number }) {
    const page = event?.page || this.currentPage || 1;
    const limit = event?.pageSize || this.pageSize || 20;

    this.currentPage = page;
    this.pageSize = limit;

    const f = this.filterForm.value || {};

    // backend uses parseSort(q.sort || '-createdAt')
    // we’ll map ui sort keys into db fields.
    const sortMap: any = {
      utr: 'neft.utr',
      studentName: 'studentName',
      admissionNo: 'admissionNo',
      amount: 'amount',
      status: 'status',
    };
    const sortKeyDb = this.sortKey ? sortMap[this.sortKey] : null;
    const sort = sortKeyDb
      ? this.sortDirection === 'asc'
        ? sortKeyDb
        : `-${sortKeyDb}`
      : '';

    const qp = this.buildQueryParams({
      page,
      limit,
      ...(f.search ? { search: String(f.search).trim() } : {}),
      ...(f.status ? { status: String(f.status).trim() } : { status: 'ALL' }),
      ...(f.paymentCategory && f.paymentCategory !== 'ALL'
        ? { paymentCategory: String(f.paymentCategory).trim() }
        : {}),
      ...(f.includeInactive ? { includeInactive: 'yes' } : {}),
      ...(sort ? { sort } : {}),
    });

    this.loading = true;
    const payload = { entiId: this.entiId };

    // ✅ endpoint from your backend: listNeft -> `neft/list`
    this.commonApi.fetchData(payload, this.moduleName, `neft/list${qp}`).subscribe({
      next: (res: any) => {
        const d = res?.data || {};
        const rows = Array.isArray(d.rows) ? d.rows : [];
        this.totalRecords = Number(d.total || 0);

        this.neftData = rows.map((x: any) => ({
          paymentId: x?.paymentId,
          admissionNo: x?.admissionNo || '-',
          studentName: x?.studentName || '-',
          centerName: x?.centerName || '-',
          programName: x?.programName || '-',
          amount: x?.amount || 0,
          status: x?.status || '-',
          utr: x?.neft?.utr || '-',
          remarks: x?.neft?.remarks || x?.remarks || null,
          paymentCategory: x?.paymentCategory || 'ADMISSION',
          categoryLabel: x?.categoryLabel || '',
          _raw: x,
        }));

        this.updatePagination();
        this.loading = false;
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Failed to load NEFT list');
      },
    });
  }

  onSort(key: string) {
    if (!key) return;
    if (this.sortKey === key) this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
    this.loadNeft({ page: 1, pageSize: this.pageSize });
  }

  sortIcon(key: string) {
    if (this.sortKey !== key) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  updatePagination(): void {
    const total = this.totalPages || 1;
    const current = this.currentPage || 1;
    const pages: Array<number | '...'> = [];
    const push = (p: number | '...') => pages.push(p);

    if (total <= 7) {
      for (let p = 1; p <= total; p++) push(p);
    } else {
      const showLeft = Math.max(2, current - 1);
      const showRight = Math.min(total - 1, current + 1);
      push(1);
      if (showLeft > 2) push('...');
      for (let p = showLeft; p <= showRight; p++) push(p);
      if (showRight < total - 1) push('...');
      push(total);
    }

    this.paginationItems = pages.map((p) => ({
      page: p,
      isActive: p === current,
    })) as any;
  }

  goPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.loadNeft({ page, pageSize: this.pageSize });
  }

  applyFilters() {
    this.loadNeft({ page: 1, pageSize: this.pageSize });
  }

  resetFilters() {
    this.filterForm.reset({ search: '', status: 'ALL', paymentCategory: 'ALL', includeInactive: false });
    this.loadNeft({ page: 1, pageSize: this.pageSize });
  }

  statusBadge(status: string): string {
    const s = String(status || '').toUpperCase();
    if (s === 'PENDING') return 'bg-warning text-dark';
    if (s === 'SUBMITTED') return 'bg-info text-dark';
    if (s === 'VERIFIED' || s === 'APPROVED') return 'bg-success';
    if (s === 'REJECTED') return 'bg-danger';
    if (s === 'CANCELLED') return 'bg-secondary';
    return 'bg-light text-dark';
  }

  openView(row: any) {
    this.viewRow = row;
    this.showViewModal = true;
  }

  closeView() {
    this.showViewModal = false;
    this.viewRow = null;
  }
}
