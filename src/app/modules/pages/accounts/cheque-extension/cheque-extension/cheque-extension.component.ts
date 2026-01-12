import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';

@Component({
  selector: 'app-cheque-extension',
  standalone: false,
  templateUrl: './cheque-extension.component.html',
  styleUrl: './cheque-extension.component.scss'
})
export class ChequeExtensionComponent implements OnInit {
  entiId: any;
  private moduleName = 'accounts';

  filterForm!: FormGroup;
  statusList = ['PENDING', 'APPROVED', 'REJECTED'];

  rows: any[] = [];
  totalRecords = 0;
  loading = false;

  currentPage = 1;
  pageSize = 20;

  sortKey: string = '';
  sortDirection: 'asc' | 'desc' = 'desc';
  paginationItems: Array<{ page: number | '...'; isActive?: boolean }> = [];

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService,
    private router: Router
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([{ label: 'Accounts' }, { label: 'Cheque Extensions' }]);
  }

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      search: [''],
      status: ['ALL'],
    });
    this.load({ page: 1, pageSize: this.pageSize });
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

  load(event?: { page: number; pageSize: number }) {
    const page = event?.page || this.currentPage || 1;
    const limit = event?.pageSize || this.pageSize || 20;

    this.currentPage = page;
    this.pageSize = limit;

    const f = this.filterForm.value || {};

    // backend sorts by createdAt desc already, but we also allow "sort" param style like your other screens
    const sortMap: any = {
      requestId: 'requestId',
      paymentId: 'paymentId',
      oldPlannedDepositDate: 'oldPlannedDepositDate',
      newPlannedDepositDate: 'newPlannedDepositDate',
      status: 'status',
    };
    const sortKeyDb = this.sortKey ? sortMap[this.sortKey] : null;
    const sort = sortKeyDb ? (this.sortDirection === 'asc' ? sortKeyDb : `-${sortKeyDb}`) : '';

    const qp = this.buildQueryParams({
      page,
      limit,
      ...(f.search ? { search: String(f.search).trim() } : {}),
      ...(f.status ? { status: String(f.status).trim() } : { status: 'ALL' }),
      ...(sort ? { sort } : {}),
    });

    const payload = { entiId: this.entiId };

    this.loading = true;
    this.commonApi.fetchData(payload, this.moduleName, `cheque/extension/list${qp}`).subscribe({
      next: (res: any) => {
        const d = res?.data || {};
        const rows = Array.isArray(d.rows) ? d.rows : [];
        this.totalRecords = Number(d.total || 0);

        this.rows = rows.map((x: any) => ({
          requestId: x?.requestId || '-',
          paymentId: x?.paymentId || '-',
          oldPlannedDepositDate: x?.oldPlannedDepositDate || '-',
          newPlannedDepositDate: x?.newPlannedDepositDate || '-',
          status: x?.status || '-',
          remarks: x?.remarks || '',
          _raw: x,
        }));

        this.updatePagination();
        this.loading = false;
      },
      error: (err: any) => {
        this.loading = false;
        this.alert.error(err?.error?.message || 'Failed to load extension requests');
      },
    });
  }

  onSort(key: string) {
    if (!key) return;
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
    this.load({ page: 1, pageSize: this.pageSize });
  }

  sortIcon(key: string) {
    if (this.sortKey !== key) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  statusBadge(status: string): string {
    const s = String(status || '').toUpperCase();
    if (s === 'PENDING') return 'bg-warning text-dark';
    if (s === 'APPROVED') return 'bg-success';
    if (s === 'REJECTED') return 'bg-danger';
    return 'bg-light text-dark';
  }

  applyFilters() {
    this.load({ page: 1, pageSize: this.pageSize });
  }

  resetFilters() {
    this.filterForm.reset({ search: '', status: 'ALL' });
    this.load({ page: 1, pageSize: this.pageSize });
  }

  goPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.load({ page, pageSize: this.pageSize });
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

    this.paginationItems = pages.map((p) => ({ page: p, isActive: p === current })) as any;
  }

  view(row: any) {
    console.log(row)
    const id = row?.requestId;
    if (!id) return;
    this.router.navigate(['/app/accounts/extention', id]);
  }
}
