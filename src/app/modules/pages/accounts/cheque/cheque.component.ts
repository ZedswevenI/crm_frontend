import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

import * as XLSX from 'xlsx';

@Component({
  selector: 'app-cheque',
  standalone: false,
  templateUrl: './cheque.component.html',
  styleUrl: './cheque.component.scss',
})
export class ChequeComponent implements OnInit {
  entiId: any;
  private moduleName = 'accounts';
  filterForm!: FormGroup;
  statusList = [
    'PENDING',
    'SUBMITTED',
    'DEPOSITED',
    'CLEARED',
    'FAILED',
    'CANCELLED',
  ];
  centerOptions: any[] = [];
  programOptions: any[] = [];
  chequeData: any[] = [];
  totalRecords = 0;
  selectedMap: Record<string, boolean> = {};
  showDepositModal = false;
  depositForm!: FormGroup;
  showReconcileModal = false;
  reconcileAction: 'CLEAR' | 'FAIL' = 'CLEAR';
  reconcileForm!: FormGroup;
  loading = false;
  bankAccounts: Array<{
    bankName: string;
    accountNumber: string;
    isDefault?: boolean;
    depositLabel: string;
  }> = [];
  bankAccountsLoading = false;
  currentPage = 1;
  pageSize = 10;
  sortKey: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  paginationItems: Array<{ page: number | '...'; isActive?: boolean }> = [];

  constructor(
    private fb: FormBuilder,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService,
    private router: Router,
  ) {
    this.entiId = localStorage.getItem('tenantId');
    this.breadcrumb.set([{ label: 'Accounts' }, { label: 'Cheque Register' }]);
  }

  ngOnInit(): void {
    this.initForms();
    this.loadDropdowns();
    this.loadBankAccounts();
    // this.loadCheques({ page: 1, pageSize: 10 });

    // added for filter
    const savedFilters = sessionStorage.getItem('chequeFilters');

    if (savedFilters) {
      this.filterForm.patchValue(JSON.parse(savedFilters));
    }

    this.loadCheques({ page: 1, pageSize: 10 });
  }

  get totalPages(): number {
    return Math.ceil(this.totalRecords / this.pageSize) || 1;
  }

  initForms() {
    this.filterForm = this.fb.group({
      search: [''],
      status: ['ALL'],
      mode: [''],
      centerCode: [''],
      programCode: [''],
      fromDue: [''],
      toDue: [''],
      fromPlanned: [''],
      toPlanned: [''],
      fromDeposit: [''],
      toDeposit: [''],
      includeInactive: [false],
    });
    this.depositForm = this.fb.group({
      depositDate: [''],
      bankName: [''],
    });
    this.reconcileForm = this.fb.group({
      date: [''],
      remarks: [''],
      failureReason: [''],
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

  private buildDepositLabel(b: any): string {
    const acc = String(b?.accountNumber || '').trim();
    const bank = String(b?.bankName || '').trim();
    if (!acc && !bank) return '';
    if (!acc) return bank;
    if (!bank) return acc;
    return `${acc} - ${bank}`;
  }

  loadDropdowns() {
    this.loadCenters();
    this.loadPrograms();
  }

  loadCenters() {
    const payload = { entiId: this.entiId };
    this.commonApi
      .fetchData(payload, 'ims', 'center/list?list=full')
      .subscribe({
        next: (res: any) => {
          this.centerOptions = Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.rows)
              ? res.rows
              : [];
        },
        error: () => {
          this.centerOptions = [];
        },
      });
  }

  loadPrograms() {
    const payload = { entiId: this.entiId };
    this.commonApi
      .fetchData(payload, 'ims', 'program/list?list=full')
      .subscribe({
        next: (res: any) => {
          this.programOptions = Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.rows)
              ? res.rows
              : [];
        },
        error: () => {
          this.programOptions = [];
        },
      });
  }

  loadBankAccounts() {
    this.bankAccountsLoading = true;
    const payload = { entiId: this.entiId };
    this.commonApi
      .fetchData(payload, 'ims', 'bankac/list?list=full')
      .subscribe({
        next: (res: any) => {
          const rows = Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.rows)
              ? res.rows
              : [];
          const mapped = (rows || [])
            .map((x: any) => ({
              accountNumber: x?.accountNumber,
              bankName: x?.bankName,
              isDefault: !!x?.isDefault,
              depositLabel: this.buildDepositLabel(x),
            }))
            .filter((x: any) => !!x.depositLabel);
          mapped.sort(
            (a: any, b: any) =>
              (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) ||
              a.depositLabel.localeCompare(b.depositLabel),
          );
          this.bankAccounts = mapped;
          const cur = String(this.depositForm?.value?.bankName || '').trim();
          if (!cur) {
            const def = mapped.find((m: any) => m.isDefault);
            if (def?.depositLabel) {
              this.depositForm.patchValue(
                { bankName: def.depositLabel },
                { emitEvent: false },
              );
            }
          }
          this.bankAccountsLoading = false;
        },
        error: () => {
          this.bankAccountsLoading = false;
          this.bankAccounts = [];
        },
      });
  }

  loadCheques(event?: {
    page: number;
    pageSize: number;
    sortKey?: string;
    sortDirection?: 'asc' | 'desc';
  }) {
    const page = event?.page || this.currentPage || 1;
    const limit = event?.pageSize || this.pageSize || 10;
    this.currentPage = page;
    this.pageSize = limit;
    const f = this.filterForm.value || {};
    const sortMap: any = {
      dueDate: 'cheque.dueDate',
      plannedDepositDate: 'cheque.plannedDepositDate',
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
      ...(f.mode ? { mode: String(f.mode).trim() } : {}),
      ...(f.centerCode ? { centerCode: String(f.centerCode).trim() } : {}),
      ...(f.programCode ? { programCode: String(f.programCode).trim() } : {}),
      ...(f.fromDue ? { fromDue: f.fromDue } : {}),
      ...(f.toDue ? { toDue: f.toDue } : {}),
      ...(f.fromPlanned ? { fromPlanned: f.fromPlanned } : {}),
      ...(f.toPlanned ? { toPlanned: f.toPlanned } : {}),
      ...(f.fromDeposit ? { fromDeposit: f.fromDeposit } : {}),
      ...(f.toDeposit ? { toDeposit: f.toDeposit } : {}),
      ...(f.includeInactive ? { includeInactive: 'yes' } : {}),
      ...(sort ? { sort } : {}),
    });
    const payload = { entiId: this.entiId };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, `cheque/list${qp}`)
      .subscribe({
        next: (res: any) => {
          const d = res?.data || {};
          const rows = Array.isArray(d.rows) ? d.rows : [];
          this.totalRecords = Number(d.total || 0);
          this.chequeData = rows.map((x: any) => ({
            paymentId: x?.paymentId,
            chequeNo: x?.cheque?.chequeNo || '-',
            dueDate: x?.cheque?.dueDate || null,
            plannedDepositDate:
              x?.cheque?.plannedDepositDate || x?.cheque?.dueDate || null,
            studentName: x?.studentName || '-',
            admissionNo: x?.admissionId.admissionNo || '-',
            amount: x?.amount || 0,
            status: x?.status || '-',
            bankName: x?.cheque?.bankName || '-',
            mode: x?.cheque?.mode || '-',
            _raw: x,
          }));

          this.cleanupSelectionForCurrentPage();
          this.updatePagination();
          this.loading = false;
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Failed to load cheques');
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
    this.loadCheques({ page: 1, pageSize: this.pageSize });
  }

  sortIcon(key: string) {
    if (this.sortKey !== key) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  toggleRow(row: any, ev: Event) {
    const pid = row?.paymentId;
    if (!pid) return;

    const checked = (ev.target as HTMLInputElement).checked;
    if (checked) this.selectedMap[pid] = true;
    else delete this.selectedMap[pid];
  }

  toggleSelectAll(ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    const rows = Array.isArray(this.chequeData) ? this.chequeData : [];

    rows.forEach((r) => {
      const pid = r?.paymentId;
      if (!pid) return;
      if (this.isRowSelectDisabled(r)) return;

      if (checked) this.selectedMap[pid] = true;
      else delete this.selectedMap[pid];
    });
  }

  isAllSelectedOnPage(): boolean {
    const rows = Array.isArray(this.chequeData) ? this.chequeData : [];
    const selectable = rows.filter(
      (r) => !this.isRowSelectDisabled(r) && r?.paymentId,
    );
    if (!selectable.length) return false;
    return selectable.every((r) => !!this.selectedMap[r.paymentId]);
  }

  isSomeSelectedOnPage(): boolean {
    const rows = Array.isArray(this.chequeData) ? this.chequeData : [];
    const selectable = rows.filter(
      (r) => !this.isRowSelectDisabled(r) && r?.paymentId,
    );
    if (!selectable.length) return false;
    const selectedCount = selectable.filter(
      (r) => !!this.selectedMap[r.paymentId],
    ).length;
    return selectedCount > 0 && selectedCount < selectable.length;
  }

  cleanupSelectionForCurrentPage() {
    const pageIds = new Set(
      (this.chequeData || [])
        .map((r) => String(r.paymentId || ''))
        .filter(Boolean),
    );
    Object.keys(this.selectedMap || {}).forEach((k) => {
      if (!pageIds.has(k)) delete this.selectedMap[k];
    });
  }

  isRowSelectDisabled(row: any): boolean {
    const st = String(row?.status || '').toUpperCase();
    return false;
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
    this.loadCheques({ page, pageSize: this.pageSize });
  }

  edit(row: any) {
    const pid = row?.paymentId;
    if (!pid) return;
    this.router.navigate(['/accounts/cheques', pid], {
      queryParams: { mode: 'edit' },
    });
  }

  statusBadge(status: string): string {
    const s = String(status || '').toUpperCase();
    if (s === 'PENDING') return 'bg-warning text-dark';
    if (s === 'SUBMITTED') return 'bg-info text-dark';
    if (s === 'DEPOSITED') return 'bg-primary';
    if (s === 'CLEARED') return 'bg-success';
    if (s === 'FAILED') return 'bg-danger';
    if (s === 'CANCELLED') return 'bg-secondary';
    return 'bg-light text-dark';
  }

  // applyFilters() {
  //   this.loadCheques({ page: 1, pageSize: 10 });
  // }

  // added for filter
  applyFilters() {
    const filters = this.filterForm.value;

    sessionStorage.setItem('chequeFilters', JSON.stringify(filters));

    this.loadCheques({
      page: 1,
      pageSize: 10
    });
  }

  // resetFilters() {
  //   this.filterForm.reset({
  //     search: '',
  //     status: 'ALL',
  //     mode: '',
  //     centerCode: '',
  //     programCode: '',
  //     fromDue: '',
  //     toDue: '',
  //     fromPlanned: '',
  //     toPlanned: '',
  //     fromDeposit: '',
  //     toDeposit: '',
  //     includeInactive: false,
  //   });
  //   this.loadCheques({ page: 1, pageSize: 10 });
  // }

  // added for filter
  resetFilters() {
    sessionStorage.removeItem('chequeFilters');

    this.filterForm.reset({
      search: '',
      status: 'ALL',
      mode: '',
      centerCode: '',
      programCode: '',
      fromDue: '',
      toDue: '',
      fromPlanned: '',
      toPlanned: '',
      fromDeposit: '',
      toDeposit: ''
    });

    this.loadCheques({ page: 1, pageSize: 10 });
  }

  view(row: any) {
    const pid = row?.paymentId;
    if (!pid) return;
    this.router.navigate(['/app/accounts/cheques', pid]);
  }

  get selectedIds(): string[] {
    return Object.keys(this.selectedMap || {}).filter(
      (k) => this.selectedMap[k] === true,
    );
  }

  openDepositModal() {
    if (!this.selectedIds.length) {
      this.alert.error('Please select cheques');
      return;
    }
    const currentBank = String(this.depositForm?.value?.bankName || '').trim();
    this.depositForm.reset({ depositDate: '', bankName: currentBank || '' });
    if (!currentBank) {
      const def = this.bankAccounts.find((b) => b.isDefault);
      if (def?.depositLabel) {
        this.depositForm.patchValue(
          { bankName: def.depositLabel },
          { emitEvent: false },
        );
      }
    }
    this.showDepositModal = true;
  }

  closeDepositModal() {
    this.showDepositModal = false;
  }

  createDepositBatch() {
    if (this.depositForm.invalid) {
      this.alert.error('Please select deposit date');
      return;
    }
    if (!this.selectedIds.length) {
      this.alert.error('Please select cheques');
      return;
    }
    const payload = {
      entiId: this.entiId,
      depositDate: String(this.depositForm.value?.depositDate || '').trim(),
      bankName: String(this.depositForm.value?.bankName || '').trim() || null,
      paymentIds: this.selectedIds,
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'deposit/create')
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.alert.success(res?.message || 'Deposit batch created');
          this.showDepositModal = false;
          this.selectedMap = {};
          this.loadCheques({ page: this.currentPage, pageSize: this.pageSize });
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(
            err?.error?.message || 'Failed to create deposit batch',
          );
        },
      });
  }

  bulkReconcile() {
    if (!this.selectedIds.length) {
      this.alert.error('Please select cheques');
      return;
    }
    const f = this.reconcileForm.value || {};
    const payload: any = {
      entiId: this.entiId,
      paymentIds: this.selectedIds,
      action: this.reconcileAction,
      date: String(f?.date || '').trim() || null,
      remarks: String(f?.remarks || '').trim() || null,
    };
    if (this.reconcileAction === 'FAIL') {
      payload.failureReason =
        String(f?.failureReason || '').trim() || 'Cheque bounced';
    }
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'cheque/bulk-reconcile')
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.alert.success(
            res?.message || `Bulk ${this.reconcileAction} completed`,
          );
          this.showReconcileModal = false;
          this.selectedMap = {};
          this.loadCheques({ page: this.currentPage, pageSize: this.pageSize });
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Bulk reconcile failed');
        },
      });
  }

  openBulkReconcile(action: 'CLEAR' | 'FAIL') {
    if (!this.selectedIds.length) {
      this.alert.error('Please select cheques');
      return;
    }
    this.reconcileAction = action;
    this.reconcileForm.reset({ date: '', remarks: '', failureReason: '' });
    this.showReconcileModal = true;
  }

  closeReconcileModal() {
    this.showReconcileModal = false;
  }

  exportExcel() {
    const f = this.filterForm.value || {};
    const sortMap: any = {
      dueDate: 'cheque.dueDate',
      plannedDepositDate: 'cheque.plannedDepositDate',
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
      list: 'full',
      ...(f.search ? { search: String(f.search).trim() } : {}),
      ...(f.status ? { status: String(f.status).trim() } : { status: 'ALL' }),
      ...(f.mode ? { mode: String(f.mode).trim() } : {}),
      ...(f.centerCode ? { centerCode: String(f.centerCode).trim() } : {}),
      ...(f.programCode ? { programCode: String(f.programCode).trim() } : {}),
      ...(f.fromDue ? { fromDue: f.fromDue } : {}),
      ...(f.toDue ? { toDue: f.toDue } : {}),
      ...(f.fromPlanned ? { fromPlanned: f.fromPlanned } : {}),
      ...(f.toPlanned ? { toPlanned: f.toPlanned } : {}),
      ...(f.fromDeposit ? { fromDeposit: f.fromDeposit } : {}),
      ...(f.toDeposit ? { toDeposit: f.toDeposit } : {}),
      ...(f.includeInactive ? { includeInactive: 'yes' } : {}),
      ...(sort ? { sort } : {}),
    });
    const payload = { entiId: this.entiId };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, `cheque/list${qp}`)
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          const d = res?.data;
          const rows = Array.isArray(d)
            ? d
            : Array.isArray(d?.rows)
              ? d.rows
              : [];
          const excelRows = rows.map((x: any, idx: number) => ({
            'S.No': idx + 1,
            'Cheque No': x?.cheque?.chequeNo || '-',
            'Due Date': x?.cheque?.dueDate || '-',
            'Planned Deposit':
              x?.cheque?.plannedDepositDate || x?.cheque?.dueDate || '-',
            'Student Name': x?.studentName || '-',
            'Admission No': x?.admissionId?.admissionNo || '-',
            Center: x?.centerName || x?.centerCode || '-',
            Program: x?.programName || x?.programCode || '-',
            Amount: Number(x?.amount || 0),
            Status: x?.status || '-',
            Mode: x?.cheque?.mode || '-',
            'Cheque Bank': x?.cheque?.bankName || '-',
            'Deposit Bank': x?.deposit?.bankName || x?.depositBankName || '-',
            'Deposit Date': x?.deposit?.depositDate || x?.depositDate || '-',
          }));
          const ws = XLSX.utils.json_to_sheet(excelRows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Cheques');
          const fileName = `Cheque_Register_${new Date()
            .toISOString()
            .slice(0, 10)}.xlsx`;
          XLSX.writeFile(wb, fileName);
          this.alert.success('Excel exported');
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Export failed');
        },
      });
  }
}
