import {
  Component,
  OnInit,
  OnDestroy,
  DestroyRef,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { Location } from '@angular/common';

type ChequeMode = 'PDC' | 'CDC' | 'DD' | 'NEFT' | 'UPI' | 'CASH' | '' | null;
type ChequeStatus =
  | 'pending'
  | 'deposited'
  | 'cleared'
  | 'bounced'
  | 'cancelled';
type AdmissionStatus = 'draft' | 'submitted' | 'confirmed' | 'cancelled';

interface FeeBreakupRow {
  label: string;
  total: number;
  scholBenefits: number;
  fee?: number;
  stax?: number;
}

interface NefRef {
  utrNo: string;
  amount: number;
  paidOn?: number | null;
  bankName?: string | null;
  referenceNote?: string | null;
  remarks?: string | null;
}

interface ChequeRow {
  sno: number;
  chequeDate: number | null;
  dueDate: number | null;
  favourOf: string;
  amount: number;
  chequeNo: string;
  mode: ChequeMode;
  status: ChequeStatus;
  bankName?: string | null;
  instalmentLabel?: string | null;
  instalmentDate?: number | null;
  plannedDepositDate?: number | null;
  remarks?: string | null;
}

interface OtherPaymentRow {
  mode: string;
  refNo: string;
  amount: number;
  paidOn: number | null;
  bankName: string | null;
  remarks: string | null;
  status: string;
}

interface AdmissionViewModel {
  admissionId: string;
  admissionNo: string;
  status: AdmissionStatus;
  createdAt: string;
  updatedAt?: string | null;
  student: {
    name: string;
    regNo?: string | null;
    phone: string;
    parentName: string;
    parentPhone: string;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    dateOfBirth?: number | null;
    gender?: string | null;
    fatherName?: string | null;
    motherName?: string | null;
  };
  academics: {
    centreName: string;
    programName: string;
    batchName?: string | null;
    className?: string | null;
    duration?: string | number | null;
    courseStart?: string | null;
    startMonth?: string | null;
    academicYear?: string | null;
  };
  test: {
    testDate?: string | null;
    testName?: string | null;
    score?: number | null;
    percentile?: number | null;
    result?: 'pass' | 'fail' | 'pending' | null;
    remarks?: string | null;
  };
  fee: {
    feePlanCode: string;
    feePlanName: string;
    baseFee: number;
    finalFee: number;
    testScholarshipPct: number;
    scholarshipPct: number;
    additionalScholarshipPct: number;
    totalDiscountPct: number;
    breakup: FeeBreakupRow[];
  };
  payments: {
    neftSplitAmount: number;
    neftTotalEntered: number;
    neftRefs: NefRef[];
    otherPayments: OtherPaymentRow[];
    chequeSummary: {
      totalCheques: number;
      totalAmount: number;
      pendingCount: number;
      clearedCount: number;
      bouncedCount: number;
    };
    cheques: ChequeRow[];
  };
  portalStudentId: string;
  workflowStage?: string | null;
  reviewRemarks?: string | null;
  reviewedAt?: number | null;
  rejectionReason?: string | null;
  schoolMarks?: {
    overallPct?: any | null;
    coreSubjectPct?: any | null;
    remarks?: string | null;
  };
  createdByName?: string;
}

@Component({
  selector: 'app-admissionviewnew',
  standalone: false,
  templateUrl: './admissionviewnew.component.html',
  styleUrl: './admissionviewnew.component.scss',
})
export class AdmissionviewnewComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  admissionId = '';
  admissionNo = '';
  loading = true;
  admission!: AdmissionViewModel;
  rawPayments: any[] = [];
  existingPayments: any[] = [];
  rejectModalOpen = false;
  rejectReason = '';
  reviewModalOpen = false;
  reviewRemarks = '';
  actionBusy = false;
  readonly PRINT_LOGO_URL = `${window.location.origin}/assets/logo.png`;
  readonly DEFAULT_FAVOUR_OF = 'ZEDSWEVEN I PRIVATE LIMITED';
  payForm!: UntypedFormGroup;
  payFormLoading = false;
  payFormSubmitting = false;
  selectedChequeIndices: Set<number> = new Set();
  chequeAllowedByDate: Map<number, number> = new Map();
  neftSplitAmount = 0;
  readonly bankNames: string[] = [
    'STATE BANK OF INDIA',
    'HDFC BANK',
    'ICICI BANK',
    'AXIS BANK',
    'KOTAK MAHINDRA BANK',
    'PUNJAB NATIONAL BANK',
    'BANK OF BARODA',
    'CANARA BANK',
    'UNION BANK OF INDIA',
    'IDFC FIRST BANK',
    'INDUSIND BANK',
    'YES BANK',
    'FEDERAL BANK',
    'INDIAN BANK',
    'IDBI BANK',
    'UCO BANK',
    'CENTRAL BANK OF INDIA',
    'BANK OF INDIA',
    'BANK OF MAHARASHTRA',
    'PUNJAB & SIND BANK',
  ];
  splitModalOpen = false;
  splitRowIndex = -1;
  splitOriginalAmount = 0;
  splitForm!: UntypedFormGroup;
  splitOriginalIndex = -1;

  feeEditForm!: UntypedFormGroup;
  feePlanHeads: Array<{ key: string; label: string; fee: number; stax: number }> = [];
  feePlanHeadsLoading = false;
  private rawProgramId = '';
  private rawFeePlanId = '';
  private rawAdmission: any = null;

  constructor(
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private api: CommonapiService,
    private location: Location,
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Admissions' },
      { label: 'Admission View' },
    ]);
  }

  ngOnInit(): void {
    this.admissionId = String(
      this.route.snapshot.paramMap.get('id') || '',
    ).trim();
    if (!this.admissionId) {
      this.alert.error('Invalid admission id');
      this.router.navigate(['/app/admissions']);
      return;
    }
    this.buildPayForm();
    this.loadAdmission();
  }

  private buildPayForm(): void {
    this.payForm = this.fb.group({
      neftAmount: [{ value: 0, disabled: true }],
      neftRefs: this.fb.array([]),
      cheques: this.fb.array([]),
      otherPayments: this.fb.array([]),
      additionalPaymentsEnabled: [false],
    });
    this.feeEditForm = this.fb.group({
      testScholarshipPct: [{ value: 0, disabled: true }],
      scholarshipPct: [0, [Validators.min(0), Validators.max(100)]],
      additionalScholarshipPct: [0, [Validators.min(0), Validators.max(100)]],
    });
    this.splitForm = this.fb.group({
      originalAmount: [{ value: 0, disabled: true }],
      splitAmount: [null, [Validators.required, Validators.min(1)]],
      remarks: [''],
    });
  }

  get neftRefsFA(): UntypedFormArray {
    return this.payForm.get('neftRefs') as UntypedFormArray;
  }

  get chequesFA(): UntypedFormArray {
    return this.payForm.get('cheques') as UntypedFormArray;
  }

  get otherPaymentsFA(): UntypedFormArray {
    return this.payForm.get('otherPayments') as UntypedFormArray;
  }

  trackByIndex(i: number): number {
    return i;
  }

  private loadPaymentsIntoForm(): void {
    if (this.workflowStage === 'DRAFT') {
      this.loadPaymentTemplateIntoForm();
      return;
    }
    const payments = this.rawPayments || [];
    const nefts = payments.filter(
      (p) => String(p.paymentType || '').toUpperCase() === 'NEFT',
    );
    const chqs = payments.filter(
      (p) => String(p.paymentType || '').toUpperCase() === 'CHEQUE',
    );
    const others = payments.filter(
      (p) => String(p.paymentType || '').toUpperCase() === 'OTHER',
    );
    this.neftSplitAmount = this.roundRupee(
      Number(this.admission?.payments?.neftSplitAmount || 0),
    );
    this.payForm
      .get('neftAmount')
      ?.setValue(this.neftSplitAmount, { emitEvent: false });
    const neftFA = this.fb.array([]);
    if (nefts.length) {
      nefts.forEach((p) => {
        neftFA.push(
          this.fb.group({
            utr: [
              String(p?.neft?.utr || '').trim(),
              [Validators.required, Validators.minLength(6)],
            ],
            amount: [
              Number(p.amount || 0),
              [Validators.required, Validators.min(1)],
            ],
            paidOn: [this.epochToDateInput(p?.neft?.paidOn || null)],
            bankName: [String(p?.neft?.bankName || '').trim()],
            branchName: [String(p?.neft?.branchName || '').trim()],
            referenceNote: [String(p?.neft?.referenceNote || '').trim()],
            remarks: [String(p?.remarks || '').trim()],
          }),
        );
      });
    } else {
      neftFA.push(this.buildEmptyNeftRow(this.neftSplitAmount));
    }
    this.payForm.setControl('neftRefs', neftFA);
    const chqFA = this.fb.array([]);
    chqs
      .sort((a, b) => Number(a?.cheque?.sno || 0) - Number(b?.cheque?.sno || 0))
      .forEach((p) => {
        chqFA.push(
          this.createChequeFormGroup({
            sno: p?.cheque?.sno ?? null,
            description: p?.cheque?.instalmentLabel || '',
            instalmentDate: p?.cheque?.instalmentDate ?? null,
            amount: Number(p.amount || 0),
            favourOf: p?.cheque?.favourOf || this.DEFAULT_FAVOUR_OF,
            mode: p?.cheque?.mode || 'PDC',
            chequeDate: this.epochToDateInput(p?.cheque?.chequeDate),
            dueDate: this.epochToDateInput(p?.cheque?.dueDate),
            chequeNo: p?.cheque?.chequeNo || '',
            bankName: p?.cheque?.bankName || '',
            branchName: p?.cheque?.branchName || '',
            remarks: p?.remarks || '',
          }),
        );
      });
    this.payForm.setControl('cheques', chqFA);
    const otherFA = this.fb.array([]);
    others.forEach((p) => {
      otherFA.push(
        this.fb.group({
          mode: [p?.other?.mode || 'UPI', Validators.required],
          amount: [
            Number(p.amount || 0),
            [Validators.required, Validators.min(1)],
          ],
          paidOn: [this.epochToDateInput(p?.other?.paidOn || null)],
          refNo: [p?.other?.refNo || ''],
          bankName: [p?.other?.bankName || ''],
          branchName: [p?.other?.branchName || ''],
          referenceNote: [p?.other?.referenceNote || ''],
          remarks: [p?.remarks || ''],
        }),
      );
    });
    this.payForm.setControl('otherPayments', otherFA);
    if (others.length) {
      this.payForm
        .get('additionalPaymentsEnabled')
        ?.setValue(true, { emitEvent: false });
    }
    this.selectedChequeIndices.clear();
    this.rebuildAllowedMap();
  }

  private loadPaymentTemplateIntoForm(): void {
    const tenantId = this.pickTenantId();
    this.payFormLoading = true;
    const body = { entiId: tenantId, admissionId: this.admissionId };
    this.api.fetchData(body, 'admi', 'paymenttemplate').subscribe({
      next: (resp: any) => {
        this.payFormLoading = false;
        if (!resp?.status || !resp?.data) {
          this.alert.error('Failed to load payment template');
          return;
        }
        const data = resp.data;
        this.neftSplitAmount = this.roundRupee(
          Number(data.neftSplitAmount || 0),
        );
        this.payForm
          .get('neftAmount')
          ?.setValue(this.neftSplitAmount, { emitEvent: false });
        const neftFA = this.fb.array([]);
        neftFA.push(this.buildEmptyNeftRow(this.neftSplitAmount));
        this.payForm.setControl('neftRefs', neftFA);
        const instalments: any[] = Array.isArray(data.instalments)
          ? data.instalments
          : [];
        // const chqFA = this.fb.array([]);
        // instalments
        //   .filter((i) => Number(i.instalmentDate) > 0)
        //   .forEach((i, idx) => {
        //     chqFA.push(
        //       this.createChequeFormGroup({
        //         sno: i.seq ?? idx + 1,
        //         description: i.label || i.feeHead || '',
        //         instalmentDate: i.instalmentDate,
        //         amount: Number(i.amount || 0),
        //         favourOf: i.chequeFavour || this.DEFAULT_FAVOUR_OF,
        //         mode: i.mode || 'PDC',
        //         chequeDate: null,
        //         dueDate: this.epochToDateInput(i.instalmentDate),
        //         chequeNo: '',
        //         bankName: '',
        //         branchName: '',
        //         remarks: '',
        //       }),
        //     );
        //   });
        // this.payForm.setControl('cheques', chqFA);
        // Group instalments by date — same as admissionbug
        const chequeInsts = instalments.filter(
          (i) => Number(i.instalmentDate) > 0,
        );
        const groupMap = new Map<
          number,
          {
            amount: number;
            labels: string[];
            mode: string;
            favour: string;
            date: number;
          }
        >();
        chequeInsts.forEach((i) => {
          const dt = Number(i.instalmentDate);
          const existing = groupMap.get(dt);
          if (!existing) {
            groupMap.set(dt, {
              amount: Number(i.amount || 0),
              labels: [String(i.label || i.feeHead || '').trim()].filter(
                Boolean,
              ),
              mode: String(i.mode || 'PDC').trim(),
              favour: String(i.chequeFavour || this.DEFAULT_FAVOUR_OF).trim(),
              date: dt,
            });
          } else {
            existing.amount += Number(i.amount || 0);
            const lbl = String(i.label || i.feeHead || '').trim();
            if (lbl) existing.labels.push(lbl);
          }
        });
        const grouped = Array.from(groupMap.values()).sort(
          (a, b) => a.date - b.date,
        );
        const chqFA = this.fb.array([]);
        grouped.forEach((g, idx) => {
          chqFA.push(
            this.createChequeFormGroup({
              sno: idx + 1,
              description: Array.from(new Set(g.labels)).join(', '),
              instalmentDate: g.date,
              amount: this.roundRupee(g.amount),
              favourOf: g.favour,
              mode: String(g.mode).toUpperCase() === 'CDC' ? 'CDC' : 'PDC',
              chequeDate: null,
              dueDate: this.epochToDateInput(g.date),
              chequeNo: '',
              bankName: '',
              branchName: '',
              remarks: '',
            }),
          );
        });
        this.payForm.setControl('cheques', chqFA);
        this.selectedChequeIndices.clear();
        this.rebuildAllowedMap();
      },
      error: () => {
        this.payFormLoading = false;
        this.alert.error('Failed to load payment template');
      },
    });
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

  get neftTotalEntered(): number {
    return this.roundRupee(
      (this.neftRefsFA.getRawValue() || []).reduce(
        (s: number, r: any) => s + (Number(r.amount) || 0),
        0,
      ),
    );
  }

  get neftError(): string | null {
    const required = this.neftSplitAmount;
    if (required === 0) return null;
    const entered = this.neftTotalEntered;
    if (entered === 0) return null;
    if (entered < required)
      return `Short by ₹${this.roundRupee(required - entered)}`;
    if (entered > required)
      return `Exceeds by ₹${this.roundRupee(entered - required)}`;
    return null;
  }

  get chequeTotal(): number {
    return this.roundRupee(
      (this.chequesFA.getRawValue() || []).reduce(
        (s: number, r: any) => s + (Number(r.amount) || 0),
        0,
      ),
    );
  }

  get otherPaymentsTotal(): number {
    return this.roundRupee(
      (this.otherPaymentsFA.getRawValue() || []).reduce(
        (s: number, r: any) => s + (Number(r.amount) || 0),
        0,
      ),
    );
  }

  get grandTotal(): number {
    return this.roundRupee(
      this.neftTotalEntered + this.chequeTotal + this.otherPaymentsTotal,
    );
  }

  get balanceAmount(): number {
    return this.roundRupee(
      (this.admission?.fee?.finalFee || 0) -
        this.neftTotalEntered -
        this.chequeTotal,
    );
  }

  toggleAdditionalPayments(event: any): void {
    this.payForm
      .get('additionalPaymentsEnabled')
      ?.setValue(event.target.checked);
  }

  addOtherPaymentRow(): void {
    this.otherPaymentsFA.push(
      this.fb.group({
        mode: ['UPI', Validators.required],
        amount: [0, [Validators.required, Validators.min(1)]],
        paidOn: [null],
        refNo: [''],
        bankName: [''],
        branchName: [''],
        referenceNote: [''],
        remarks: [''],
      }),
    );
  }

  removeOtherPaymentRow(i: number): void {
    this.otherPaymentsFA.removeAt(i);
  }

  private createChequeFormGroup(data: any): UntypedFormGroup {
    const grp = this.fb.group({
      sno: [data.sno],
      description: [data.description],
      instalmentDate: [data.instalmentDate],
      amount: [
        { value: this.roundRupee(data.amount), disabled: true },
        [Validators.required, Validators.min(1)],
      ],
      favourOf: [
        { value: data.favourOf || this.DEFAULT_FAVOUR_OF, disabled: true },
        [Validators.required],
      ],
      mode: [data.mode || 'PDC', [Validators.required]],
      chequeDate: [data.chequeDate, [Validators.required]],
      dueDate: [data.dueDate],
      chequeNo: [
        data.chequeNo,
        [
          Validators.required,
          Validators.minLength(6),
          Validators.maxLength(20),
        ],
      ],
      bankName: [data.bankName, [Validators.required]],
      branchName: [data.branchName || ''],
      remarks: [data.remarks || ''],
    });
    return grp;
  }

  private reindexCheques(): void {
    const snos = this.chequesFA.controls
      .map((c) => Number((c as UntypedFormGroup).getRawValue()?.sno || 1))
      .filter((n) => n > 0);
    const base = snos.length ? Math.min(...snos) : 1;
    this.chequesFA.controls.forEach((ctrl, i) => {
      ctrl.patchValue({ sno: base + i }, { emitEvent: false });
    });
  }

  private rebuildAllowedMap(): void {
    this.chequeAllowedByDate.clear();
    (this.chequesFA.getRawValue() || []).forEach((r: any) => {
      const dt = Number(r.instalmentDate || 0);
      const amt = Number(r.amount || 0);
      if (dt > 0 && amt > 0) {
        this.chequeAllowedByDate.set(
          dt,
          (this.chequeAllowedByDate.get(dt) || 0) + amt,
        );
      }
    });
    this.chequesFA.updateValueAndValidity({ emitEvent: false });
  }

  private loadFeePlanHeadsForRecalc(): void {
    if (!this.rawProgramId || !this.rawFeePlanId) return;
    const tenantId = this.pickTenantId();
    if (!tenantId) return;
    this.feePlanHeadsLoading = true;
    const route = `list?list=full&programId=${encodeURIComponent(this.rawProgramId)}`;
    this.api.fetchData({ entiId: tenantId }, 'ims/feeplan', route).subscribe({
      next: (res: any) => {
        this.feePlanHeadsLoading = false;
        if (!res?.status) {
          this.feePlanHeads = [];
          return;
        }
        const arr = Array.isArray(res?.data) ? res.data : [];
        const plan = arr.find(
          (x: any) =>
            String(x.feePlanId || x.id || x._id || '').trim() ===
            this.rawFeePlanId,
        );
        this.feePlanHeads = Array.isArray(plan?.feeHeads)
          ? plan.feeHeads.map((h: any) => ({
              key: String(h.key || h.feeHeadKey || '').trim(),
              label: String(h.label || h.feeHeadName || '').trim(),
              fee: Number(h.amount || 0),
              stax: Number(h.gstAmount || 0),
            }))
          : [];
      },
      error: () => {
        this.feePlanHeadsLoading = false;
        this.feePlanHeads = [];
      },
    });
  }

  get liveFeeHeadPreview(): Array<{
    label: string;
    total: number;
    scholBenefits: number;
  }> {
    const heads = this.feePlanHeads;
    if (!heads.length) return [];
    const clamp = (v: number) => Math.max(0, Math.min(100, Number(v || 0)));
    const raw = this.feeEditForm.getRawValue();
    const p1 = clamp(raw.testScholarshipPct);
    const p2 = clamp(raw.scholarshipPct);
    const p3 = clamp(raw.additionalScholarshipPct);
    const applyPct = (amount: number, pct: number) => {
      const out = Math.round(amount * (1 - pct / 100));
      return out < 0 ? 0 : out;
    };
    return heads.map((h) => {
      const fee0 = Number(h.fee || 0);
      const tax0 = Number(h.stax || 0);
      const rate = fee0 > 0 ? tax0 / fee0 : 0;
      let outFee = fee0;
      let outTax = tax0;
      let scholBenefits = 0;
      const key = h.key.toLowerCase();
      const isTuition =
        key === 'tuition' ||
        key === 'tuitionfee' ||
        key === 'tuition_fee' ||
        h.label.toLowerCase().includes('tuition');
      if (isTuition) {
        const fee1 = applyPct(outFee, p1);
        const fee2 = applyPct(fee1, p2);
        const fee3 = applyPct(fee2, p3);
        outFee = fee3;
        outTax = this.roundRupee(outFee * rate);
        scholBenefits = this.roundRupee(
          Math.max(0, fee0 + tax0 - (outFee + outTax)),
        );
      }
      return {
        label: h.label,
        total: this.roundRupee(outFee + outTax),
        scholBenefits,
      };
    });
  }

  get liveFinalFee(): number {
    if (!this.feePlanHeads.length) return this.finalFee;
    return this.liveFeeHeadPreview.reduce(
      (s, r) => s + (Number(r.total) || 0),
      0,
    );
  }

  get liveTotalDiscountPct(): number {
    const clamp = (v: number) => Math.max(0, Math.min(100, Number(v || 0)));
    const raw = this.feeEditForm.getRawValue();
    const a = clamp(raw.testScholarshipPct) / 100;
    const b = clamp(raw.scholarshipPct) / 100;
    const c = clamp(raw.additionalScholarshipPct) / 100;
    const eff = 1 - (1 - a) * (1 - b) * (1 - c);
    return Math.round(eff * 10000) / 100;
  }

  recalculateInstallments(): void {
    if (!this.feePlanHeads.length) {
      this.alert.error(
        'Fee plan details are still loading. Please try again shortly.',
      );
      return;
    }
    const newTotal = this.roundRupee(this.liveFinalFee);
    const currentNeftAmt = Number(this.payForm.getRawValue().neftAmount || 0);
    const chequeRows = this.chequesFA.getRawValue() || [];
    const currentChequeAmts = chequeRows.map(
      (r: any) => Number(r.amount || 0) || 0,
    );
    const baseAmounts = [currentNeftAmt, ...currentChequeAmts];
    const baseTotal = baseAmounts.reduce((s, x) => s + x, 0);
    if (!baseTotal || newTotal <= 0) {
      this.alert.error('No existing payment schedule to rescale.');
      return;
    }
    const scaled = this.scalePlan(baseAmounts, newTotal, baseTotal);
    const newNeftAmt = scaled[0] || 0;
    const newChequeAmts = scaled.slice(1);

    this.neftSplitAmount = newNeftAmt;
    this.payForm
      .get('neftAmount')
      ?.setValue(newNeftAmt, { emitEvent: false });

    const neftRows = this.neftRefsFA.getRawValue() || [];
    const neftBaseAmts = neftRows.map((r: any) => Number(r.amount || 0) || 0);
    const neftBaseTotal = neftBaseAmts.reduce((s, x) => s + x, 0);
    const scaledNeftRows = neftBaseTotal
      ? this.scalePlan(neftBaseAmts, newNeftAmt, neftBaseTotal)
      : neftRows.length
        ? [newNeftAmt, ...neftRows.slice(1).map(() => 0)]
        : [];
    this.neftRefsFA.controls.forEach((ctrl, i) => {
      ctrl
        .get('amount')
        ?.setValue(scaledNeftRows[i] ?? 0, { emitEvent: false });
    });

    this.chequesFA.controls.forEach((ctrl, i) => {
      ctrl
        .get('amount')
        ?.setValue(newChequeAmts[i] ?? 0, { emitEvent: false });
    });

    this.rebuildAllowedMap();
    this.alert.success(
      'Installments recalculated based on the updated scholarship. Review and Save Payments to persist.',
    );
  }

  toggleChequeSelection(idx: number, event: any): void {
    if (event.target.checked) {
      this.selectedChequeIndices.add(idx);
    } else {
      this.selectedChequeIndices.delete(idx);
    }
  }

  initiateSplit(): void {
    if (this.selectedChequeIndices.size !== 1) return;
    const idx = this.selectedChequeIndices.values().next().value;
    if (idx !== undefined) this.openSplitModal(idx);
  }

  openSplitModal(idx: number): void {
    const row = this.chequesFA.at(idx).getRawValue();
    this.splitRowIndex = idx;
    this.splitOriginalAmount = Number(row.amount || 0);
    this.splitForm.patchValue({
      originalAmount: this.splitOriginalAmount,
      splitAmount: null,
      remarks: `Split from ${row.description || 'instalment'}`,
    });
    this.splitModalOpen = true;
  }

  closeSplitModal(): void {
    this.splitModalOpen = false;
    this.splitRowIndex = -1;
  }

  saveSplit(): void {
    if (this.splitForm.invalid) return;
    const { splitAmount, remarks } = this.splitForm.value;
    const originalIndex = this.splitRowIndex;
    const originalRow = this.chequesFA.at(originalIndex).getRawValue();
    const originalTotal = this.splitOriginalAmount;
    const remaining = originalTotal - Number(splitAmount);
    if (remaining < 0) {
      this.alert.error('Split amount cannot exceed original amount');
      return;
    }
    const instDate = originalRow.instalmentDate;
    const uiDate = originalRow.dueDate;
    const row1 = this.createChequeFormGroup({
      ...originalRow,
      amount: Number(splitAmount),
      description: `${originalRow.description || 'Instalment'} (Part 1/2)`,
      dueDate: uiDate,
      instalmentDate: instDate,
      remarks: remarks || 'Split Part 1',
    });
    const row2 = this.createChequeFormGroup({
      ...originalRow,
      amount: remaining,
      description: `${originalRow.description || 'Instalment'} (Part 2/2)`,
      dueDate: uiDate,
      instalmentDate: instDate,
      chequeNo: '',
      bankName: '',
      remarks: 'Split Part 2',
    });
    this.chequesFA.removeAt(originalIndex);
    this.chequesFA.insert(originalIndex, row1);
    this.chequesFA.insert(originalIndex + 1, row2);
    this.closeSplitModal();
    this.reindexCheques();
    this.rebuildAllowedMap();
  }

  mergeSelectedCheques(): void {
    const indices = Array.from(this.selectedChequeIndices)
      .map((i) => Number(i))
      .filter((i) => i >= 0 && i < this.chequesFA.length)
      .sort((a, b) => a - b);
    if (indices.length < 2) {
      this.alert.error('Select at least 2 rows to merge.');
      return;
    }
    // const selectedRowsData = indices.map((i) =>
    //   this.chequesFA.at(i).getRawValue(),
    // );
    // const totalAmount = selectedRowsData.reduce(
    //   (sum, curr) => sum + (Number(curr.amount) || 0),
    //   0,
    // );
    const selectedRowsData = indices.map((i) => {
      const ctrl = this.chequesFA.at(i) as UntypedFormGroup;
      const raw = ctrl.getRawValue();
      const amtCtrl = ctrl.get('amount');
      amtCtrl?.enable({ emitEvent: false });
      const amount = Number(amtCtrl?.value ?? 0);
      amtCtrl?.disable({ emitEvent: false });
      return { ...raw, amount };
    });
    const totalAmount = selectedRowsData.reduce(
      (sum, curr) => sum + (Number(curr.amount) || 0),
      0,
    );
    const validDates = selectedRowsData
      .map((r) => Number(r.instalmentDate || 0))
      .filter((d) => d > 0);
    const minDate = validDates.length > 0 ? Math.min(...validDates) : 0;
    const combinedLabels = selectedRowsData
      .map((r) => r.description || r.remarks)
      .filter(Boolean)
      .join(' + ');
    for (let i = indices.length - 1; i >= 0; i--) {
      this.chequesFA.removeAt(indices[i]);
    }
    const insertIndex = indices[0];
    const mergedData = {
      sno: 0,
      description: combinedLabels,
      instalmentDate: minDate,
      dueDate: this.epochToDateInput(minDate),
      amount: totalAmount,
      favourOf: this.DEFAULT_FAVOUR_OF,
      mode: 'PDC',
      chequeNo: '',
      bankName: '',
      chequeDate: null,
      remarks: `Merged ${selectedRowsData.length} items`,
    };
    this.chequesFA.insert(insertIndex, this.createChequeFormGroup(mergedData));
    this.selectedChequeIndices.clear();
    this.reindexCheques();
    this.rebuildAllowedMap();
    this.payForm.updateValueAndValidity();
    this.alert.success(
      `Successfully merged ${selectedRowsData.length} instalments.`,
    );
  }

  resetCheques(): void {
    const chqs = (this.rawPayments || []).filter(
      (p) => String(p.paymentType || '').toUpperCase() === 'CHEQUE',
    );
    const chqFA = this.fb.array([]);
    chqs
      .sort((a, b) => Number(a?.cheque?.sno || 0) - Number(b?.cheque?.sno || 0))
      .forEach((p) => {
        chqFA.push(
          this.createChequeFormGroup({
            sno: p?.cheque?.sno ?? null,
            description: p?.cheque?.instalmentLabel || '',
            instalmentDate: p?.cheque?.instalmentDate ?? null,
            amount: Number(p.amount || 0),
            favourOf: p?.cheque?.favourOf || this.DEFAULT_FAVOUR_OF,
            mode: p?.cheque?.mode || 'PDC',
            chequeDate: this.epochToDateInput(p?.cheque?.chequeDate),
            dueDate: this.epochToDateInput(p?.cheque?.dueDate),
            chequeNo: p?.cheque?.chequeNo || '',
            bankName: p?.cheque?.bankName || '',
            branchName: '',
            remarks: p?.remarks || '',
          }),
        );
      });
    this.payForm.setControl('cheques', chqFA);
    this.selectedChequeIndices.clear();
    this.rebuildAllowedMap();
    this.alert.success('Cheques reset to original.');
  }

  resetPayments(): void {
    if (!confirm('Revert all payments to the default Fee Plan?')) return;

    this.loading = true;
    this.api
      .fetchData(
        {
          admissionId: this.admissionId,
          entiId: this.pickTenantId(),
        },
        'admi',
        'payments/template',
      )
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res.status && res.data?.instalments) {
            this.chequesFA.clear();
            res.data.instalments.forEach((inst: any, idx: number) => {
              if (Number(inst.instalmentDate) > 0) {
                this.chequesFA.push(
                  this.createChequeFormGroup({
                    sno: inst.seq || idx + 1,
                    description: inst.label || inst.feeHead || '',
                    instalmentDate: inst.instalmentDate,
                    dueDate: this.epochToDateInput(inst.instalmentDate),
                    amount: inst.amount,
                    favourOf: inst.chequeFavour || this.DEFAULT_FAVOUR_OF,
                    mode: inst.mode || 'PDC',
                    remarks: '',
                  }),
                );
              }
            });
            this.rebuildAllowedMap();
            this.alert.success('Payments reset to default.');
          }
        },
        error: () => {
          this.loading = false;
          this.alert.error('Failed to reset template.');
        },
      });
  }

  savePayments(): void {
    if (this.payFormSubmitting) return;
    this.payForm.markAllAsTouched();
    const neftRequired = this.roundRupee(this.neftSplitAmount);
    const neftEntered = this.neftTotalEntered;
    if (neftRequired > 0 && neftEntered > 0 && neftEntered !== neftRequired) {
      this.alert.error(
        `NEFT amount mismatch — required ₹${neftRequired}, entered ₹${neftEntered}`,
      );
      return;
    }
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId missing');
      return;
    }
    const standardNefts = (this.neftRefsFA.getRawValue() || [])
      .map((r: any) => ({
        utr: String(r.utr || '').trim(),
        amount: Number(r.amount || 0),
        paidOn: this.dateInputToEpoch(r.paidOn),
        bankName: String(r.bankName || '').trim() || null,
        branchName: String(r.branchName || '').trim() || null,
        referenceNote: String(r.referenceNote || '').trim() || null,
        remarks: String(r.remarks || '').trim() || null,
      }))
      .filter((x: any) => !!x.utr && x.amount > 0);
    // Rows switched to "NEFT" mode in the cheque/instalment schedule are
    // converted into NEFT refs instead of being saved as cheques, matching
    // the New Admission wizard's behavior.
    const finalCheques: any[] = [];
    const convertedNefts: any[] = [];
    (this.chequesFA.getRawValue() || []).forEach((r: any) => {
      const mode = String(r.mode || '').toUpperCase();
      const chequeNo = String(r.chequeNo || '').trim();
      const amount = Number(r.amount || 0);
      const dueDate = this.dateInputToEpoch(r.dueDate);
      const chequeDate = this.dateInputToEpoch(r.chequeDate);
      const bankName = String(r.bankName || '').trim() || null;
      const branchName = String(r.branchName || '').trim() || null;
      const remarks = String(r.remarks || '').trim() || null;
      if (mode === 'NEFT') {
        if (!chequeNo || amount <= 0) return;
        convertedNefts.push({
          utr: chequeNo,
          amount,
          paidOn: chequeDate,
          bankName,
          branchName,
          remarks: `${String(r.description || 'Instalment').trim()} paid via NEFT.${remarks ? ' ' + remarks : ''}`,
        });
        return;
      }
      if (!chequeNo || !dueDate || amount <= 0) return;
      finalCheques.push({
        sno: Number(r.sno || 0),
        chequeNo,
        chequeDate,
        dueDate,
        favourOf: String(r.favourOf || this.DEFAULT_FAVOUR_OF).trim(),
        mode: ['PDC', 'CDC', 'DD', 'UPI', 'CASH'].includes(mode)
          ? mode
          : 'PDC',
        bankName,
        branchName,
        amount,
        description: String(r.description || '').trim() || null,
        instalmentDate:
          typeof r.instalmentDate === 'number' ? r.instalmentDate : null,
        remarks,
      });
    });
    const neftRefs = [...standardNefts, ...convertedNefts];
    const cheques = finalCheques;
    const otherPayments = this.payForm.getRawValue().additionalPaymentsEnabled
      ? (this.otherPaymentsFA.getRawValue() || [])
          .map((o: any) => ({
            mode: String(o.mode || '').trim(),
            amount: Number(o.amount || 0),
            paidOn: this.dateInputToEpoch(o.paidOn),
            refNo: String(o.refNo || '').trim() || null,
            bankName: String(o.bankName || '').trim() || null,
            branchName: String(o.branchName || '').trim() || null,
            referenceNote: String(o.referenceNote || '').trim() || null,
            remarks: String(o.remarks || '').trim() || null,
          }))
          .filter((x: any) => !!x.mode && x.amount > 0)
      : [];

    this.payFormSubmitting = true;
    const paymentsBody = {
      entiId: tenantId,
      admissionId: this.admissionId,
      neftRefs,
      cheques,
      otherPayments,
    };
    const persistPayments = () => {
      this.api.fetchData(paymentsBody, 'admi', 'payments/save').subscribe({
        next: (resp: any) => {
          this.payFormSubmitting = false;
          if (!resp?.status) {
            this.alert.error(resp?.message || 'Failed to save payments');
            return;
          }
          this.alert.success('Payments saved successfully');
          this.loadAdmission();
        },
        error: () => {
          this.payFormSubmitting = false;
          this.alert.error('Failed to save payments');
        },
      });
    };

    if (this.isDraft && this.feePlanHeads.length && this.rawAdmission) {
      const feeUpdateBody = this.buildFeeUpdateBody(tenantId);
      this.api.fetchData(feeUpdateBody, 'admi', 'update').subscribe({
        next: (resp: any) => {
          if (!resp?.status) {
            this.payFormSubmitting = false;
            this.alert.error(
              resp?.message || 'Failed to update scholarship details',
            );
            return;
          }
          persistPayments();
        },
        error: () => {
          this.payFormSubmitting = false;
          this.alert.error('Failed to update scholarship details');
        },
      });
    } else {
      persistPayments();
    }
  }

  private buildFeeUpdateBody(tenantId: string): any {
    const adm = this.rawAdmission || {};
    const raw = this.feeEditForm.getRawValue();
    return {
      entiId: tenantId,
      admissionId: this.admissionId,
      academicYear: adm.academicYear || null,
      sourceType: adm.sourceType || null,
      registrationNumber: adm.registrationNumber || null,
      portalStudentId: adm.portalStudentId || null,
      scholarshipTestId: adm.scholarshipTestId || null,
      centerId: adm.centerId || null,
      centerName: adm.centerName || null,
      programId: this.rawProgramId,
      programName: adm.programName || null,
      programCode: adm.programCode || null,
      feePlanId: this.rawFeePlanId,
      feePlanCode: adm.feePlanCode || null,
      student: {
        name: adm.student?.name || '',
        phone: adm.student?.phone || '',
        parentName: adm.student?.parentName || adm.student?.fatherName || '',
        parentPhone: adm.student?.parentPhone || '',
        email: adm.student?.email || null,
      },
      fee: {
        baseFee: Number(adm.fee?.baseFee || 0),
        finalFee: this.roundRupee(this.liveFinalFee),
        testScholarshipPct: Number(raw.testScholarshipPct || 0),
        scholarshipPct: Number(raw.scholarshipPct || 0),
        additionalScholarshipPct: Number(raw.additionalScholarshipPct || 0),
        totalDiscountPct: this.liveTotalDiscountPct,
        breakup: this.liveFeeHeadPreview.map((x) => ({
          label: x.label,
          total: x.total,
          scholBenefits: x.scholBenefits,
        })),
      },
      schoolMarks: {
        overallPct: adm.schoolMarks?.overallPct ?? null,
        coreSubjectPct: adm.schoolMarks?.coreSubjectPct ?? null,
        remarks: adm.schoolMarks?.remarks || null,
      },
    };
  }

  openReviewModal(): void {
    if (!this.canApproveReject) {
      this.alert.error(
        'You are not authorized to put this admission under review.',
      );
      return;
    }
    this.reviewRemarks = '';
    this.reviewModalOpen = true;
  }

  closeReviewModal(): void {
    this.reviewModalOpen = false;
    this.reviewRemarks = '';
  }

  putUnderReview(): void {
    const remarks = (this.reviewRemarks || '').trim();
    if (!remarks) {
      this.alert.warning('Please enter review remarks before proceeding.');
      return;
    }
    if (this.actionBusy) return;
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId missing.');
      return;
    }

    this.actionBusy = true;
    const body = {
      entiId: tenantId,
      admissionId: this.admissionId,
      reviewRemarks: remarks,
    };
    this.api.fetchData(body, 'admi', 'review').subscribe({
      next: (resp: any) => {
        this.actionBusy = false;
        if (!resp?.status)
          return this.alert.error(
            resp?.message || 'Failed to put under review',
          );
        this.alert.success('Admission put under review');
        this.closeReviewModal();
        this.loadAdmission();
      },
      error: () => {
        this.actionBusy = false;
        this.alert.error('Failed to put under review');
      },
    });
  }

  get isUnderReview(): boolean {
    return this.workflowStage === 'UNDER_REVIEW';
  }

  get canSendForApproval(): boolean {
    return (
      this.workflowStage === 'PAYMENTS_SUBMITTED' ||
      this.workflowStage === 'UNDER_REVIEW'
    );
  }

  goToAdmissionEdit(): void {
    if (!this.admissionId) return;
    this.router.navigate(['app/admissions/edit', this.admissionId]);
  }

  goToPaymentsEdit(): void {
    if (!this.admissionId) return;
    this.router.navigate(['app/admissions/payments/edit', this.admissionId]);
  }

  get feeHeadPreview(): FeeBreakupRow[] {
    return this.admission?.fee?.breakup || [];
  }
  get finalFee(): number {
    return this.admission?.fee?.finalFee || 0;
  }
  get chequeCount(): number {
    const sc = this.admission?.payments?.chequeSummary?.totalCheques;
    if (typeof sc === 'number' && !isNaN(sc)) return sc;
    return (this.admission?.payments?.cheques || []).length;
  }
  get chequeTotalView(): number {
    const st = this.admission?.payments?.chequeSummary?.totalAmount;
    if (typeof st === 'number' && !isNaN(st)) return st;
    return (this.admission?.payments?.cheques || []).reduce(
      (s, c) => s + Number(c.amount || 0),
      0,
    );
  }
  get otherTotal(): number {
    return (this.admission?.payments?.otherPayments || []).reduce(
      (s, n) => s + Number(n.amount || 0),
      0,
    );
  }
  get neftTotal(): number {
    return (this.admission?.payments?.neftRefs || []).reduce(
      (s, n) => s + Number(n.amount || 0),
      0,
    );
  }

  get workflowStage(): string {
    return String(this.admission?.workflowStage || '').toUpperCase();
  }

  get isDraftOrRejected(): boolean {
    return ['DRAFT', 'REJECTED', 'UNDER_REVIEW'].includes(this.workflowStage);
  }
  get isRejected(): boolean {
    return this.workflowStage === 'REJECTED';
  }
  get isApprovalSent(): boolean {
    return this.workflowStage === 'APPROVAL_SENT';
  }
  get isPaymentsSubmitted(): boolean {
    return this.workflowStage === 'PAYMENTS_SUBMITTED';
  }
  get isSubmittedOrApproved(): boolean {
    return [
      'PAYMENTS_SUBMITTED',
      'FEE_CALC_GENERATED',
      'APPROVAL_SENT',
      'UNDER_REVIEW',
      'CONFIRMED',
    ].includes(this.workflowStage);
  }
  get isApproved(): boolean {
    return (
      this.workflowStage === 'APPROVED' || this.workflowStage === 'CONFIRMED'
    );
  }
  get isDraft(): boolean {
    return this.workflowStage === 'DRAFT';
  }

  get userRole(): string {
    return (localStorage.getItem('userRole') || '').trim().toUpperCase();
  }
  get canApproveReject(): boolean {
    return this.userRole === 'L1';
  }

  private pickTenantId(): string {
    return (localStorage.getItem('tenantId') || '').trim();
  }

  private loadAdmission(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId missing. Please login again.');
      this.router.navigate(['/auth/login']);
      return;
    }
    this.loading = true;
    const body: any = { admissionId: this.admissionId, entiId: tenantId };
    this.api.fetchData(body, 'admi', 'view').subscribe({
      next: (resp: any) => {
        this.loading = false;
        if (!resp?.status || !resp?.data?.admission) {
          this.alert.error(
            resp?.message || resp?.error || 'Admission not found',
          );
          this.router.navigate(['/app/admissions']);
          return;
        }
        this.rawPayments = Array.isArray(resp.data.payments)
          ? resp.data.payments
          : [];
        this.rawAdmission = resp.data.admission;
        this.admission = this.mapApiToView(
          resp.data.admission,
          this.rawPayments,
        );
        // CHANGE 1: populate the inline payment form after load
        this.loadPaymentsIntoForm();

        if (this.isDraft) {
          const adm = resp.data.admission;
          this.rawProgramId = String(
            (adm?.programId && typeof adm.programId === 'object'
              ? adm.programId.programId || adm.programId._id
              : adm.programId) || '',
          ).trim();
          this.rawFeePlanId = String(adm?.feePlanId || '').trim();
          this.feeEditForm.patchValue(
            {
              testScholarshipPct: this.admission.fee.testScholarshipPct,
              scholarshipPct: this.admission.fee.scholarshipPct,
              additionalScholarshipPct:
                this.admission.fee.additionalScholarshipPct,
            },
            { emitEvent: false },
          );
          this.loadFeePlanHeadsForRecalc();
        }
      },
      error: () => {
        this.loading = false;
        this.alert.error('Failed to load admission details');
        this.router.navigate(['/app/admissions']);
      },
    });
  }

  private mapApiToView(adm: any, payments: any[]): AdmissionViewModel {
    this.admissionNo = adm.admissionNo;
    const feeBreakupRaw = Array.isArray(adm?.fee?.breakup)
      ? adm.fee.breakup
      : [];
    const breakup: FeeBreakupRow[] = feeBreakupRaw.map((h: any) => ({
      label: String(h.label || '').trim(),
      total: Number(h.total ?? 0),
      scholBenefits: Number(h.scholBenefits ?? 0),
    }));
    const neftSplitAmount = Number(adm?.payments?.neft?.splitAmount || 0);
    const neftTotalEntered = Number(adm?.payments?.neft?.totalEntered || 0);
    const chequeSummaryRaw = adm?.payments?.chequeSummary || {};
    const chequeSummary = {
      totalCheques: Number(chequeSummaryRaw.totalCheques || 0),
      totalAmount: Number(chequeSummaryRaw.totalAmount || 0),
      pendingCount: Number(chequeSummaryRaw.pendingCount || 0),
      clearedCount: Number(chequeSummaryRaw.clearedCount || 0),
      bouncedCount: Number(chequeSummaryRaw.bouncedCount || 0),
    };
    const neftRefs: NefRef[] = (payments || [])
      .filter((p: any) => String(p.paymentType || '').toUpperCase() === 'NEFT')
      .map((p: any) => ({
        utrNo: String(p.neft?.utr || '').trim(),
        amount: Number(p.amount || 0),
        paidOn: typeof p.neft?.paidOn === 'number' ? p.neft.paidOn : null,
        bankName: p.neft?.bankName ? String(p.neft.bankName).trim() : null,
        referenceNote: p.neft?.referenceNote
          ? String(p.neft.referenceNote).trim()
          : null,
        remarks: p.remarks || null,
      }))
      .filter((x: any) => !!x.utrNo && x.amount > 0);
    const chequeRows: ChequeRow[] = (payments || [])
      .filter(
        (p: any) => String(p.paymentType || '').toUpperCase() === 'CHEQUE',
      )
      .map((p: any, idx: number) => ({
        sno: typeof p.cheque?.sno === 'number' ? p.cheque.sno : idx + 1,
        chequeDate:
          typeof p.cheque?.chequeDate === 'number' ? p.cheque.chequeDate : null,
        dueDate:
          typeof p.cheque?.dueDate === 'number' ? p.cheque.dueDate : null,
        favourOf: String(p.cheque?.favourOf || '').trim(),
        amount: Number(p.amount || 0),
        chequeNo: String(p.cheque?.chequeNo || '').trim(),
        mode: (p.cheque?.mode || '') as ChequeMode,
        status: this.mapPaymentStatus(p.status),
        bankName: p.cheque?.bankName ? String(p.cheque.bankName).trim() : null,
        plannedDepositDate:
          typeof p.cheque?.plannedDepositDate === 'number'
            ? p.cheque.plannedDepositDate
            : null,
        instalmentLabel: p.cheque?.instalmentLabel
          ? String(p.cheque.instalmentLabel).trim()
          : null,
        instalmentDate:
          typeof p.cheque?.instalmentDate === 'number'
            ? p.cheque.instalmentDate
            : null,
        remarks: p.remarks || null,
      }))
      .filter((x: any) => x.amount > 0);
    const otherPayments: OtherPaymentRow[] = (payments || [])
      .filter((p: any) => String(p.paymentType || '').toUpperCase() === 'OTHER')
      .map((p: any) => ({
        mode: String(p.other?.mode || 'OTHER').toUpperCase(),
        refNo: String(p.other?.refNo || '—'),
        amount: Number(p.amount || 0),
        paidOn:
          typeof p.other?.paidOn === 'number' ? p.other.paidOn : p.submittedOn,
        bankName: p.other?.bankName || null,
        remarks: p.remarks || null,
        status: String(p.status || 'SUBMITTED').toUpperCase(),
      }))
      .filter((x: any) => x.amount > 0);
    let duration: any = null;
    if (adm.programId && typeof adm.programId === 'object')
      duration = adm.programId.duration;
    const creatorName = adm.createdBy?.name || 'Admin';
    return {
      workflowStage: String(adm?.workflow?.stage || ''),
      // CHANGE 2: map new review fields
      reviewRemarks: adm?.workflow?.reviewRemarks || null,
      reviewedAt: adm?.workflow?.reviewedAt || null,
      rejectionReason: adm?.workflow?.rejectionReason || null,
      admissionId: String(adm.admissionId || ''),
      admissionNo: String(adm.admissionNo || ''),
      status: this.mapStageToStatus(adm?.workflow?.stage, adm?.status),
      createdAt: adm.createdAt || '',
      updatedAt: adm.updatedAt || null,
      portalStudentId: adm.portalStudentId,
      student: {
        name: adm.student?.name || '',
        regNo: adm.registrationNumber || null,
        phone: adm.student?.phone || '',
        parentName: adm.student?.parentName || adm.student?.fatherName || '',
        parentPhone: adm.student?.parentPhone || '',
        email: adm.student?.email || null,
        address: adm.student?.address || null,
        city: adm.student?.city || null,
        state: adm.student?.state || null,
        pincode: adm.student?.pincode || null,
        dateOfBirth: adm.student?.dateOfBirth || null,
        gender: adm.student?.gender || null,
        fatherName: adm.student?.fatherName || null,
        motherName: adm.student?.motherName || null,
      },
      academics: {
        centreName: adm.centerName || '',
        programName: adm.programName || '',
        batchName: adm.batchName || null,
        className: adm.classLabel || adm.student?.className || null,
        duration,
        courseStart: adm.courseStartYear
          ? String(adm.courseStartYear)
          : adm.academicYear
            ? adm.academicYear.split(' - ')[0]
            : null,
        startMonth: null,
        academicYear: adm.academicYear || null,
      },
      test: {
        testDate: adm.test?.testDate || null,
        testName: adm.test?.testName || null,
        score: adm.test?.normalizedScore
          ? Number(adm.test.normalizedScore)
          : null,
        percentile: adm.test?.normalizedPercentage
          ? Number(adm.test.normalizedPercentage)
          : null,
        result: this.mapTestResult(adm.test),
        remarks: null,
      },
      schoolMarks: {
        overallPct:
          typeof adm?.schoolMarks?.overallPct === 'number'
            ? adm.schoolMarks.overallPct
            : null,
        coreSubjectPct:
          typeof adm?.schoolMarks?.coreSubjectPct === 'number'
            ? adm.schoolMarks.coreSubjectPct
            : null,
        remarks: adm?.schoolMarks?.remarks || null,
      },
      createdByName: creatorName,
      fee: {
        feePlanCode: adm.feePlanCode || '—',
        feePlanName: adm.feePlanName || '',
        baseFee: Number(adm.fee?.baseFee || 0),
        finalFee: Number(adm.fee?.finalFee || 0),
        testScholarshipPct: Number(adm.fee?.testScholarshipPct || 0),
        scholarshipPct: Number(adm.fee?.scholarshipPct || 0),
        additionalScholarshipPct: Number(
          adm.fee?.additionalScholarshipPct || 0,
        ),
        totalDiscountPct: Number(adm.fee?.totalDiscountPct || 0),
        breakup,
      },
      payments: {
        neftSplitAmount,
        neftTotalEntered,
        neftRefs,
        otherPayments,
        chequeSummary,
        cheques: chequeRows,
      },
    };
  }

  private mapStageToStatus(
    stageRaw?: string,
    statusRaw?: string,
  ): AdmissionStatus {
    const stage = String(stageRaw || '').toUpperCase();
    const stat = String(statusRaw || '').toUpperCase();
    if (stat === 'INACTIVE') return 'cancelled';
    switch (stage) {
      case 'CONFIRMED':
        return 'confirmed';
      case 'PAYMENTS_SUBMITTED':
      case 'FEE_CALC_GENERATED':
      case 'APPROVAL_SENT':
      case 'UNDER_REVIEW':
        return 'submitted';
      case 'DRAFT':
      default:
        return 'draft';
    }
  }

  private mapPaymentStatus(statusRaw: string | undefined): ChequeStatus {
    const s = String(statusRaw || '').toUpperCase();
    switch (s) {
      case 'DEPOSITED':
        return 'deposited';
      case 'CLEARED':
        return 'cleared';
      case 'FAILED':
        return 'bounced';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  private mapTestResult(test: any): 'pass' | 'fail' | 'pending' | null {
    if (!test) return null;
    const waiver =
      typeof test.waiverPerInTf === 'number' ? test.waiverPerInTf : null;
    if (waiver === null) return 'pending';
    return waiver > 0 ? 'pass' : 'fail';
  }

  sendForApproval(): void {
    if (this.actionBusy) return;
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId missing.');
      return;
    }
    this.actionBusy = true;
    const body = { entiId: tenantId, admissionId: this.admissionId };
    this.api.fetchData(body, 'admi', 'submit-approval').subscribe({
      next: (resp: any) => {
        this.actionBusy = false;
        if (!resp?.status)
          return this.alert.error(
            resp?.message || 'Failed to send for approval',
          );
        this.alert.success('Sent for approval');
        this.loadAdmission();
      },
      error: () => {
        this.actionBusy = false;
        this.alert.error('Failed to send for approval');
      },
    });
  }

  approve(): void {
    if (!this.canApproveReject) {
      this.alert.error('Not authorized to approve.');
      return;
    }
    if (this.actionBusy) return;
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId missing.');
      return;
    }
    this.actionBusy = true;
    this.api
      .fetchData(
        { entiId: tenantId, admissionId: this.admissionId },
        'admi',
        'approve',
      )
      .subscribe({
        next: (resp: any) => {
          this.actionBusy = false;
          if (!resp?.status)
            return this.alert.error(resp?.message || 'Approval failed');
          this.alert.success('Admission approved');
          this.loadAdmission();
        },
        error: () => {
          this.actionBusy = false;
          this.alert.error('Approval failed');
        },
      });
  }

  openRejectModal(): void {
    if (!this.canApproveReject) {
      this.alert.error('Not authorized to reject.');
      return;
    }
    this.rejectReason = '';
    this.rejectModalOpen = true;
  }
  closeRejectModal(): void {
    this.rejectModalOpen = false;
    this.rejectReason = '';
  }

  rejectNow(): void {
    const reason = (this.rejectReason || '').trim();
    if (!reason) {
      this.alert.warning('Please enter remarks to reject');
      return;
    }
    if (this.actionBusy) return;
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId missing.');
      return;
    }
    this.actionBusy = true;
    this.api
      .fetchData(
        { entiId: tenantId, admissionId: this.admissionId, reason },
        'admi',
        'reject',
      )
      .subscribe({
        next: (resp: any) => {
          this.actionBusy = false;
          if (!resp?.status)
            return this.alert.error(resp?.message || 'Reject failed');
          this.alert.success('Admission rejected');
          this.closeRejectModal();
          this.loadAdmission();
        },
        error: () => {
          this.actionBusy = false;
          this.alert.error('Reject failed');
        },
      });
  }

  goBack(): void {
    this.location.back();
  }

  private epochToDateInput(v: any): string | null {
    if (!v) return null;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()))
      return v.trim();
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    const d = new Date(n);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

  private roundRupee(v: any): number {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n);
  }

  private esc(v: any): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  printFeeAcknowledgement(): void {
    const html = this.buildFeeAcknowledgementHtml();
    this.openPrintWindow('Fee Acknowledgement', html);
  }

  printFeeCalculation(): void {
    const html = this.buildFeeCalculationHtml();
    this.openPrintWindow('Fee Calculation Sheet', html);
  }

  printContract(): void {
    const html = this.buildContractHtml();
    this.openPrintWindow('Enrolment Contract', html);
  }

  printEnrollmentReport(): void {
    const html = this.buildEnrollmentReportHtml();
    this.openPrintWindow('Enrollment Report', html);
  }

  private openPrintWindow(title: string, innerHtml: string): void {
    const w = window.open('', '_blank', 'width=900,height=800');
    if (!w) {
      console.error('Popup blocked – cannot open print window.');
      return;
    }
    const doc = w.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${this.esc(title)}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              font-size: 11px;
              margin: 16px;
              color: #111827;
            }
            .page {
              width: 100%;
              max-width: 800px;
              margin: 0 auto;
            }

            /* header variants */
            .print-header { margin-bottom: 10px; border-bottom: 2px solid #111827; padding-bottom: 8px; }
            .brand-center { display:flex; justify-content:center; align-items:center; margin-bottom: 6px; }
            .brand-center img { height: 46px; width:auto; object-fit:contain; display:block; }
            .title-wrap { text-align: center; }
            .meta-row { margin-top: 6px; display:flex; justify-content: space-between; font-size: 10px; }

            .header-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #111827;
              padding-bottom: 4px;
              margin-bottom: 8px;
            }
            .title-main {
              font-size: 18px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }
            .subtitle { font-size: 11px; margin-top: 2px; }
            .meta { text-align: right; font-size: 10px; }

            .section { margin-top: 10px; }
            .section-title {
              font-weight: 700;
              text-transform: uppercase;
              font-size: 11px;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 2px;
              margin-bottom: 4px;
            }

            table { width: 100%; border-collapse: collapse; margin-top: 4px; }
            th, td { border: 1px solid #e5e7eb; padding: 3px 4px; vertical-align: top; }
            th { background: #f3f4f6; font-weight: 600; }

            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .small { font-size: 10px; }
            .tiny { font-size: 9px; }
            .mt-1 { margin-top: 4px; }
            .mt-2 { margin-top: 8px; }
            .mt-3 { margin-top: 12px; }

            .note-list { margin: 4px 0 0 16px; padding: 0; font-size: 10px; }
            .note-list li { margin-bottom: 2px; }

            /* kv grid like step1 */
            .kv-grid {
              display: grid;
              grid-template-columns: 32% 68%;
              border: 1px solid #e5e7eb;
              border-collapse: collapse;
              font-size: 11px;
            }
            .kv-grid > div {
              border-bottom: 1px solid #e5e7eb;
              border-right: 1px solid #e5e7eb;
              padding: 3px 4px;
            }
            .kv-grid > div:nth-child(2n) { border-right: none; }
            .kv-label { background: #f9fafb; font-weight: 600; font-size: 10px; }

            /* brand */
            .brand {
              display: flex;
              justify-content: center;
              align-items: center;
              width: 100%;
              margin-bottom: 8px;
            }
            .brand img { height: 42px; width: auto; object-fit: contain; display: block; }

            /* signature helpers */
            .sign-row { margin-top: 18px; display:flex; justify-content: flex-end; }
            .sign-box { width: 240px; text-align: center; }
            .sign-line { height: 55px; border-bottom: 1px solid #111827; }
            .sign-label { margin-top: 6px; font-size: 12px; font-weight: 600; }

            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body onload="window.print();">
          ${innerHtml}
        </body>
      </html>
    `);
    doc.close();
  }

  private buildFeeAcknowledgementHtml(): string {
    const a = this.admission;
    if (!a) return '<p>No data available</p>';
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const fmtDMYHyphen = (v: any) => {
      const d = v ? new Date(v) : new Date();
      if (isNaN(d.getTime())) return '';
      return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
    };
    const enrolledBy = this.esc(a.createdByName || 'Admin');
    const studentName = String(a?.student?.name || '').trim();
    const regNo =
      String(a?.student?.regNo || '').trim() ||
      String((a as any)?.registrationNumber || '').trim();
    const programName = String(a?.academics?.programName || '').trim();
    const feePlanName =
      String((a as any)?.feePlanName || '').trim() ||
      String(a?.fee?.feePlanName || '').trim();
    const payments = Array.isArray(this.rawPayments) ? this.rawPayments : [];
    const neftPays = payments.filter(
      (p: any) => String(p?.paymentType || '').toUpperCase() === 'NEFT',
    );
    const chequePays = payments.filter(
      (p: any) => String(p?.paymentType || '').toUpperCase() === 'CHEQUE',
    );
    const neftCount = neftPays.length || 0;
    const chequeCount = chequePays.length || 0;
    const neftAmt = neftPays.reduce(
      (s: number, p: any) => s + (Number(p?.amount || 0) || 0),
      0,
    );
    const chequeAmt = chequePays.reduce(
      (s: number, p: any) => s + (Number(p?.amount || 0) || 0),
      0,
    );
    const totalAmt =
      (Number(neftAmt || 0) || 0) + (Number(chequeAmt || 0) || 0);
    const dateText = fmtDMYHyphen(Date.now());
    const orgLine1 = 'ZEDSWEVEN I Private Limited, Coimbatore';
    const orgLine2 =
      '47D2, Nehru Nagar West, Civil Aerodrome Post, Kalapatti Road, Coimbatore - 641014';
    const bodyBlock = (copyTitle: string) => `
    <div class="ack-panel">
      <div class="ack-toprow">
        <div class="ack-copy">${this.esc(copyTitle)}</div>
        <!-- logo centered -->
        <div class="ack-logo">
          <img src="${this.esc(this.PRINT_LOGO_URL)}" alt="Logo" />
        </div>
        <!-- right spacer to keep logo perfectly centered -->
        <div class="ack-rightsp"></div>
      </div>
      <div class="ack-org">
        <div class="ack-org1">${this.esc(orgLine1)}</div>
      </div>
      <div class="ack-title">ACKNOWLEDGEMENT</div>
      <div class="ack-date"><b>Date: ${this.esc(dateText)}</b></div>
      <div class="ack-lines">
        <div>
          Received the below mentioned Payments towards the Enrolment for
          <b><u>${this.esc(studentName || '—')}</u></b>
        </div>
        <div class="mt-6">
          with Reg No:
          <b><u>${this.esc(regNo || '—')}</u></b>
          &nbsp;&amp;&nbsp;Enrolling For Program
          <b><u>${this.esc(programName || '—')}</u></b>
        </div>
        <div class="mt-6">
          Fee Plan Opted:
          <b><u>${this.esc(feePlanName || '—')}</u></b>
        </div>
        <div class="mt-6">
          Enrolled by:
          <b><u>${enrolledBy}</u></b>
        </div>
      </div>
      <table class="ack-table">
        <thead>
          <tr>
            <th style="width:40%;">Payment Mode</th>
            <th style="width:30%;" class="text-center">Total No of Payments</th>
            <th style="width:30%;" class="text-center">Total Amount in Rs.</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>UPI / DD / NEFT</td>
            <td class="text-center">${neftCount}</td>
            <td class="text-center">${Number(neftAmt || 0).toLocaleString(
              'en-IN',
            )}</td>
          </tr>
          <tr>
            <td>Post Dated Cheques</td>
            <td class="text-center">${chequeCount}</td>
            <td class="text-center">${Number(chequeAmt || 0).toLocaleString(
              'en-IN',
            )}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2"><b>Total Value of Payments Submitted</b></td>
            <td class="text-center"><b>${Number(totalAmt || 0).toLocaleString(
              'en-IN',
            )}</b></td>
          </tr>
        </tfoot>
      </table>
      <div class="ack-note">
        <i>Please ensure the below mentioned documents are also submitted to complete the admission formalities.</i>
      </div>
      <ol class="ack-list">
        <li>Z-SAT Exam Hall Ticket in Original</li>
        <li>Student ID Proof (Xerox Copy)</li>
        <li>Offer Letter Copy (Print out taken from Result website)</li>
        <li>Enrolment form in Filled Manner</li>
        <li>Passport Size Photograph of student &amp; Parent as mentioned in the enrolment form</li>
      </ol>
      <div class="ack-warn"><b>Note:</b> This is not an Enrolment <b>FEE</b> Receipt.</div>
      <div class="ack-warn2"><b>Proper Enrolment Report will be provided at a later stage along with an enrolment Number</b></div>
      <!-- signature at the end (bottom-right) -->
      <div class="ack-signwrap">
        <div class="ack-sign">Authorised Signatory</div>
      </div>
      <div class="ack-footer">
        <div class="ack-support">
          For any support on a later stage please contact us on 9159241133 / 9626292233
        </div>
        
      </div>
      <div class="ack-org" style="margin-top:25px">
        <div class="ack-org1">${this.esc(orgLine1)}</div>
        <div class="ack-org2">${this.esc(orgLine2)}</div>
      </div>
    </div>
  `;
    return `
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      /* override openPrintWindow defaults safely inside this print only */
      body { margin: 0 !important; }
      .page { max-width: none !important; width: 100% !important; }
      .ack-sheet{
        width:100%;
        display:flex;
        align-items:stretch;
      }
      .ack-panel{
        width:50%;
        padding:8mm 10mm;
        font-size:12px;
        /* make divider span full height + allow signature stick to bottom */
        display:flex;
        flex-direction:column;
        min-height: calc(210mm - 20mm); /* A4 landscape height - @page vertical margins */
        box-sizing:border-box;
      }
      .ack-sep{
        width:0;
        border-left:2px dashed #111827;
        /* full height between the two panels */
        align-self:stretch;
        margin:0;
      }
      .ack-toprow{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:10px;
        margin-bottom:2mm;
      }
      /* left title */
      .ack-copy{
        font-weight:700;
        font-size:12px;
        color:#111827;
        margin-top:2mm;
        flex:1 1 0;
      }
      /* center logo */
      .ack-logo{
        flex:1 1 0;
        display:flex;
        justify-content:center;
        align-items:flex-start;
      }
      .ack-logo img{
        height:38px;
        width:auto;
        object-fit:contain;
        display:block;
      }
      /* right spacer equals left width so logo stays centered */
      .ack-rightsp{
        flex:1 1 0;
      }
      .ack-org{
        text-align:center;
        line-height:1.2;
      }
      .ack-org1{ font-weight:600; }
      .ack-org2{ font-weight:500; font-size:11px; margin-top:2px; }
      .ack-title{
        text-align:center;
        font-weight:800;
        text-decoration:underline;
        margin-top:15px;
        letter-spacing:0.3px;
      }
      .ack-date{ margin-top:15px; font-size:12px; }
      .ack-lines{ margin-top:6px; line-height:1.45; }
      .mt-6{ margin-top:6px; }
      .ack-table{
        width:100%;
        border-collapse:collapse;
        margin-top:6px;
        font-size:12px;
      }
      .ack-table th, .ack-table td{
        border:1px solid #111827;
        padding:6px 8px;
        vertical-align:middle;
      }
      .ack-table th{ font-weight:700; text-align:left; }
      .text-center{ text-align:center; }
      .ack-note{ margin-top:5px; font-size:11px; }
      .ack-list{ margin-top:3px; margin-left:18px; font-size:11px; }
      .ack-warn{ margin-top:3px; font-size:11px; }
      .ack-warn2{ margin-top:1px; font-size:11px; }
      /* push signature to bottom of panel */
      .ack-signwrap{
        margin-top:auto;
        display:flex;
        justify-content:flex-end;
        padding-top:10px;
      }
      .ack-sign{
        white-space:nowrap;
        font-size:11px;
      }
      .ack-footer{
        margin-top:6px;
        display:flex;
        justify-content:space-between;
        align-items:flex-end;
        gap:10px;
        font-size:10px;
      }
      .ack-support{ max-width:100%; }
    </style>

    <div class="ack-sheet">
      ${bodyBlock('OFFICE COPY')}
      <div class="ack-sep"></div>
      ${bodyBlock('PARENT COPY')}
    </div>
  `;
  }

  private buildFeeCalculationHtml(): string {
    const a = this.admission;
    if (!a) return '<p>No data available</p>';
    const today = new Date();
    const finalFee = Number(a?.fee?.finalFee || 0) || 0;
    const testSch = Number(a?.fee?.testScholarshipPct || 0) || 0;
    const schl = Number(a?.fee?.scholarshipPct || 0) || 0;
    const addSchl = Number(a?.fee?.additionalScholarshipPct || 0) || 0;
    const feeRows = (a?.fee?.breakup || []) as any[];
    const scholTotal = feeRows.reduce(
      (s: number, r: any) => s + (Number(r?.scholBenefits || 0) || 0),
      0,
    );
    const feeHeadRowsHtml = feeRows.length
      ? feeRows
          .map((r: any, idx: number) => {
            const label = this.esc(String(r?.label || '').trim());
            const total = Number(r?.total || 0) || 0;
            const ben = Number(r?.scholBenefits || 0) || 0;
            return `
              <tr>
                <td class="text-center">${idx + 1}</td>
                <td>${label}</td>
                <td class="text-right">${total.toLocaleString('en-IN')}</td>
                <td class="text-right">${ben.toLocaleString('en-IN')}</td>
              </tr>
            `;
          })
          .join('')
      : `<tr><td colspan="4" class="text-center">No fee breakup</td></tr>`;
    const instalmentRowsHtml = this.buildFeePlanInstallmentRowsFromPayments();
    const scholarshipText = [
      `Test Scholarship ${testSch}%`,
      schl > 0 ? `${schl}%` : '',
      addSchl > 0 ? `${addSchl}%` : '',
    ]
      .filter(Boolean)
      .join(' + ');
    return `
    <div class="page">
      <div class="print-header">
        <div class="brand-center">
          <img src="${this.esc(this.PRINT_LOGO_URL)}" alt="Logo" />
        </div>
        <div class="title-wrap">
          <div class="title-main">FEE CALCULATION SHEET</div>
          <div class="subtitle">Fee plan breakup (as per selected plan and scholarships)</div>
        </div>
        <div class="meta-row">
          <div><b>Date :</b> ${today.toLocaleDateString('en-IN')}</div>
          <div><b>Prepared On :</b> ${today.toLocaleString('en-IN')}</div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Student and Program Details</div>
        <div class="kv-grid">
          <div class="kv-label">Name of the Student</div>
          <div>${this.esc(a?.student?.name || '')}</div>
          <div class="kv-label">Admission No</div>
          <div>${this.esc(this.admissionNo || a?.admissionNo || '')}</div>
          <div class="kv-label">Registration / Reg No</div>
          <div>${this.esc(a?.student?.regNo || '')}</div>
          <div class="kv-label">Student Mobile</div>
          <div>${this.esc(a?.student?.phone || '')}</div>
          <div class="kv-label">Parent Name</div>
          <div>${this.esc(a?.student?.parentName || '')}</div>
          <div class="kv-label">Parent Mobile</div>
          <div>${this.esc(a?.student?.parentPhone || '')}</div>
          <div class="kv-label">Academic Year</div>
          <div>${this.esc(a?.academics?.academicYear || '—')}</div>
          <div class="kv-label">Program</div>
          <div>${this.esc(a?.academics?.programName || '')}</div>
          <div class="kv-label">Fee Plan</div>
          <div>${this.esc((a as any)?.feePlanName || a?.fee?.feePlanName || '')}</div>
          <div class="kv-label">Study Centre</div>
          <div>${this.esc(a?.academics?.centreName || '')}</div>
          <div class="kv-label">Scholarships</div>
          <div>${this.esc(scholarshipText)}</div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Fee Instalment Breakup</div>
        <table>
          <thead>
            <tr>
              <th style="width:40px;" class="text-center">S.No</th>
              <th>Instalment</th>
              <th style="width:90px;">Mode</th>
              <th style="width:100px;">Fees For</th>
              <th style="width:200px;" class="text-center">Payment in Favour of</th>
              <th style="width:140px;" class="text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${instalmentRowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="5" class="text-right">Total</th>
              <th class="text-right">₹ ${finalFee.toLocaleString('en-IN')}</th>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="sign-row">
        <div class="sign-box">
          <div class="sign-line"></div>
          <div class="sign-label">ENROLLMENT MANAGER</div>
        </div>
      </div>
    </div>
  `;
  }

  private buildContractHtml(): string {
    const a = this.admission;
    if (!a) {
      console.error('No admission loaded');
      return '<p>No data available</p>';
    }
    const today = new Date();
    const providerName = 'ZEDSWEVEN I PRIVATE LIMITED';
    const headOfficeAddress =
      '47D2, Nehru Nagar West, Civil Aerodrome Post, Kalapatti Road, Coimbatore - 641014';
    const preparedBy = this.esc(a.createdByName || 'Admin');
    // --- 1. Data Preparation ---
    const s = a.student || ({} as any);
    const ac = a.academics || ({} as any);
    const fee = a.fee || ({} as any);
    const anyAdm = a as any;

    const studentName = this.esc(s.name || '');
    const parentName = this.esc(s.parentName || '');
    const dob = s.dateOfBirth
      ? new Date(s.dateOfBirth).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—';
    const gender = this.esc(s.gender || '—');
    const courseCommencement = this.esc(
      ac.courseStart || ac.academicYear || '—',
    );

    // Address
    const addrParts = [];
    if (s.address) addrParts.push(s.address);
    if (s.city) addrParts.push(s.city);
    if (s.state) addrParts.push(s.state);
    if (s.pincode) addrParts.push(s.pincode);

    const fullAddress =
      addrParts.length > 0
        ? this.esc(addrParts.join(', '))
        : '__________________________________________________';

    // Identifiers
    const admissionNo = this.esc(a.admissionNo || '');
    const regNo = this.esc(s.regNo || anyAdm.registrationNumber || '');
    const studentId = this.esc(anyAdm.portalStudentId || '');
    const email = this.esc(s.email || '—');
    const phone = this.esc(s.phone || '—');
    const parentPhone = this.esc(s.parentPhone || '—');

    // Program Info
    const programName = this.esc(ac.programName || '');

    // Duration Logic
    let durationText = '—';
    if (ac.duration) {
      const dVal = Number(ac.duration);
      durationText = !isNaN(dVal)
        ? `${dVal} Year${dVal > 1 ? 's' : ''}`
        : String(ac.duration);
    }

    const centerName = this.esc(ac.centreName || '');
    const gstin = this.esc('33AACCZ5769Q1ZF');

    // Fee Info
    const feePlanName = this.esc(fee.feePlanName || '');
    const feeBreakup = fee.breakup || [];

    const totalBase = feeBreakup.reduce(
      (acc: number, item: any) =>
        acc + (item.total || 0) + (item.scholBenefits || 0),
      0,
    );
    const totalWaiver = feeBreakup.reduce(
      (acc: number, item: any) => acc + (item.scholBenefits || 0),
      0,
    );
    const totalPayable = feeBreakup.reduce(
      (acc: number, item: any) => acc + (item.total || 0),
      0,
    );

    // --- 2. Payment Schedule Logic ---
    const allPayments = (this.rawPayments || [])
      .map((p: any) => {
        const type = String(p.paymentType || '').toUpperCase();
        let mode = type;
        let dateRaw = p.submittedOn;
        let refNo = '';

        if (type === 'NEFT') {
          mode = 'NEFT/IMPS';
          dateRaw = p.neft?.paidOn || p.submittedOn;
          refNo = p.neft?.utr || '';
        } else if (type === 'CHEQUE') {
          mode = p.cheque?.mode || 'CHEQUE';
          dateRaw = p.cheque?.dueDate || p.cheque?.chequeDate;
          refNo = p.cheque?.chequeNo || '';
        } else {
          mode = String(p.other?.mode || type).toUpperCase();
          dateRaw = p.other?.paidOn || p.submittedOn;
          refNo = p.other?.refNo || '';
        }

        return {
          mode: mode,
          ref: refNo,
          date: dateRaw,
          amount: Number(p.amount || 0),
        };
      })
      .filter((x) => x.amount > 0)
      .sort((x, y) => (x.date || 0) - (y.date || 0));

    const paymentRowsHtml =
      allPayments.length > 0
        ? allPayments
            .map(
              (p, i) => `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td>${this.esc(p.mode)}</td>
          <td>${this.esc(p.ref || '—')}</td>
          <td class="text-center">${p.date ? new Date(p.date).toLocaleDateString('en-IN') : '—'}</td>
          <td class="text-right">${p.amount.toLocaleString('en-IN')}</td>
        </tr>
      `,
            )
            .join('')
        : `<tr><td colspan="5" class="text-center">No payment schedule found</td></tr>`;

    // --- 3. HTML Generation ---
    return `
      <div class="page">
        <div class="print-header">
           <div>
              <img src="${this.esc(this.PRINT_LOGO_URL)}" alt="Logo" style="height:50px;" />
           </div>
           <div class="title-wrap mt-1">
              <div class="title-main" style="font-size:18px; border-bottom:1px solid #000; display:inline-block; padding-bottom:2px;">ENROLMENT CONTRACT</div>
              <div class="tiny text-center mt-1">(Pursuant to Rule 6 of Point of Taxation Rules, 2011)</div>
           </div>
        </div>

        <div class="section" style="margin-top:15px; line-height:1.5; font-size:14px;">
          This contract is executed on <b>${today.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</b> between 
          <b>${this.esc(providerName)}</b>, having its registered office at ${this.esc(headOfficeAddress)} 
          and <b>Mr./Ms. ${parentName}</b> (Name of Parent / Guardian), resident of 
          <b>${fullAddress}</b>, hereinafter referred to as "Parent / Guardian" of the "Student" 
          for a period of about <b>${durationText}</b> and as per the terms and conditions specified.
        </div>

        <div class="section mt-4" style="font-size:14px;">
          <div class="section-title" style="font-size:15px;">1. STUDENT / PROGRAM DETAILS</div>
          <div class="mb-2">The details of the "Student's" Enrolment, Course, Program fees, duration of the course and other relevant details shall be as under:</div>
          
          <table class="table-bordered" style="font-size:14px;">
            <tbody>
               <tr>
                 <td colspan="2" style="background:#eee;"><b>i. Details of Education Provider</b></td>
               </tr>
               <tr>
                 <td width="40%">Full Name</td>
                 <td>${this.esc(providerName)}</td>
               </tr>
               <tr>
                 <td>Head Office Address</td>
                 <td>${this.esc(headOfficeAddress)}</td>
               </tr>

               <tr>
                 <td colspan="2" style="background:#eee;"><b>ii. Details of "Student" / "Parent" / "Guardian"</b></td>
               </tr>
               <tr>
                 <td>Full Name of "Student"</td>
                 <td><b>${studentName}</b></td>
               </tr>
               <tr>
                 <td>Date of Birth</td>
                 <td>${dob}</td>
               </tr>
               <tr>
                 <td>Gender</td>
                 <td>${gender}</td>
               </tr>
               <tr>
                 <td>Enrolment Number</td>
                 <td><b>${admissionNo}</b></td>
               </tr>
                <tr>
                 <td>Registration Number</td>
                 <td>${regNo}</td>
               </tr>
               <tr>
                 <td>Student ID</td>
                 <td>${studentId}</td>
               </tr>
               <tr>
                 <td>Email ID</td>
                 <td>${email}</td>
               </tr>
               <tr>
                 <td>Contact Number</td>
                 <td>${phone}</td>
               </tr>
               <tr>
                 <td>Full Name of "Parent/Guardian"</td>
                 <td><b>${parentName}</b></td>
               </tr>
               <tr>
                 <td>Parent Mobile</td>
                 <td>${parentPhone}</td>
               </tr>
               <tr>
                 <td>Permanent Address</td>
                 <td>${fullAddress}</td>
               </tr>

               <tr>
                 <td colspan="2" style="background:#eee;"><b>iii. Program / Centre related information</b></td>
               </tr>
               <tr>
                 <td>Full Name of Program</td>
                 <td><b>${programName}</b></td>
               </tr>
               <tr>
                 <td>Duration of Program</td>
                 <td>${durationText}</td>
               </tr>
               <tr>
                 <td>Course Commencement</td>
                 <td>${courseCommencement}</td>
               </tr>
               <tr>
                 <td>Study Centre</td>
                 <td>${centerName}</td>
               </tr>
               <tr>
                 <td>GSTIN</td>
                 <td>${gstin}</td>
               </tr>
            </tbody>
          </table>
        </div>

        <div style="page-break-after: always;"></div>

        <div class="section mt-3">
           <div class="section-title">2. DETAILS ABOUT THE COURSE FEE, SCHOLARSHIPS / WAIVERS AND PAYMENT SCHEDULE:</div>
           <div class="small mb-2">
             The details of the Course fees <b>(Fee Plan: ${feePlanName})</b>, Scholarship / Fee waivers / reward offered and the payment schedule for the program selected by you for the "Student" is as follows:
           </div>

           <table class="table-bordered mb-3">
             <thead>
               <tr style="background:#eee;">
                 <th>Fee Head</th>
                 <th class="text-right">Gross Amount (₹)</th>
                 <th class="text-right">Scholarship / Waiver (₹)</th>
                 <th class="text-right">Net Fee Payable (₹)</th>
               </tr>
             </thead>
             <tbody>
               ${feeBreakup
                 .map((row: any) => {
                   const base = (row.total || 0) + (row.scholBenefits || 0);
                   return `
                 <tr>
                   <td>${this.esc(row.label)}</td>
                   <td class="text-right">${base.toLocaleString('en-IN')}</td>
                   <td class="text-right">${(row.scholBenefits || 0).toLocaleString('en-IN')}</td>
                   <td class="text-right"><b>${(row.total || 0).toLocaleString('en-IN')}</b></td>
                 </tr>`;
                 })
                 .join('')}
             </tbody>
             <tfoot>
                <tr style="background:#f9f9f9;">
                  <td><b>Total</b></td>
                  <td class="text-right"><b>${totalBase.toLocaleString('en-IN')}</b></td>
                  <td class="text-right"><b>${totalWaiver.toLocaleString('en-IN')}</b></td>
                  <td class="text-right"><b>${totalPayable.toLocaleString('en-IN')}</b></td>
                </tr>
             </tfoot>
           </table>
           <div class="small mb-1"><b>Payment Schedule (Installments):</b></div>
           <table class="table-bordered">
              <thead>
                <tr style="background:#eee;">
                  <th width="30">S.No</th>
                  <th>Installment</th>
                  <th class="text-center">Due Date</th>
                  <th class="text-right">Amount (₹)</th>
                  <th>Mode</th>
                </tr>
              </thead>
              <tbody>
                ${paymentRowsHtml}
              </tbody>
           </table>
           <div class="tiny mt-1 text-muted">
             * The GST has been calculated @18.00% (wherever applicable) as per the current prevailing tax rates/laws and is subject to revision with change in governing GST laws/rules.
           </div>
        </div>
        <div style="page-break-after: always;"></div>

        <div class="section mt-3">
           <div class="section-title">3. MISCELLANEOUS TERMS AND CONDITIONS:</div>
           <div class="small" style="line-height:1.5;">
             <ol type="a" style="margin-top:4px; padding-left:15px;">
               <li class="mb-1">
                 The "Parent" / "Guardian" shall have to deposit the Local Post dated cheque(s) for prescribed dates as per the policy.
               </li>
               <li class="mb-1">
                 In case any of the Post dated cheque(s) are dishonoured for any reason whatsoever, the student has to submit a demand draft / Pay Order / NEFT inclusive of Administrative Charges Rs 500/- (Rupees Five Hundred only) and in addition to this a late fine of Rs 50/- per day from due date of PDC, for a maximum period of ten days.The total Amount of Demand Draft or Payorder or NEFT has to be inclusive of the amount of dishonoured PDC, admisinistrative charges and the late fine as applicable.
               </li>
               <li class="mb-1">
                 Only Demand Draft or NEFT shall be accepted against any dishonoured cheque and the dishonoured cheque shall not be represented under any circumstance.
               </li>
               <li class="mb-1">
                 After ten days the student may be debarred from attending classes till he/she makes full payment. The student shall have no claim for the missed classes. A student may not be debarred from the classes despite no payment even after the 10 days period if the parent assures in writing to pay the fee dues within 20 days from the due date and the centre head accepts in writing, the request and assurance given by the parent.In this situationthe bouncing charges will be rupees hundres (Rs 100/-)per day.
               </li>
               <li class="mb-1">
                 If the parent fails to honour his commitment then enrolment & all the rights of the student & the parent shall stand terminated and the institute shall proceed to recover the fee due by the process of law as well as proceed with complaint under section 139 for the dishonour of the said cheque(s).
               </li>
               <li class="mb-1">
                 All Communications will be sent to the above mentioned email Address / Mobile / mailing address only and in the event of any change, the "student" / "parent"/ "Guardian" is required to submit the information to the office within 7 days. The institute shall not be responsible for any loss of correspondence(s) on account of change in information submitted at the time of enrolment.
               </li>
               <li class="mb-1">
                 "Enrolment Form" is filled and signed by the "student" / "parent"/ "Guardian" at the time of enrolling for the above mentioned Course. All the terms & conditions stipulated in the "Enrolment Form" are obligatory on part of the "student" / "parent"/ "Guardian".
               </li>
             </ol>
           </div>
        </div>

        <div class="section mt-3">
           <div class="section-title">4. JURISDICTION:</div>
           <div class="small" style="line-height:1.5;">
             The registered office of <b>${this.esc(providerName)}</b> is at Coimbatore. In case of any dispute, student / parents subject to the exclusive jurisdiction of appropriate courts in Coimbatore / Tamil Nadu only. All Disputes shall be referred to the sole arbitrator appointed by the management. The decision of the arbitrator shall be final and binding.The Arbitrator so appointed shall not be incapacitated for reasons of their being the emplyoee of ${this.esc(providerName)} or its sister concerns, and for reason of having any prior linkage with the company.
           </div>
        </div>

        <div class="section" style="margin-top:30px;">
           <table style="width:100%; border:none;">
             <tr>
               <td style="width:28%; border:none; vertical-align:top; text-align:center; padding-bottom:40px;">
                  <div style="height:200px; width:140px; border:1px solid #ccc; margin:0 auto 10px auto; display:flex; align-items:center; justify-content:center; color:#999; font-size:10px;">
                     Affix Photo<br>Parent
                  </div>
                  <div style="border-top:1px solid #000; width:60%; margin:0 auto; padding-top:10px;">Signature of Parent</div>
               </td>
               <td style="width:28%; border:none; vertical-align:top; text-align:center; padding-bottom:40px;">
                  <div style="height:200px; width:140px; border:1px solid #ccc; margin:0 auto 10px auto; display:flex; align-items:center; justify-content:center; color:#999; font-size:10px;">
                     Affix Photo<br>Student
                  </div>
                  <div style="border-top:1px solid #000; width:60%; margin:0 auto; padding-top:10px;">Signature of Student</div>
               </td>
               <td style="width:44%; border:none; vertical-align:top; text-align:center; padding-bottom:40px;"><?td>
             </tr>
             
             <tr>
               <td colspan="3" style="border:none; text-align:right; padding-top:20px;">
                  <div style="margin-bottom:50px;">For <b>${this.esc(providerName)}</b></div>
                  <div style="display:inline-block; text-align:center; width:200px;">
                    <div style="border-top:1px solid #000; padding-top:10px;">Authorised Signatory</div>
                  </div>
                  <div class="tiny text-end mt-3">* Valid only if signed and sealed by the Institute office</div>
               </td>
             </tr>
           </table>
        </div>
      </div>
    `;
  }

  private buildEnrollmentReportHtml(): string {
    const a = this.admission;
    if (!a) return '<p>No data available</p>';
    const s = a.student;
    const ac = a.academics;
    const fee = a.fee;
    const anyAdm = a as any;
    const today = new Date();
    const providerName = 'ZEDSWEVEN I PRIVATE LIMITED';
    const studentName = this.esc(s.name || '');
    const regNo = this.esc(s.regNo || anyAdm.registrationNumber || '—');
    const enrollNo = this.esc(a.admissionNo || '—');
    const studentId = this.esc(
      anyAdm.portalStudentId || anyAdm.studentId || '—',
    );
    const enrollDate = this.esc(
      a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-IN') : '—',
    );
    const dob = s.dateOfBirth
      ? new Date(s.dateOfBirth).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—';
    const sex = this.esc(s.gender || '—');
    const mobile = this.esc(s.phone || '—');
    const email = this.esc(s.email || '—');
    const father = this.esc(s.fatherName || s.parentName || '—');
    const mother = this.esc(s.motherName || '—');

    const program = this.esc(ac.programName || '—');
    const center = this.esc(ac.centreName || '—');
    const feePlan = this.esc(fee.feePlanName || '—');
    const batch = this.esc(ac.batchName || '—');
    const courseStart = this.esc(ac.courseStart || ac.startMonth || '—');
    const enrolledBy = this.esc(a.createdByName || 'Admin');

    const addrParts = [];
    if (s.address) addrParts.push(s.address);
    if (s.city) addrParts.push(s.city);
    if (s.state) addrParts.push(s.state);
    if (s.pincode) addrParts.push(s.pincode);
    const address = addrParts.length > 0 ? this.esc(addrParts.join(', ')) : '—';

    // Fee
    const feeBreakup = fee.breakup || [];
    const totalFee = feeBreakup.reduce(
      (acc: number, item: any) => acc + (item.total || 0),
      0,
    );
    const feeRows = feeBreakup
      .map(
        (r: any) => `
      <tr>
        <td>${this.esc(r.label)}</td>
        <td class="text-right">${Number(r.total || 0).toLocaleString('en-IN')}</td>
      </tr>
    `,
      )
      .join('');
    const allPayments = (this.rawPayments || [])
      .map((p: any) => {
        const type = String(p.paymentType || '').toUpperCase();
        let mode = type;
        let dateRaw = p.submittedOn;
        let refNo = '';
        let bank = '';
        if (type === 'NEFT') {
          mode = 'NEFT/IMPS';
          dateRaw = p.neft?.paidOn || p.submittedOn;
          refNo = p.neft?.utr || '';
          bank = p.neft?.bankName || '';
        } else if (type === 'CHEQUE') {
          const isPdc = (p.cheque?.mode || '').includes('PDC');
          mode = p.cheque?.mode || 'PDC';
          dateRaw = p.cheque?.chequeDate;
          refNo = p.cheque?.chequeNo || '';
          bank = p.cheque?.bankName || '';
        } else {
          mode = String(p.other?.mode || type).toUpperCase();
          dateRaw = p.other?.paidOn || p.submittedOn;
          refNo = p.other?.refNo || '';
          bank = p.other?.bankName || '';
        }
        return {
          mode,
          date: dateRaw,
          ref: refNo,
          bank,
          amount: Number(p.amount || 0),
        };
      })
      .filter((x: any) => x.amount > 0)
      .sort((a: any, b: any) => (a.date || 0) - (b.date || 0));

    const totalPaid = allPayments.reduce(
      (s: number, x: any) => s + x.amount,
      0,
    );
    const payRows = allPayments.length
      ? allPayments
          .map(
            (p: any, i: number) => `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td>${this.esc(p.mode)}</td>
        <td>${p.date ? new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</td>
        <td>${this.esc(p.ref)}</td>
        <td>${this.esc(p.bank)}</td>
        <td class="text-right">${p.amount.toLocaleString('en-IN')}</td>
      </tr>
    `,
          )
          .join('')
      : `<tr><td colspan="6" class="text-center">No payments found</td></tr>`;

    return `
      <div class="page">
        <div class="print-header" style="border:none; margin-bottom:20px;">
           <div class="brand-center">
              <img src="${this.esc(this.PRINT_LOGO_URL)}" alt="Logo" style="height:50px;" />
           </div>
           <div class="title-wrap">
              <div class="title-main" style="text-decoration:underline;">ENROLMENT REPORT</div>
           </div>
        </div>

        <div class="section">
           <div class="section-title">Student, Program and Study Centre Details</div>
           <div class="kv-grid">
              <div class="kv-cell">
                 <span class="kv-key">Enrollment No.</span><br>
                 <b>${enrollNo}</b>
              </div>
              <div class="kv-cell">
                 <span class="kv-key">Registration No.</span><br>
                 <b>${regNo}</b>
              </div>
              <div class="kv-cell">
                 <span class="kv-key">Student ID</span><br>
                 <b>${studentId}</b>
              </div>
              <div class="kv-cell">
                 <span class="kv-key">Enrollment Date</span><br>
                 <b>${enrollDate}</b>
              </div>
              <div class="kv-cell">
                 <span class="kv-key">Name of the Student</span><br>
                 <b>${studentName}</b>
              </div>
              <div class="kv-cell">
                 <span class="kv-key">Enrolled by</span><br>
                 <b>${enrolledBy}</b>
              </div>
              <div class="kv-cell">
                 <span class="kv-key">Date of Birth</span><br>
                 <b>${dob}</b>
              </div>
              <div class="kv-cell">
                 <span class="kv-key">Sex</span><br>
                 <b>${sex}</b>
              </div>
              <div class="kv-cell">
                 <span class="kv-key">Mobile Number</span><br>
                 <b>${mobile}</b>
              </div>
              <div class="kv-cell">
                 <span class="kv-key">Email ID</span><br>
                 <b>${email}</b>
              </div>
              <div class="kv-cell">
                 <span class="kv-key">Father Name</span><br>
                 <b>${father}</b>
              </div>
              <div class="kv-cell">
                 <span class="kv-key">Mother Name</span><br>
                 <b>${mother}</b>
              </div>
              <div class="kv-cell full-width">
                 <span class="kv-key">Program</span><br>
                 <b>${program}</b>
              </div>
              <div class="kv-cell full-width">
                 <span class="kv-key">Study Centre</span><br>
                 <b>${center}</b>
              </div>
              <div class="kv-cell full-width">
                 <span class="kv-key">Fee Plan</span><br>
                 <b>${feePlan}</b>
              </div>
              <div class="kv-cell full-width">
                 <span class="kv-key">Course Commencement</span><br>
                 <b>${courseStart}</b>
              </div>

              <div class="kv-cell full-width">
                 <span class="kv-key">Mailing Address</span><br>
                 <b>${address}</b>
              </div>
           </div>
        </div>
        <div class="section mt-3">
           <div class="section-title">Payment Schedule</div>
           <table class="data-table">
              <thead>
                 <tr>
                    <th style="width:40px;">S.No</th>
                    <th>Mode</th>
                    <th>Dated</th>
                    <th>DD/Chg. No / Ref</th>
                    <th>Bank</th>
                    <th style="text-align:right;">Amount (₹)</th>
                 </tr>
              </thead>
              <tbody>
                 ${payRows}
              </tbody>
              <tfoot>
                 <tr>
                    <td colspan="5" style="text-align:right; font-weight:bold;">Total payments made so far</td>
                    <td style="text-align:right; font-weight:bold;">${totalPaid.toLocaleString('en-IN')}</td>
                 </tr>
              </tfoot>
           </table>
        </div>

        <div class="section mt-3 small">
           <div style="font-weight:bold; margin-bottom:4px;">Note:</div>
           <div>This dues are to be cleared on or before due date subject to scholarship awarded if any.</div>
           
           <div style="font-weight:bold; margin-top:10px; margin-bottom:4px;">Important</div>
           <ul style="padding-left:15px; margin:0;">
              <li>Your invoice/payment receipt will be issued online within 14 days of payment realisation.</li>
              <li>All communications, Performance report etc., will be sent to the email address/mobile/mailing address updated by you online.</li>
              <li>Cheques/DDs subject to realisation.</li>
              <li>The GST has been calculated @18.00% (wherever applicable) as per the current prevailing tax rates/laws.</li>
           </ul>
        </div>

        <div class="small text-right mt-3" style="border-top:1px solid #ccc; padding-top:5px;">
           Printed on ${today.toLocaleString('en-IN')}
        </div>
         <div class="sign">Authorised Signatory</div>
      </div>

      <style>
         /* Grid Logic: Container draws Top+Left. Cells draw Bottom+Right. Prevents double borders. */
         .kv-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            border-bottom: 0.5px solid #555;  
            border-right: 0.5px solid #555;  
         }
         .kv-cell { 
            border: 0.5px solid #555;  
            padding: 6px; 
         }
         .kv-cell.full-width {
            grid-column: span 2;
         }
         .kv-key { font-size: 10px; color: #555; }
         /* Standard Table Logic */
         .data-table { width: 100%; border-collapse: collapse; border: 1px solid #000; }
         .data-table th, .data-table td { border: 1px solid #000; padding: 5px; font-size:11px; vertical-align:top; }
         .data-table th { background: #fff; }
          .sign {
            margin-top: 50px;
            text-align: right;
          }
      </style>
    `;
  }

  private buildInstallmentBreakupFromAdmission(): string {
    const a = this.admission;
    const instals = (a as any)?.fee?.instalments || [];
    const nefts = a?.payments?.neftRefs || [];
    const cheques = a?.payments?.cheques || [];
    if (Array.isArray(instals) && instals.length) {
      const baseAmounts = instals.map((i: any) => Number(i.amount) || 0);
      const baseTotal = baseAmounts.reduce((s: number, x: number) => s + x, 0);
      const scaled = this.scalePlan(baseAmounts, this.finalFee || 0, baseTotal);
      return instals
        .map((i: any, idx: number) => {
          const label = String(i.label || `Instalment ${idx + 1}`).trim();
          const due = this.toDateInputISO(i.dueDate) || '';
          const amount = Number(scaled[idx] || 0);
          const mode = idx === 0 ? 'NEFT' : 'CHEQUE';
          return `
            <tr>
              <td class="text-center">${idx + 1}</td>
              <td>${this.esc(label)}</td>
              <td>${this.esc(due)}</td>
              <td class="text-center">${mode}</td>
              <td class="text-right">${amount.toLocaleString('en-IN')}</td>
            </tr>
          `;
        })
        .join('');
    }
    let sno = 1;
    const rows: string[] = [];
    const neftTotal = nefts.reduce((s, n) => s + Number(n.amount || 0), 0);
    rows.push(`
      <tr>
        <td class="text-center">${sno++}</td>
        <td>Advance (NEFT)</td>
        <td>${this.esc(
          nefts?.[0]?.paidOn
            ? new Date(nefts[0].paidOn).toLocaleDateString('en-IN')
            : '',
        )}</td>
        <td class="text-center">NEFT</td>
        <td class="text-right">${Number(neftTotal || 0).toLocaleString(
          'en-IN',
        )}</td>
      </tr>
    `);
    cheques.forEach((c, idx) => {
      rows.push(`
        <tr>
          <td class="text-center">${sno++}</td>
          <td>Cheque ${idx + 1}</td>
          <td>${this.esc(
            c.dueDate ? new Date(c.dueDate).toLocaleDateString('en-IN') : '',
          )}</td>
          <td class="text-center">CHEQUE</td>
          <td class="text-right">${Number(c.amount || 0).toLocaleString(
            'en-IN',
          )}</td>
        </tr>
      `);
    });

    return rows.join('');
  }

  private scalePlan(
    amounts: number[],
    targetTotal: number,
    baseTotal: number,
  ): number[] {
    const target = this.roundRupee(targetTotal);
    if (!baseTotal || target <= 0) return amounts.map(() => 0);
    const raw = amounts.map((a) => (Number(a || 0) / baseTotal) * target);
    const rounded = raw.map((x) => {
      const base = Math.floor(x);
      const frac = x - base;
      return frac >= 0.5 ? base + 1 : base;
    });
    let sum = rounded.reduce((s, x) => s + x, 0);
    let diff = target - sum;

    let idx = rounded.length - 1;
    while (diff > 0 && rounded.length) {
      rounded[idx] = rounded[idx] + 1;
      diff--;
      idx--;
      if (idx < 0) idx = rounded.length - 1;
    }
    idx = rounded.length - 1;
    while (diff < 0 && rounded.length) {
      if (rounded[idx] > 0) {
        rounded[idx] = rounded[idx] - 1;
        diff++;
      }
      idx--;
      if (idx < 0) idx = rounded.length - 1;
    }
    return rounded;
  }

  private buildFeePlanInstallmentRowsFromPayments(): string {
    const a = this.admission;
    if (!a) {
      return '<tr><td colspan="6" class="text-center">No data</td></tr>';
    }
    const breakup = Array.isArray(a?.fee?.breakup)
      ? (a.fee.breakup as any[])
      : [];
    const remaining = breakup
      .map((b) => ({
        label: String(b?.label || '').trim(),
        total: Number(b?.total || 0) || 0,
      }))
      .filter((x) => !!x.label && x.total > 0);
    const pickFeesFor = (amt: number): string => {
      let amount = Number(amt || 0) || 0;
      if (amount <= 0) return '—';
      const labels: string[] = [];
      const tol = 2;
      while (amount > 0 && remaining.length) {
        const head = remaining[0];
        const headAmt = Number(head.total || 0) || 0;
        if (headAmt <= 0) {
          remaining.shift();
          continue;
        }
        if (headAmt <= amount + tol) {
          labels.push(head.label);
          amount = amount - headAmt;
          remaining.shift();
          continue;
        }
        labels.push(`${head.label}`);
        head.total = headAmt - amount;
        amount = 0;
      }
      return labels.length ? labels.join(', ') : '—';
    };
    const neftEntered =
      Number(
        (a as any)?.payments?.neftTotalEntered ??
          a?.payments?.neftTotalEntered ??
          0,
      ) || 0;
    const neftRefs = a?.payments?.neftRefs || [];
    const cheques = a?.payments?.cheques || [];
    const favourDefault =
      (cheques?.[0]?.favourOf ? String(cheques[0].favourOf).trim() : '') ||
      (() => {
        const p0 = (this.rawPayments || []).find(
          (p: any) => p?.cheque?.favourOf,
        );
        return p0?.cheque?.favourOf ? String(p0.cheque.favourOf).trim() : '';
      })() ||
      '—';

    const rows: string[] = [];
    let sno = 1;
    if (neftEntered > 0) {
      const feesFor = pickFeesFor(neftEntered);
      rows.push(`
      <tr>
        <td class="text-center">${sno++}</td>
        <td>ON ADMISSION</td>
        <td>Online/DD</td>
        <td>${this.esc(feesFor)}</td>
        <td>${this.esc(favourDefault)}</td>
        <td class="text-right">${Number(neftEntered).toLocaleString('en-IN')}</td>
      </tr>
    `);
    }
    cheques.forEach((c: any) => {
      const amt = Number(c?.amount || 0) || 0;
      if (amt <= 0) return;
      const due = this.formatDateDMY(c?.dueDate);
      const modeRaw = String(c?.mode || '')
        .trim()
        .toUpperCase();
      const mode = modeRaw ? `(${modeRaw})` : 'PDC';
      const feesFor = pickFeesFor(amt);
      const favour =
        (c?.favourOf ? String(c.favourOf).trim() : '') || favourDefault;

      rows.push(`
      <tr>
        <td class="text-center">${sno++}</td>
        <td>${this.esc(due === '—' ? '' : due)}</td>
        <td>${this.esc(mode)}</td>
        <td>${this.esc(feesFor)}</td>
        <td>${this.esc(favour)}</td>
        <td class="text-right">${amt.toLocaleString('en-IN')}</td>
      </tr>
    `);
    });
    return (
      rows.join('') ||
      '<tr><td colspan="6" class="text-center">No schedule</td></tr>'
    );
  }

  private formatDateDMY(v: any): string {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return '—';
    const d = new Date(n);
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  private toDateInputISO(v: any): string | null {
    if (!v) return null;
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (isoMatch?.[1]) return isoMatch[1];
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }
}
