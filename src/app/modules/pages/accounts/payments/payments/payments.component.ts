import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-payments',
  standalone: false,
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.scss',
})
export class PaymentsComponent implements OnInit {
  entiId: any;
  private moduleName = 'accounts';
  filterForm!: FormGroup;
  statusList = [
    'PENDING',
    'SUBMITTED',
    'DEPOSITED',
    'EXTENTION_REQUESTED',
    'CLEARED',
    'FAILED',
    'CANCELLED',
  ];
  paymentsData: any[] = [];
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
    private commonApi: CommonapiService,
    private router: Router
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([
      { label: 'Accounts' },
      { label: 'All Payments' },
    ]);
  }

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      search: [''],
      paymentType: ['ALL'],
      status: ['ALL'],
      programCode: [''],
      academicYear: [''],
      fromDue: [''],
      toDue: [''],
      fromPlanned: [''],
      toPlanned: [''],
      fromDeposit: [''],
      toDeposit: [''],
      fromPaid: [''],
      toPaid: [''],
      includeInactive: [false],
    });
    this.loadPayments({ page: 1, pageSize: this.pageSize });
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
      .map(
        (k) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`
      )
      .join('&');
    return `?${qs}`;
  }

  loadPayments(event?: { page: number; pageSize: number }) {
    const page = event?.page || this.currentPage || 1;
    const limit = event?.pageSize || this.pageSize || 20;
    this.currentPage = page;
    this.pageSize = limit;
    const f = this.filterForm.value || {};
    const sortMap: any = {
      paymentId: 'paymentId',
      type: 'paymentType',
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
      ...(f.paymentType
        ? { paymentType: String(f.paymentType).trim() }
        : { paymentType: 'ALL' }),
      ...(f.status ? { status: String(f.status).trim() } : { status: 'ALL' }),
      ...(f.programCode ? { programCode: String(f.programCode).trim() } : {}),
      ...(f.academicYear
        ? { academicYear: String(f.academicYear).trim() }
        : {}),
      ...(f.fromDue ? { fromDue: f.fromDue } : {}),
      ...(f.toDue ? { toDue: f.toDue } : {}),
      ...(f.fromPlanned ? { fromPlanned: f.fromPlanned } : {}),
      ...(f.toPlanned ? { toPlanned: f.toPlanned } : {}),
      ...(f.fromDeposit ? { fromDeposit: f.fromDeposit } : {}),
      ...(f.toDeposit ? { toDeposit: f.toDeposit } : {}),
      ...(f.fromPaid ? { fromPaid: f.fromPaid } : {}),
      ...(f.toPaid ? { toPaid: f.toPaid } : {}),
      ...(f.includeInactive ? { includeInactive: 'yes' } : {}),
      ...(sort ? { sort } : {}),
    });
    const payload = { entiId: this.entiId };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, `payments/list${qp}`)
      .subscribe({
        next: (res: any) => {
          const d = res?.data || {};
          const rows = Array.isArray(d.rows) ? d.rows : [];
          this.totalRecords = Number(d.total || 0);
          this.paymentsData = rows.map((x: any) => {
            const type = String(x?.paymentType || '').toUpperCase();
            const ref =
              type === 'NEFT'
                ? x?.neft?.utr
                  ? `UTR: ${x.neft.utr}`
                  : '-'
                : x?.cheque?.chequeNo
                ? `Cheque: ${x.cheque.chequeNo}`
                : '-';
            const keyDate =
              type === 'NEFT'
                ? x?.neft?.paidOn || '-'
                : x?.cheque?.plannedDepositDate || x?.cheque?.dueDate || '-';
            return {
              paymentId: x?.paymentId,
              paymentType: type || '-',
              ref,
              studentName: x?.studentName || '-',
              admissionNo: x?.admissionNo || '-',
              amount: x?.amount || 0,
              status: x?.status || '-',
              keyDate,
              depositBatchId: x?.depositBatchId || null,
              neft: x?.neft || null,
              cheque: x?.cheque || null,
              centerName: x?.centerName || '-',
              programName: x?.programName || '-',
              _raw: x,
            };
          });
          this.updatePagination();
          this.loading = false;
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Failed to load payments');
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
    this.loadPayments({ page: 1, pageSize: this.pageSize });
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
    this.loadPayments({ page, pageSize: this.pageSize });
  }

  applyFilters() {
    this.loadPayments({ page: 1, pageSize: this.pageSize });
  }

  resetFilters() {
    this.filterForm.reset({
      search: '',
      paymentType: 'ALL',
      status: 'ALL',
      programCode: '',
      academicYear: '',
      fromDue: '',
      toDue: '',
      fromPlanned: '',
      toPlanned: '',
      fromDeposit: '',
      toDeposit: '',
      fromPaid: '',
      toPaid: '',
      includeInactive: false,
    });
    this.loadPayments({ page: 1, pageSize: this.pageSize });
  }

  statusBadge(status: string): string {
    const s = String(status || '').toUpperCase();
    if (s === 'PENDING') return 'bg-warning text-dark';
    if (s === 'SUBMITTED') return 'bg-info text-dark';
    if (s === 'DEPOSITED') return 'bg-primary';
    if (s === 'EXTENTION_REQUESTED') return 'bg-warning text-dark';
    if (s === 'CLEARED') return 'bg-success';
    if (s === 'FAILED') return 'bg-danger';
    if (s === 'CANCELLED') return 'bg-secondary';
    return 'bg-light text-dark';
  }

  openView(row: any) {
    this.viewRow = row?._raw || row;
    this.showViewModal = true;
  }

  closeView() {
    this.showViewModal = false;
    this.viewRow = null;
  }

  openChequeView(paymentId: string) {
    const pid = String(paymentId || '').trim();
    if (!pid) return;
    this.router.navigate(['/app/accounts/cheques', pid]);
  }

  openNeftView(paymentId: string) {
    const pid = String(paymentId || '').trim();
    if (!pid) return;
    this.router.navigate(['/app/accounts/neft', pid]);
  }

  exportExcel() {
    const f = this.filterForm.value || {};
    const qp = this.buildQueryParams({
      list: 'full',
      ...(f.search ? { search: String(f.search).trim() } : {}),
      ...(f.paymentType
        ? { paymentType: String(f.paymentType).trim() }
        : { paymentType: 'ALL' }),
      ...(f.status ? { status: String(f.status).trim() } : { status: 'ALL' }),
      ...(f.programCode ? { programCode: String(f.programCode).trim() } : {}),
      ...(f.academicYear
        ? { academicYear: String(f.academicYear).trim() }
        : {}),
      ...(f.fromDue ? { fromDue: f.fromDue } : {}),
      ...(f.toDue ? { toDue: f.toDue } : {}),
      ...(f.fromPlanned ? { fromPlanned: f.fromPlanned } : {}),
      ...(f.toPlanned ? { toPlanned: f.toPlanned } : {}),
      ...(f.fromDeposit ? { fromDeposit: f.fromDeposit } : {}),
      ...(f.toDeposit ? { toDeposit: f.toDeposit } : {}),
      ...(f.fromPaid ? { fromPaid: f.fromPaid } : {}),
      ...(f.toPaid ? { toPaid: f.toPaid } : {}),
      ...(f.includeInactive ? { includeInactive: 'yes' } : {}),
    });
    const payload = { entiId: this.entiId };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, `payments/list${qp}`)
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          const apiRows = res?.data?.rows || [];
          const exportRows = apiRows.map((x: any) => {
            const type = String(x?.paymentType || '').toUpperCase();
            const chequeNo = x?.cheque?.chequeNo || '';
            const neftUtr = x?.neft?.utr || '';
            return {
              PaymentId: x?.paymentId || '',
              Type: type,
              Status: x?.status || '',
              Amount: Number(x?.amount || 0),
              AdmissionNo: x?.admissionNo || '',
              StudentName: x?.studentName || '',
              Center: x?.centerName || '',
              Program: x?.programName || '',
              ProgramCode: x?.programCode || '',
              AcademicYear: x?.academicYear || '',
              ChequeNo: type === 'CHEQUE' ? chequeNo : '',
              ChequeMode: type === 'CHEQUE' ? x?.cheque?.mode || '' : '',
              ChequeBank: type === 'CHEQUE' ? x?.cheque?.bankName || '' : '',
              ChequeDueDate:
                type === 'CHEQUE'
                  ? this.formatYmdToDmy(x?.cheque?.dueDate)
                  : '',
              PlannedDepositDate:
                type === 'CHEQUE'
                  ? this.formatYmdToDmy(
                      x?.cheque?.plannedDepositDate || x?.cheque?.dueDate
                    )
                  : '',
              UTR: type === 'NEFT' ? neftUtr : '',
              PaidOn:
                type === 'NEFT' ? this.formatYmdToDmy(x?.neft?.paidOn) : '',
              NEFTBank: type === 'NEFT' ? x?.neft?.bankName || '' : '',
              DepositedOn: this.formatYmdToDmy(x?.depositedOn),
              ClearedOn: this.formatYmdToDmy(x?.clearedOn),
              FailedOn: this.formatYmdToDmy(x?.failedOn),
              FailureReason: x?.failureReason || '',
              DepositBatchId: x?.depositBatchId || '',
            };
          });

          const fileName = `Payments_${this.formatYmdToDmy(
            new Date().toISOString().slice(0, 10)
          ).replaceAll('-', '')}.xlsx`;
          const ws = XLSX.utils.json_to_sheet(exportRows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Cheques');
          XLSX.writeFile(wb, fileName);
          this.alert.success(`Exported ${exportRows.length} records`);
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Export failed');
        },
      });
  }

  private formatYmdToDmy(ymd: any): string {
    const s = String(ymd || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '-';
    const [y, m, d] = s.split('-');
    return `${d}-${m}-${y}`;
  }

}
