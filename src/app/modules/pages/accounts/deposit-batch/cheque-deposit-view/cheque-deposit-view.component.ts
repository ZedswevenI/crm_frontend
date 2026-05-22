import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BredcrumpService } from '../../../../../service/bredcrump/bredcrump.service';
import { AlertService } from '../../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../../service/commonapi/commonapi.service';

@Component({
  selector: 'app-cheque-deposit-view',
  standalone: false,
  templateUrl: './cheque-deposit-view.component.html',
  styleUrl: './cheque-deposit-view.component.scss',
})
export class ChequeDepositViewComponent implements OnInit {
  entiId: any;
  private moduleName = 'accounts';
  depositBatchId = '';
  loading = false;
  batch: any = null;
  payments: any[] = [];
  selectedMap: Record<string, boolean> = {};
  showReconcileModal = false;
  reconcileAction: 'CLEAR' | 'FAIL' = 'CLEAR';
  reconcileForm!: FormGroup;

  summary = { deposited: 0, cleared: 0, failed: 0, cancelled: 0 };

  private api = {
    view: 'deposit/view',
    bulkReconcile: 'cheque/bulk-reconcile',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private breadcrumb: BredcrumpService,
    private alert: AlertService,
    private commonApi: CommonapiService,
    private fb: FormBuilder,
  ) {
    this.entiId = localStorage.getItem('tenantId');
  }

  ngOnInit(): void {
    this.depositBatchId = String(
      this.route.snapshot.paramMap.get('id') || '',
    ).trim();
    this.breadcrumb.set([
      { label: 'Accounts' },
      { label: 'Cheque Deposit' },
      { label: 'Deposit View' },
    ]);
    this.reconcileForm = this.fb.group({
      date: [''],
      remarks: [''],
      failureReason: [''],
    });
    if (!this.depositBatchId) {
      this.alert.error('Invalid depositBatchId');
      return;
    }
    this.load();
  }

  get selectedIds(): string[] {
    return Object.keys(this.selectedMap || {}).filter(
      (k) => this.selectedMap[k] === true,
    );
  }

  get showBulkActions(): boolean {
    return (this.payments || []).some(
      (p) => String(p.status || '').toUpperCase() === 'DEPOSITED',
    );
  }

  back() {
    this.router.navigate(['/app/accounts/deposit']);
  }

  load() {
    this.loading = true;
    const payload = {
      entiId: this.entiId,
      depositBatchId: this.depositBatchId,
    };
    this.commonApi
      .fetchData(payload, this.moduleName, this.api.view)
      .subscribe({
        next: (res: any) => {
          const d = res?.data || {};
          this.batch = d?.batch || null;
          const rows = Array.isArray(d?.payments) ? d.payments : [];
          this.payments = rows.map((x: any) => ({
            paymentId: x?.paymentId,
            chequeNo: x?.cheque?.chequeNo || '-',
            dueDate: x?.cheque?.dueDate ?? null,
            plannedDepositDate:
              x?.cheque?.plannedDepositDate ?? x?.cheque?.dueDate ?? null,
            studentName: x?.studentName || '-',
            admissionNo: x?.admissionNo || x?.admissionId?.admissionNo || '-',
            amount: x?.amount || 0,
            status: x?.status || '-',
            _raw: x,
          }));
          this.computeSummary();
          this.cleanupSelection();
          this.loading = false;
        },
        error: (err: any) => {
          this.loading = false;
          this.batch = null;
          this.payments = [];
          this.alert.error(
            err?.error?.message || 'Failed to load deposit batch',
          );
        },
      });
  }

  private computeSummary() {
    const sum = { deposited: 0, cleared: 0, failed: 0, cancelled: 0 };
    (this.payments || []).forEach((p) => {
      const st = String(p.status || '').toUpperCase();
      if (st === 'DEPOSITED') sum.deposited++;
      else if (st === 'CLEARED') sum.cleared++;
      else if (st === 'FAILED') sum.failed++;
      else if (st === 'CANCELLED') sum.cancelled++;
    });
    this.summary = sum;
  }

  statusBadge(status: string): string {
    const s = String(status || '').toUpperCase();
    if (s === 'DEPOSITED') return 'bg-primary';
    if (s === 'CLEARED') return 'bg-success';
    if (s === 'FAILED') return 'bg-danger';
    if (s === 'CANCELLED') return 'bg-secondary';
    return 'bg-light text-dark';
  }

  isRowSelectDisabled(row: any): boolean {
    const st = String(row?.status || '').toUpperCase();
    return st !== 'DEPOSITED' || !this.showBulkActions || this.loading;
  }

  toggleRow(row: any, ev: Event) {
    const pid = row?.paymentId;
    if (!pid) return;
    if (this.isRowSelectDisabled(row)) return;
    const checked = (ev.target as HTMLInputElement).checked;
    if (checked) this.selectedMap[pid] = true;
    else delete this.selectedMap[pid];
  }

  toggleSelectAll(ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    const rows = Array.isArray(this.payments) ? this.payments : [];
    rows.forEach((r) => {
      const pid = r?.paymentId;
      if (!pid) return;
      if (this.isRowSelectDisabled(r)) return;
      if (checked) this.selectedMap[pid] = true;
      else delete this.selectedMap[pid];
    });
  }

  isAllSelectedOnPage(): boolean {
    const rows = Array.isArray(this.payments) ? this.payments : [];
    const selectable = rows.filter(
      (r) => !this.isRowSelectDisabled(r) && r?.paymentId,
    );
    if (!selectable.length) return false;
    return selectable.every((r) => !!this.selectedMap[r.paymentId]);
  }

  isSomeSelectedOnPage(): boolean {
    const rows = Array.isArray(this.payments) ? this.payments : [];
    const selectable = rows.filter(
      (r) => !this.isRowSelectDisabled(r) && r?.paymentId,
    );
    if (!selectable.length) return false;
    const selectedCount = selectable.filter(
      (r) => !!this.selectedMap[r.paymentId],
    ).length;
    return selectedCount > 0 && selectedCount < selectable.length;
  }

  private cleanupSelection() {
    const depositable = new Set(
      (this.payments || [])
        .filter((p) => String(p.status || '').toUpperCase() === 'DEPOSITED')
        .map((p) => String(p.paymentId || '').trim())
        .filter(Boolean),
    );
    Object.keys(this.selectedMap || {}).forEach((k) => {
      if (!depositable.has(k)) delete this.selectedMap[k];
    });
  }

  openChequeView(row: any) {
    const pid = row?.paymentId;
    if (!pid) return;
    this.router.navigate(['/app/accounts/cheques', pid]);
  }

  isReplaceAllowed(row: any): boolean {
    const st = String(row?.status || '').toUpperCase();
    return st === 'FAILED';
  }

  replaceCheque(row: any) {
    const pid = row?.paymentId;
    if (!pid) return;
    this.router.navigate(['/app/accounts/cheques', pid], {
      queryParams: { action: 'replace' },
    });
  }

  openBulkReconcile(action: 'CLEAR' | 'FAIL') {
    if (!this.showBulkActions) return;
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
      .fetchData(payload, this.moduleName, this.api.bulkReconcile)
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.alert.success(
            res?.message || `Bulk ${this.reconcileAction} completed`,
          );
          this.showReconcileModal = false;
          this.selectedMap = {};
          this.load();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Bulk reconcile failed');
        },
      });
  }
}
