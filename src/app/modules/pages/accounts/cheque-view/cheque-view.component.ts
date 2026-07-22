import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService } from '../../../../service/alert/alert.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { Location } from '@angular/common';

@Component({
  selector: 'app-cheque-view',
  standalone: false,
  templateUrl: './cheque-view.component.html',
  styleUrl: './cheque-view.component.scss',
})
export class ChequeViewComponent implements OnInit {
  private moduleName = 'accounts';
  entiId: any;
  paymentId = '';
  loading = false;
  payment: any = null;
  remarksDraft = '';
  showDepositModal = false;
  depositForm!: FormGroup;
  showReconcileModal = false;
  reconcileAction: 'CLEAR' | 'FAIL' = 'CLEAR';
  reconcileForm!: FormGroup;
  showRemarksModal = false;
  remarksForm!: FormGroup;
  showExtensionModal = false;
  extensionForm!: FormGroup;
  showReplaceModal = false;
  replaceForm!: FormGroup;
  showReplaceNeftModal = false;
  replaceNeftForm!: FormGroup;
  private pendingReplaceAction = '';
  bankAccounts: Array<{
    recId: string;
    bankName: string;
    accountNumber: string;
    display: string;
    isDefault?: boolean;
    depositLabel: string;
  }> = [];
  bankAccountsLoading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private alert: AlertService,
    private commonApi: CommonapiService,
    private fb: FormBuilder,
    private location: Location,
    private breadcrumb: BredcrumpService
  ) {
    this.entiId = localStorage.getItem('tenantId');
  }

  ngOnInit(): void {
    this.paymentId = String(
      this.route.snapshot.paramMap.get('id') || ''
    ).trim();
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Accounts' },
      { label: 'Cheques' },
      { label: 'Cheque View' },
    ]);
    if (!this.paymentId) {
      this.alert.error('Invalid paymentId');
      return;
    }
    this.depositForm = this.fb.group({
      depositDate: ['', Validators.required],
      bankName: [''],
    });
    this.reconcileForm = this.fb.group({
      date: [''],
      remarks: [''],
      failureReason: [''],
    });
    this.remarksForm = this.fb.group({
      remarks: ['', [Validators.maxLength(500)]],
    });
    this.extensionForm = this.fb.group({
      newPlannedDepositDate: ['', Validators.required],
      remarks: ['', [Validators.required, Validators.maxLength(500)]],
    });
    this.replaceForm = this.fb.group({
      chequeNo: ['', Validators.required],
      chequeDate: [''],
      dueDate: ['', Validators.required],
      mode: ['PDC', Validators.required],
      favourOf: ['', Validators.required],
      bankName: [''],
      amount: [null, [Validators.required, Validators.min(1)]],
      cancelReason: [''],
      remarks: [''],
    });
    this.replaceNeftForm = this.fb.group({
      utr: ['', Validators.required],
      amount: [null, [Validators.required, Validators.min(1)]],
      paidOn: [''],
      bankName: [''],
      branchName: [''],
      referenceNote: [''],
      cancelReason: [''],
      remarks: [''],
    });

    this.replaceForm.get('dueDate')?.valueChanges.subscribe((due: any) => {
      const dueStr = String(due || '').trim();
      if (!dueStr) return;
      const chequeDateCtrl = this.replaceForm.get('chequeDate');
      const curIssued = String(chequeDateCtrl?.value || '').trim();
      if (!curIssued) {
        chequeDateCtrl?.setValue(dueStr, { emitEvent: false });
      }
    });

    this.pendingReplaceAction = String(
      this.route.snapshot.queryParamMap.get('action') || ''
    ).trim();

    this.load();
    this.loadBankAccounts();
  }

  canDeposit(): boolean {
    const st = String(this.payment?.status || '').toUpperCase();
    return (
      !!this.paymentId && ['PENDING', 'SUBMITTED'].includes(st) && !this.loading
    );
  }

  canReconcile(): boolean {
    const st = String(this.payment?.status || '').toUpperCase();
    return !!this.paymentId && st === 'DEPOSITED' && !this.loading;
  }

  canRequestExtension(): boolean {
    const st = String(this.payment?.status || '').toUpperCase();
    return (
      !!this.paymentId &&
      !this.loading &&
      !['CLEARED', 'CANCELLED'].includes(st)
    );
  }

  canReplaceCheque(): boolean {
    const st = String(this.payment?.status || '').toUpperCase();
    return !!this.paymentId && !this.loading && st !== 'CLEARED';
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

  private maskAccountNo(acc: string): string {
    const s = String(acc || '').trim();
    if (!s) return '';
    if (s.length <= 4) return s;
    return `XXXX${s.slice(-4)}`;
  }

  private bankDisplay(b: any): string {
    const acc = this.maskAccountNo(b?.accountNumber);
    const bank = String(b?.bankName || '').trim();
    return `${acc} - ${bank}`.trim();
  }

  load() {
    this.loading = true;
    const payload = { entiId: this.entiId, paymentId: this.paymentId };
    this.commonApi
      .fetchData(payload, this.moduleName, 'cheque/view')
      .subscribe({
        next: (res: any) => {
          const data = res?.data || {};
          this.payment = data?.payment || null;
          const curRemarks = (this.payment?.remarks || '').toString();
          this.remarksForm?.patchValue(
            { remarks: curRemarks },
            { emitEvent: false }
          );
          this.loading = false;

          if (this.pendingReplaceAction === 'replace') {
            this.openReplaceModal();
          } else if (this.pendingReplaceAction === 'replace-neft') {
            this.openReplaceNeftModal();
          }
          this.pendingReplaceAction = '';
        },
        error: (err: any) => {
          this.loading = false;
          this.payment = null;
          this.alert.error(err?.error?.message || 'Failed to load cheque');
        },
      });
  }

  resetRemarks() {
    this.remarksDraft = this.payment?.remarks || '';
  }

  back() {
    this.location.back();
  }

  private buildDepositLabel(b: any): string {
    const acc = String(b?.accountNumber || '').trim();
    const bank = String(b?.bankName || '').trim();
    if (!acc && !bank) return '';
    if (!acc) return bank;
    if (!bank) return acc;
    return `${acc} - ${bank}`;
  }

  loadBankAccounts() {
    this.bankAccountsLoading = true;
    const payload = { entiId: this.entiId };
    this.commonApi
      .fetchData(payload, 'ims', `bankac/list?list=full`)
      .subscribe({
        next: (res: any) => {
          const rows = res?.data || [];

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
              a.depositLabel.localeCompare(b.depositLabel)
          );
          this.bankAccounts = mapped;
          const cur = String(this.depositForm?.value?.bankName || '').trim();
          if (!cur) {
            const def = mapped.find((m: any) => m.isDefault);
            if (def?.depositLabel) {
              this.depositForm.patchValue(
                { bankName: def.depositLabel },
                { emitEvent: false }
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

  openDepositModal() {
    if (!this.canDeposit()) {
      this.alert.error('Only PENDING/SUBMITTED cheques can be deposited');
      return;
    }
    const currentBank = String(this.depositForm?.value?.bankName || '').trim();
    this.depositForm.reset({ depositDate: '', bankName: currentBank || '' });
    if (!currentBank) {
      const def = this.bankAccounts.find((b) => b.isDefault);
      if (def?.depositLabel) {
        this.depositForm.patchValue(
          { bankName: def.depositLabel },
          { emitEvent: false }
        );
      }
    }
    this.showDepositModal = true;
  }

  closeDepositModal() {
    this.showDepositModal = false;
  }

  confirmDeposit() {
    if (!this.paymentId) return;
    if (!this.canDeposit()) {
      this.alert.error('Only PENDING/SUBMITTED cheques can be deposited');
      return;
    }
    if (this.depositForm.invalid) {
      this.alert.error('Please select deposit date');
      return;
    }
    const v = this.depositForm.value || {};
    const payload = {
      entiId: this.entiId,
      depositDate: String(v.depositDate || '').trim(),
      bankName: String(v.bankName || '').trim() || null,
      paymentIds: [this.paymentId],
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'deposit/create')
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.alert.success(res?.message || 'Cheque deposited');
          this.showDepositModal = false;
          this.load();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Failed to deposit cheque');
        },
      });
  }

  openReconcileModal(action: 'CLEAR' | 'FAIL') {
    if (!this.canReconcile()) {
      this.alert.error('Only DEPOSITED cheques can be reconciled');
      return;
    }
    this.reconcileAction = action;
    this.reconcileForm.reset({ date: '', remarks: '', failureReason: '' });
    this.showReconcileModal = true;
  }

  closeReconcileModal() {
    this.showReconcileModal = false;
  }

  confirmReconcile() {
    if (!this.paymentId) return;
    if (!this.canReconcile()) {
      this.alert.error('Only DEPOSITED cheques can be reconciled');
      return;
    }
    const userId = localStorage.getItem('userId') || '';
    const v = this.reconcileForm.value || {};
    const payload: any = {
      entiId: this.entiId,
      userId,
      paymentId: this.paymentId,
      action: this.reconcileAction,
      date: String(v.date || '').trim() || null,
      remarks: String(v.remarks || '').trim() || null,
    };
    if (this.reconcileAction === 'FAIL') {
      payload.failureReason =
        String(v.failureReason || '').trim() || 'Cheque bounced';
    }
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'cheque/reconcile')
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.alert.success(res?.message || 'Cheque reconciled');
          this.showReconcileModal = false;
          this.load();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Failed to reconcile cheque');
        },
      });
  }

  openRemarksModal() {
    if (!this.payment) return;
    const cur = (this.payment?.remarks || '').toString();
    this.remarksForm.patchValue({ remarks: cur }, { emitEvent: false });
    this.showRemarksModal = true;
  }

  closeRemarksModal() {
    this.showRemarksModal = false;
  }

  saveRemarks() {
    if (!this.paymentId) return;
    const userId = localStorage.getItem('userId') || '';
    const payload = {
      entiId: this.entiId,
      userId,
      paymentId: this.paymentId,
      remarks: (this.remarksForm.value?.remarks || '').toString().trim(),
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'cheque/update-remarks')
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.alert.success(res?.message || 'Remarks updated');
          this.showRemarksModal = false;
          this.load();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Failed to update remarks');
        },
      });
  }

  openExtensionModal() {
    if (!this.canRequestExtension()) {
      this.alert.error('Extension cannot be requested for this cheque');
      return;
    }
    const cur = (this.payment?.cheque?.plannedDepositDate || '').toString();
    this.extensionForm.reset({
      newPlannedDepositDate: '',
      remarks: '',
    });
    this.showExtensionModal = true;
  }

  closeExtensionModal() {
    this.showExtensionModal = false;
  }

  submitExtensionRequest() {
    if (!this.paymentId) return;
    if (!this.canRequestExtension()) {
      this.alert.error('Extension cannot be requested for this cheque');
      return;
    }
    if (this.extensionForm.invalid) {
      this.extensionForm.markAllAsTouched();
      this.alert.error('Please fill required fields');
      return;
    }
    const userId = localStorage.getItem('userId') || '';
    const v = this.extensionForm.value || {};
    const payload = {
      entiId: this.entiId,
      userId,
      paymentId: this.paymentId,
      newPlannedDepositDate: String(v.newPlannedDepositDate || '').trim(),
      remarks: String(v.remarks || '').trim(),
    };
    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'cheque/extension/request')
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.alert.success(res?.message || 'Extension request submitted');
          this.showExtensionModal = false;
          this.load();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(
            err?.error?.message || 'Failed to submit extension request'
          );
        },
      });
  }

  openReplaceModal() {
    if (!this.canReplaceCheque()) {
      this.alert.error('CLEARED cheque cannot be replaced');
      return;
    }
    const c = this.payment?.cheque || {};
    const issued = String(c?.dueDate || '').trim();
    const actualDue = String(c?.chequeDate || '').trim();
    this.replaceForm.reset({
      chequeNo: '',
      chequeDate: issued,
      dueDate: actualDue,
      mode: c?.mode || 'PDC',
      favourOf: c?.favourOf || '',
      bankName: c?.bankName || '',
      amount: this.payment?.amount || null,
      cancelReason: '',
      remarks: '',
    });
    this.showReplaceModal = true;
  }

  closeReplaceModal() {
    this.showReplaceModal = false;
  }

  openReplaceNeftModal() {
    if (!this.canReplaceCheque()) {
      this.alert.error('CLEARED cheque cannot be replaced');
      return;
    }
    this.replaceNeftForm.reset({
      utr: '',
      amount: this.payment?.amount || null,
      paidOn: '',
      bankName: '',
      branchName: '',
      referenceNote: '',
      cancelReason: '',
      remarks: '',
    });
    this.showReplaceNeftModal = true;
  }

  closeReplaceNeftModal() {
    this.showReplaceNeftModal = false;
  }

  submitReplaceNeft() {
    if (!this.paymentId) return;
    if (!this.canReplaceCheque()) {
      this.alert.error('CLEARED cheque cannot be replaced');
      return;
    }
    if (this.replaceNeftForm.invalid) {
      this.replaceNeftForm.markAllAsTouched();
      this.alert.error('Please fill required fields');
      return;
    }
    const userId = localStorage.getItem('userId') || '';
    const v = this.replaceNeftForm.value || {};

    const payload = {
      entiId: this.entiId,
      userId,
      oldPaymentId: this.paymentId,
      cancelReason: String(v.cancelReason || '').trim() || null,
      remarks: String(v.remarks || '').trim() || null,
      amount: Number(v.amount || 0),
      neft: {
        utr: String(v.utr || '').trim(),
        paidOn: String(v.paidOn || '').trim() || null,
        bankName: String(v.bankName || '').trim() || null,
        branchName: String(v.branchName || '').trim() || null,
        referenceNote: String(v.referenceNote || '').trim() || null,
      },
    };

    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'cheque/replacement/request-neft')
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          const newId = res?.data?.newPaymentId;
          this.alert.success(res?.message || 'Cheque replaced with NEFT');
          this.showReplaceNeftModal = false;

          if (newId) {
            this.router.navigate(['/app/accounts/cheques', newId]);
            return;
          }
          this.load();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(
            err?.error?.message || 'Failed to replace cheque with NEFT'
          );
        },
      });
  }

  submitReplacement() {
    if (!this.paymentId) return;
    if (!this.canReplaceCheque()) {
      this.alert.error('CLEARED cheque cannot be replaced');
      return;
    }
    if (this.replaceForm.invalid) {
      this.replaceForm.markAllAsTouched();
      this.alert.error('Please fill required fields');
      return;
    }
    const userId = localStorage.getItem('userId') || '';
    const v = this.replaceForm.value || {};

    const payload = {
      entiId: this.entiId,
      userId,
      oldPaymentId: this.paymentId,
      cancelReason: String(v.cancelReason || '').trim() || null,
      remarks: String(v.remarks || '').trim() || null,
      replacement: {
        chequeNo: String(v.chequeNo || '').trim(),
        chequeDate: String(v.dueDate || '').trim() || null,
        dueDate: String(v.chequeDate || '').trim(),
        favourOf: String(v.favourOf || '').trim(),
        mode: String(v.mode || '').trim(),
        bankName: String(v.bankName || '').trim() || null,
        amount: Number(v.amount || 0),
      },
    };

    this.loading = true;
    this.commonApi
      .fetchData(payload, this.moduleName, 'cheque/replacement/request')
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          const newId = res?.data?.newPaymentId;
          this.alert.success(res?.message || 'Cheque replaced');
          this.showReplaceModal = false;

          // Optional: navigate to new cheque view
          if (newId) {
            this.router.navigate(['/app/accounts/cheques', newId]);
            return;
          }
          this.load();
        },
        error: (err: any) => {
          this.loading = false;
          this.alert.error(err?.error?.message || 'Failed to replace cheque');
        },
      });
  }
}
