import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { AlertService } from '../../../../service/alert/alert.service';

type ChequeMode = 'PDC' | 'CDC' | 'DD' | 'NEFT' | 'UPI' | 'CASH';

@Component({
  selector: 'app-admissionpayments-editor',
  standalone: false,
  templateUrl: './admissionpayments-editor.component.html',
  styleUrl: './admissionpayments-editor.component.scss',
})
export class AdmissionpaymentsEditorComponent implements OnInit {
  admissionId = '';
  registrationNumber = '';
  loading = true;
  submitting = false;
  payForm!: UntypedFormGroup;
  feeEditForm!: UntypedFormGroup;
  finalFee = 0;
  neftSplitAmount = 0;
  rawPayments: any[] = [];

  readonly DEFAULT_FAVOUR_OF = 'ZEDSWEVEN I PRIVATE LIMITED';
  bankNames: string[] = [
    'STATE BANK OF INDIA',
    'HDFC BANK',
    'ICICI BANK',
    'AXIS BANK',
    'KOTAK MAHINDRA BANK',
    'PUNJAB NATIONAL BANK',
    'BANK OF BARODA',
    'CANARA BANK',
    'UNION BANK OF INDIA',
    'INDIAN BANK',
    'IDBI BANK',
    'YES BANK',
    'INDUSIND BANK',
    'FEDERAL BANK',
    'RBL BANK',
    'BANDHAN BANK',
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: UntypedFormBuilder,
    private api: CommonapiService,
    private alert: AlertService,
  ) {}

  ngOnInit(): void {
    this.admissionId = String(
      this.route.snapshot.paramMap.get('id') || '',
    ).trim();
    if (!this.admissionId) {
      this.alert.error('Invalid admission id');
      this.back();
      return;
    }

    this.payForm = this.fb.group({
      neftAmount: [{ value: 0, disabled: true }],
      neftRefs: this.fb.array([]),
      cheques: this.fb.array([]),
    });
    this.feeEditForm = this.fb.group({
      testScholarshipPct: [{ value: 0, disabled: true }],
      scholarshipPct: [{ value: 0, disabled: true }],
      additionalScholarshipPct: [{ value: 0, disabled: true }],
    });

    this.load();
  }

  trackByIndex(i: number): number {
    return i;
  }

  get neftRefsFA(): UntypedFormArray {
    return this.payForm.get('neftRefs') as UntypedFormArray;
  }

  get chequesFA(): UntypedFormArray {
    return this.payForm.get('cheques') as UntypedFormArray;
  }

  get neftAmount(): number {
    return Number(this.payForm.getRawValue().neftAmount ?? 0) || 0;
  }

  get neftTotalEntered(): number {
    return (this.neftRefsFA.getRawValue() || []).reduce(
      (s: number, r: any) => s + (Number(r.amount) || 0),
      0,
    );
  }

  get chequeCount(): number {
    return this.chequesFA.length;
  }

  get chequeTotal(): number {
    return (this.chequesFA.getRawValue() || []).reduce(
      (s: number, r: any) => s + (Number(r.amount) || 0),
      0,
    );
  }

  get totalCollected(): number {
    return (this.neftTotalEntered || 0) + (this.chequeTotal || 0);
  }

  get balanceAmount(): number {
    const due = this.roundRupee(this.finalFee || 0);
    const paid = this.roundRupee(this.totalCollected || 0);
    return Math.max(0, due - paid);
  }

  private pickTenantId(): string {
    return (
      localStorage.getItem('tenantId') ||
      localStorage.getItem('tenantid') ||
      ''
    ).trim();
  }

  load(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId/userId missing. Please login again.');
      this.router.navigate(['/auth/login']);
      return;
    }

    this.loading = true;
    const viewBody = { entiId: tenantId, admissionId: this.admissionId };
    this.api.fetchData(viewBody, 'admi', 'view').subscribe({
      next: (resp: any) => {
        if (!resp?.status || !resp?.data?.admission) {
          this.loading = false;
          this.alert.error(
            resp?.message || resp?.error || 'Failed to load admission',
          );
          this.back();
          return;
        }

        const adm = resp.data.admission;
        this.rawPayments = Array.isArray(resp.data.payments)
          ? resp.data.payments
          : [];
        this.registrationNumber = safeStr(adm?.registrationNumber);

        const breakup = Array.isArray(adm?.fee?.breakup)
          ? adm.fee.breakup
          : [];
        const breakupSum = breakup.reduce(
          (s: number, r: any) => s + (Number(r?.total || 0) || 0),
          0,
        );
        this.finalFee = this.roundRupee(
          Number(adm?.fee?.finalFee || 0) || breakupSum,
        );
        this.neftSplitAmount = this.roundRupee(
          Number(adm?.payments?.neft?.splitAmount || 0),
        );

        this.feeEditForm.patchValue(
          {
            testScholarshipPct: Number(adm?.fee?.testScholarshipPct || 0),
            scholarshipPct: Number(adm?.fee?.scholarshipPct || 0),
            additionalScholarshipPct: Number(
              adm?.fee?.additionalScholarshipPct || 0,
            ),
          },
          { emitEvent: false },
        );

        this.buildPaymentFormsFromSaved(this.rawPayments);

        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.alert.error('Failed to load admission');
        this.back();
      },
    });
  }

  private buildPaymentFormsFromSaved(payments: any[]): void {
    const nefts = (payments || []).filter(
      (p) => String(p.paymentType || '').toUpperCase() === 'NEFT',
    );
    const chqs = (payments || []).filter(
      (p) => String(p.paymentType || '').toUpperCase() === 'CHEQUE',
    );

    this.payForm
      .get('neftAmount')
      ?.setValue(this.neftSplitAmount, { emitEvent: false });

    const neftFA = this.fb.array([]);
    if (nefts.length) {
      nefts.forEach((p: any) => {
        neftFA.push(
          this.fb.group({
            utr: [
              safeStr(p?.neft?.utr),
              [Validators.required, Validators.minLength(6)],
            ],
            amount: [
              Number(p.amount || 0),
              [Validators.required, Validators.min(1)],
            ],
            paidOn: [this.epochToISODateInput(p?.neft?.paidOn || null)],
            bankName: [safeStr(p?.neft?.bankName)],
            branchName: [safeStr(p?.neft?.branchName)],
            referenceNote: [safeStr(p?.neft?.referenceNote)],
            remarks: [safeStr(p?.remarks)],
          }),
        );
      });
    } else {
      neftFA.push(this.buildEmptyNeftRow(this.neftSplitAmount));
    }
    this.payForm.setControl('neftRefs', neftFA);

    const chqFA = this.fb.array([]);
    chqs
      .sort(
        (a: any, b: any) =>
          (Number(a?.cheque?.sno || 0) || 0) -
          (Number(b?.cheque?.sno || 0) || 0),
      )
      .forEach((p: any) => {
        chqFA.push(
          this.fb.group({
            sno: [Number(p?.cheque?.sno || 0) || 0],
            description: [safeStr(p?.cheque?.instalmentLabel)],
            instalmentDate: [p?.cheque?.instalmentDate ?? null],
            amount: [
              { value: this.roundRupee(p.amount), disabled: true },
              [Validators.required, Validators.min(1)],
            ],
            favourOf: [
              {
                value: safeStr(p?.cheque?.favourOf) || this.DEFAULT_FAVOUR_OF,
                disabled: true,
              },
              [Validators.required],
            ],
            mode: [(p?.cheque?.mode || 'PDC') as ChequeMode, [Validators.required]],
            chequeDate: [
              this.epochToISODateInput(p?.cheque?.chequeDate),
              [Validators.required],
            ],
            dueDate: [this.epochToISODateInput(p?.cheque?.dueDate)],
            chequeNo: [
              safeStr(p?.cheque?.chequeNo),
              [
                Validators.required,
                Validators.minLength(4),
                Validators.maxLength(30),
              ],
            ],
            bankName: [safeStr(p?.cheque?.bankName), [Validators.required]],
            branchName: [safeStr(p?.cheque?.branchName)],
            remarks: [safeStr(p?.remarks)],
          }),
        );
      });
    this.payForm.setControl('cheques', chqFA);
  }

  private buildEmptyNeftRow(prefillAmount = 0): UntypedFormGroup {
    return this.fb.group({
      utr: ['', [Validators.required, Validators.minLength(6)]],
      amount: [
        this.roundRupee(prefillAmount),
        [Validators.required, Validators.min(1)],
      ],
      paidOn: [null],
      bankName: [''],
      branchName: [''],
      referenceNote: [''],
      remarks: [''],
    });
  }

  addNeftRef(): void {
    this.neftRefsFA.push(this.buildEmptyNeftRow());
  }

  removeNeftRef(i: number): void {
    if (this.neftRefsFA.length <= 1) return;
    this.neftRefsFA.removeAt(i);
  }

  save(): void {
    if (this.submitting) return;

    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }
    if (!this.admissionId) {
      this.alert.error('Admission not available.');
      return;
    }

    this.payForm.markAllAsTouched();
    if (this.payForm.invalid) {
      this.alert.error('Please fill required NEFT/cheque details.');
      return;
    }

    const standardNefts = (this.neftRefsFA.getRawValue() || [])
      .map((r: any) => ({
        utr: safeStr(r.utr),
        amount: Number(r.amount || 0),
        paidOn: this.dateInputToEpoch(r.paidOn),
        bankName: safeStr(r.bankName) || null,
        branchName: safeStr(r.branchName) || null,
        referenceNote: safeStr(r.referenceNote) || null,
        remarks: safeStr(r.remarks) || null,
      }))
      .filter((x: any) => !!x.utr && x.amount > 0);

    // Rows switched to "NEFT" mode in the cheque schedule are converted into
    // NEFT refs instead of being saved as cheques.
    const finalCheques: any[] = [];
    const convertedNefts: any[] = [];
    (this.chequesFA.getRawValue() || []).forEach((r: any) => {
      const mode = String(r.mode || '').toUpperCase();
      const chequeNo = safeStr(r.chequeNo);
      const amount = Number(r.amount || 0);
      const dueDate = this.dateInputToEpoch(r.dueDate);
      const chequeDate = this.dateInputToEpoch(r.chequeDate);
      const bankName = safeStr(r.bankName) || null;
      const branchName = safeStr(r.branchName) || null;
      const remarks = safeStr(r.remarks) || null;
      if (mode === 'NEFT') {
        if (!chequeNo || amount <= 0) return;
        convertedNefts.push({
          utr: chequeNo,
          amount,
          paidOn: chequeDate,
          bankName,
          branchName,
          remarks: `${safeStr(r.description) || 'Instalment'} paid via NEFT.${remarks ? ' ' + remarks : ''}`,
        });
        return;
      }
      if (!chequeNo || !dueDate || amount <= 0) return;
      finalCheques.push({
        sno: Number(r.sno || 0) || 0,
        chequeNo,
        chequeDate,
        dueDate,
        favourOf: safeStr(this.DEFAULT_FAVOUR_OF),
        mode: ['PDC', 'CDC', 'DD', 'UPI', 'CASH'].includes(mode)
          ? mode
          : 'PDC',
        bankName,
        branchName,
        amount,
        instalmentLabel: safeStr(r.description) || null,
        instalmentDate:
          typeof r.instalmentDate === 'number' ? r.instalmentDate : null,
        remarks,
      });
    });
    const neftRefs = [...standardNefts, ...convertedNefts];
    const cheques = finalCheques;

    const entered = neftRefs.reduce((s, r) => s + r.amount, 0);
    if (entered <= 0) {
      this.alert.error('Please add at least one NEFT reference amount.');
      return;
    }
    if (entered > this.neftAmount) {
      this.alert.error(
        `NEFT total (₹${entered}) cannot exceed NEFT split (₹${this.neftAmount}).`,
      );
      return;
    }

    const totalPaid = entered + cheques.reduce((s, c) => s + c.amount, 0);
    const totalDue = this.roundRupee(this.finalFee || 0);
    if (totalDue > 0 && Math.abs(totalPaid - totalDue) > 5) {
      this.alert.error(
        `Total of NEFT and cheques (₹${totalPaid}) must match final fee (₹${totalDue}).`,
      );
      return;
    }

    this.submitting = true;
    const body: any = {
      entiId: tenantId,
      admissionId: this.admissionId,
      neftRefs,
      cheques,
    };

    this.api.fetchData(body, 'admi', 'payments/save').subscribe({
      next: (res: any) => {
        this.submitting = false;
        if (!res?.status) {
          this.alert.error(
            res?.message || res?.error || 'Failed to save payments',
          );
          return;
        }
        this.alert.success('Payment details updated.');
        this.back();
      },
      error: () => {
        this.submitting = false;
        this.alert.error('Failed to save payments');
      },
    });
  }

  back(): void {
    this.router.navigate(['app/admissions/view', this.admissionId]);
  }

  private roundRupee(v: any): number {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return 0;
    const sign = n < 0 ? -1 : 1;
    const abs = Math.abs(n);
    const base = Math.floor(abs);
    const frac = abs - base;
    const rounded = frac >= 0.5 ? base + 1 : base;
    return sign * rounded;
  }

  private epochToISODateInput(v: any): string | null {
    if (!v) return null;
    if (typeof v === 'string') {
      const s = v.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const asNum = Number(s);
      if (Number.isFinite(asNum) && asNum > 0) v = asNum;
      else return null;
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      const d = new Date(v);
      if (isNaN(d.getTime())) return null;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }

  private dateInputToEpoch(v: any): number | null {
    if (!v) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;

    const s = String(v).trim();
    if (!s) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s + 'T00:00:00');
      return isNaN(d.getTime()) ? null : d.getTime();
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.getTime();
  }
}

function safeStr(v: any): string {
  return v === null || v === undefined ? '' : String(v).trim();
}
