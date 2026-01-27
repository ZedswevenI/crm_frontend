import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';

@Component({
  selector: 'app-cheque-deposit',
  standalone: false,
  templateUrl: './cheque-deposit.component.html',
  styleUrl: './cheque-deposit.component.scss',
})
export class ChequeDepositComponent implements OnInit {
  entiId: any;
  private moduleName = 'accounts';
  filterForm!: FormGroup;
  rows: any[] = [];
  totalRecords = 0;
  loading = false;
  currentPage = 1;
  pageSize = 20;
  sortKey: string = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';
  paginationItems: Array<{ page: number | '...'; isActive?: boolean }> = [];
  private api = {
    list: 'deposit/list',
  };

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService,
    private router: Router,
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([{ label: 'Accounts' }, { label: 'Deposit Batches' }]);
  }

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      search: [''],
      fromDate: [''],
      toDate: [''],
    });

    this.loadBatches({ page: 1, pageSize: this.pageSize });
  }

  get totalPages(): number {
    return Math.ceil(this.totalRecords / this.pageSize) || 1;
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

  loadBatches(event?: { page: number; pageSize: number }) {
    const page = event?.page || this.currentPage || 1;
    const limit = event?.pageSize || this.pageSize || 20;
    this.currentPage = page;
    this.pageSize = limit;
    const f = this.filterForm.value || {};
    const sort = this.sortKey
      ? this.sortDirection === 'asc'
        ? this.sortKey
        : `-${this.sortKey}`
      : '-createdAt';
    const qp = this.buildQueryParams({
      page,
      limit,
      ...(f.search ? { search: String(f.search).trim() } : {}),
      ...(f.fromDate ? { fromDate: f.fromDate } : {}),
      ...(f.toDate ? { toDate: f.toDate } : {}),
      ...(sort ? { sort } : {}),
    });
    const payload = { entiId: this.entiId };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, `${this.api.list}${qp}`)
      .subscribe({
        next: (res: any) => {
          const d = res?.data || {};
          const rows = Array.isArray(d.rows) ? d.rows : [];
          this.rows = rows.map((x: any) => ({
            depositBatchId: x?.batchId || '-',
            depositDate: x?.depositDate ?? null,
            bankName: x?.bankName || '-',
            chequeCount: x?.chequeCount || 0,
            totalAmount: x?.totalAmount || 0,
            _raw: x,
          }));
          this.totalRecords = Number(d.total || 0);
          this.updatePagination();
          this.loading = false;
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(
            err?.error?.message || 'Failed to load deposit batches',
          );
        },
      });
  }

  onSort(key: string) {
    if (!key) return;
    if (this.sortKey === key)
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
    this.loadBatches({ page: 1, pageSize: this.pageSize });
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
    this.loadBatches({ page, pageSize: this.pageSize });
  }

  applyFilters() {
    this.loadBatches({ page: 1, pageSize: this.pageSize });
  }

  resetFilters() {
    this.filterForm.reset({ search: '', fromDate: '', toDate: '' });
    this.loadBatches({ page: 1, pageSize: this.pageSize });
  }

  view(row: any) {
    const id = row?.depositBatchId;
    if (!id) return;
    this.router.navigate(['/app/accounts/deposit', id]);
  }
}
