import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { Router } from '@angular/router';

type ChequeMode = 'PDC' | 'CDC';

interface PortalStudentResult {
  portalStudentId: string;
  regNo: string;
  name: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  email?: string;
  programName: string;
  centerName: string;
  testScholarshipPct: number;
}

interface FeePlan {
  id: string;
  name: string;
  baseInstalments: number[];
  feeHeads: Array<{
    key: string;
    label: string;
    fee: number;
    stax: number;
  }>;
}

@Component({
  selector: 'app-admissions',
  standalone: false,
  templateUrl: './admissions.component.html',
  styleUrl: './admissions.component.scss',
})
export class AdmissionsComponent implements OnInit {
  step: 0 | 1 | 2 = 0;

  discountOptions = Array.from({ length: 21 }, (_, i) => i * 5);

  lookupForm!: UntypedFormGroup;
  step1Form!: UntypedFormGroup;
  step2Form!: UntypedFormGroup;

  loading = false;

  submittedForAck = false;
  submitting = false;

  feeCalcGenerated = false;
  approvalSent = false;

  // Direct enrolment toggle
  isDirectEnrolment = false;

  // fetched portal data (dummy)
  portal: PortalStudentResult | null = null;

  // Fee plans
  feePlans: FeePlan[] = [
    {
      id: 'plan16',
      name: '9020 Base Fee Plan',
      baseInstalments: [92866, 55720, 55720, 55720, 55720, 55720],
      feeHeads: [
        { key: 'admission', label: 'Admission Fee', fee: 118050, stax: 21249 },
        {
          key: 'admin',
          label: 'Administrative Charges',
          fee: 78700,
          stax: 14166,
        },
        {
          key: 'study',
          label: 'Study Material Price',
          fee: 84000,
          stax: 15120,
        },
        { key: 'exam', label: 'Examination Fee', fee: 22000, stax: 3960 },
        { key: 'cbt', label: 'CBT Support Charges', fee: 2500, stax: 450 },
        { key: 'tuition', label: 'Tuition Fee', fee: 135492, stax: 24389 },
      ],
    },
  ];

  // constant payee as requested
  readonly DEFAULT_FAVOUR_OF = 'ZEDSWEVEN I PRIVATE LIMITED';

  constructor(
    private fb: UntypedFormBuilder,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private router: Router
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Admissions' },
      { label: 'New Admission' },
    ]);
  }

  ngOnInit(): void {
    // (2) regNo validation relaxed – no strict validators
    this.lookupForm = this.fb.group({
      regNo: [''],
      directEnrolment: [false],
    });

    this.step1Form = this.fb.group({
      portalStudentId: [''],

      // regNo can be anything or blank (direct enrolment)
      regNo: [{ value: '', disabled: true }],

      name: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      parentName: ['', Validators.required],
      parentPhone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      email: ['', [Validators.email]],
      programName: ['', Validators.required],
      centerName: ['', Validators.required],

      feePlanId: [this.feePlans[0]?.id || '', Validators.required],
      baseFee: [{ value: 0, disabled: true }],

      testScholarshipPct: [{ value: 0, disabled: true }],
      scholarshipPct: [0, [Validators.min(0), Validators.max(100)]],
      additionalScholarshipPct: [0, [Validators.min(0), Validators.max(100)]],
    });

    this.step2Form = this.fb.group({
      neftAmount: [{ value: 0, disabled: true }],
      neftRefs: this.fb.array([]),
      cheques: this.fb.array([]),
    });

    this.step1Form.get('feePlanId')?.valueChanges.subscribe(() => {
      this.refreshBaseFeeFromPlan();
      this.resetWorkflowFlags();
    });

    this.step1Form
      .get('scholarshipPct')
      ?.valueChanges.subscribe(() => this.resetWorkflowFlags());
    this.step1Form
      .get('additionalScholarshipPct')
      ?.valueChanges.subscribe(() => this.resetWorkflowFlags());
    this.step1Form
      .get('testScholarshipPct')
      ?.valueChanges.subscribe(() => this.resetWorkflowFlags());

    // init base fee
    this.refreshBaseFeeFromPlan();
  }

  // ---------- common ----------
  private resetWorkflowFlags(): void {
    this.feeCalcGenerated = false;
    this.approvalSent = false;
    this.submittedForAck = false;
  }

  private setRegNoLock(lock: boolean): void {
    const c = this.step1Form.get('regNo');
    if (!c) return;
    lock ? c.disable({ emitEvent: false }) : c.enable({ emitEvent: false });
  }

  private setTestScholarshipLock(lock: boolean): void {
    const c = this.step1Form.get('testScholarshipPct');
    if (!c) return;
    lock ? c.disable({ emitEvent: false }) : c.enable({ emitEvent: false });
  }

  get selectedPlan(): FeePlan | null {
    const id = this.step1Form.get('feePlanId')?.value;
    return this.feePlans.find((p) => p.id === id) || null;
  }

  private refreshBaseFeeFromPlan(): void {
    const plan = this.selectedPlan;
    const total =
      plan?.feeHeads?.reduce(
        (s, x) => s + (Number(x.fee || 0) + Number(x.stax || 0)),
        0
      ) || 0;
    this.step1Form.get('baseFee')?.setValue(total, { emitEvent: false });
  }

  toggleDirectEnrolment(): void {
    this.isDirectEnrolment = !!this.lookupForm.get('directEnrolment')?.value;
  }

  // ---------- step 0 ----------
  // (1) direct enrolment: no regNo, just go next step
  proceedDirectEnrolment(): void {
    this.isDirectEnrolment = true;
    this.lookupForm.patchValue({ directEnrolment: true }, { emitEvent: false });

    this.portal = null;
    this.step1Form.reset();
    this.step1Form.patchValue({
      portalStudentId: '',
      regNo: '',
      feePlanId: this.feePlans[0]?.id || '',
      testScholarshipPct: 0,
      scholarshipPct: 0,
      additionalScholarshipPct: 0,
    });

    this.setRegNoLock(false); // allow typing if they want
    this.setTestScholarshipLock(false); // allow typing
    this.refreshBaseFeeFromPlan();
    this.resetWorkflowFlags();
    this.step = 1;
  }

  // fetch flow (regNo optional, but if empty we block only in fetch mode)
  fetchByRegNo(): void {
    this.toggleDirectEnrolment();
    const regNo = String(this.lookupForm.value.regNo || '').trim();

    if (!regNo) {
      this.alert.error(
        'Please enter Enrolment / Reg No to fetch from portal. Or use Direct Enrolment.'
      );
      return;
    }

    this.loading = true;

    setTimeout(() => {
      const dummy: PortalStudentResult = {
        portalStudentId: 'PORTAL-123',
        regNo,
        name: 'Student Name',
        phone: '9000000000',
        parentName: 'Parent Name',
        parentPhone: '9888888888',
        email: 'student@email.com',
        programName: 'JEE Weekend',
        centerName: 'Coimbatore',
        testScholarshipPct: 20,
      };

      this.portal = dummy;

      this.step1Form.reset();
      this.step1Form.patchValue({
        portalStudentId: dummy.portalStudentId,
        regNo: dummy.regNo,
        name: dummy.name,
        phone: dummy.phone,
        parentName: dummy.parentName,
        parentPhone: dummy.parentPhone,
        email: dummy.email,
        programName: dummy.programName,
        centerName: dummy.centerName,
        feePlanId: this.feePlans[0]?.id || '',
        testScholarshipPct: dummy.testScholarshipPct,
        scholarshipPct: 0,
        additionalScholarshipPct: 0,
      });

      this.setRegNoLock(true);
      this.setTestScholarshipLock(true);
      this.refreshBaseFeeFromPlan();

      this.resetWorkflowFlags();
      this.step = 1;

      this.loading = false;
      this.alert.success('Fetched student details (dummy).');
    }, 300);
  }

  goToLookup(): void {
    this.step = 0;
    this.resetWorkflowFlags();
  }

  // ---------- fee math ----------
  get baseFee(): number {
    const plan = this.selectedPlan;
    const heads = plan?.feeHeads || [];
    return heads.reduce(
      (s, h) => s + (Number(h.fee || 0) + Number(h.stax || 0)),
      0
    );
  }

  get testScholarshipPct(): number {
    return Number(this.step1Form.getRawValue().testScholarshipPct ?? 0) || 0;
  }
  
  get scholarshipPct(): number {
    return Number(this.step1Form.value.scholarshipPct ?? 0) || 0;
  }
  
  get additionalScholarshipPct(): number {
    return Number(this.step1Form.value.additionalScholarshipPct ?? 0) || 0;
  }

  get totalDiscountPct(): number {
    const t =
      this.testScholarshipPct +
      this.scholarshipPct +
      this.additionalScholarshipPct;
    return Math.max(0, Math.min(100, t));
  }

  get finalFee(): number {
    return this.feeHeadPreview.reduce((s, r) => s + Number(r.total || 0), 0);
  }

  // (3) fee split preview for step1 (like image: show split rows)
  get feeSplitPreview(): Array<{
    label: string;
    amount: number;
    type: 'NEFT' | 'CHEQUE';
  }> {
    const plan = this.selectedPlan;
    if (!plan?.baseInstalments?.length) return [];

    const baseTotal = plan.baseInstalments.reduce(
      (s, x) => s + (Number(x) || 0),
      0
    );
    const scaled = this.scalePlan(
      plan.baseInstalments.map((x) => Number(x) || 0),
      this.finalFee,
      baseTotal
    );

    const neftAmt = (scaled[0] || 0) + (scaled[1] || 0);
    const rest = scaled.slice(2);

    const rows: Array<{
      label: string;
      amount: number;
      type: 'NEFT' | 'CHEQUE';
    }> = [];
    rows.push({ label: 'Advance (NEFT)', amount: neftAmt, type: 'NEFT' });

    rest.forEach((amt, idx) => {
      rows.push({ label: `Cheque ${idx + 1}`, amount: amt, type: 'CHEQUE' });
    });

    return rows;
  }

  generateAcknowledgementStep1(): void {
    if (this.step1Form.invalid) {
      this.step1Form.markAllAsTouched();
      this.alert.error(
        'Please fill all required student details and select fee plan.'
      );
      return;
    }
    this.alert.success(
      'Acknowledgement provision: Fee inputs verified (dummy).'
    );
  }

  next(): void {
    if (this.step1Form.invalid) {
      this.step1Form.markAllAsTouched();
      this.alert.error('Please correct the student details.');
      return;
    }
    this.resetWorkflowFlags();
    this.buildPaymentsFromFinalFee(this.finalFee);
    this.step = 2;
  }

  back(): void {
    this.step = 1;
  }

  // ---------- step2 arrays ----------
  get neftRefsFA(): UntypedFormArray {
    return this.step2Form.get('neftRefs') as UntypedFormArray;
  }
  get chequesFA(): UntypedFormArray {
    return this.step2Form.get('cheques') as UntypedFormArray;
  }

  get neftAmount(): number {
    return Number(this.step2Form.getRawValue().neftAmount ?? 0) || 0;
  }
  get neftTotalEntered(): number {
    return (this.neftRefsFA.value || []).reduce(
      (s: number, r: any) => s + (Number(r.amount) || 0),
      0
    );
  }

  get chequeCount(): number {
    return this.chequesFA.length;
  }
  get chequeTotal(): number {
    return (this.chequesFA.getRawValue() || []).reduce(
      (s: number, r: any) => s + (Number(r.amount) || 0),
      0
    );
  }

  addNeftRef(): void {
    this.neftRefsFA.push(
      this.fb.group({
        utrNo: [
          '',
          [
            Validators.required,
            Validators.minLength(6),
            Validators.maxLength(40),
          ],
        ],
        amount: [0, [Validators.required, Validators.min(1)]],
        paidOn: [null],
        remarks: [''],
      })
    );
  }

  removeNeftRef(i: number): void {
    if (this.neftRefsFA.length <= 1) return;
    this.neftRefsFA.removeAt(i);
  }

  // ---------- build payments ----------
  private buildPaymentsFromFinalFee(finalFee: number): void {
    const plan = this.selectedPlan;
    if (!plan?.baseInstalments?.length) {
      this.alert.error('No fee plan configured.');
      return;
    }

    const baseTotal = plan.baseInstalments.reduce(
      (s, x) => s + (Number(x) || 0),
      0
    );
    const scaled = this.scalePlan(
      plan.baseInstalments.map((x) => Number(x) || 0),
      finalFee,
      baseTotal
    );

    const neftAmt = (scaled[0] || 0) + (scaled[1] || 0);
    const chequeAmounts = scaled.slice(2);

    this.step2Form.get('neftAmount')?.setValue(neftAmt, { emitEvent: false });

    // NEFT refs (min 1)
    const neftFA = this.fb.array([]) as UntypedFormArray;
    neftFA.push(
      this.fb.group({
        utrNo: [
          '',
          [
            Validators.required,
            Validators.minLength(6),
            Validators.maxLength(40),
          ],
        ],
        amount: [0, [Validators.required, Validators.min(1)]],
        paidOn: [null],
        remarks: [''],
      })
    );
    this.step2Form.setControl('neftRefs', neftFA);

    // (4) Cheque table changes:
    // - chequeDate default (today) and not editable
    // - dueDate editable
    // - favourOf default = ZEDSWEVEN I PRIVATE LIMITED (readonly)
    // - add chequeNo column
    const today = this.todayISO();
    const chqFA = this.fb.array([]) as UntypedFormArray;

    for (let i = 0; i < chequeAmounts.length; i++) {
      const sno = i + 1;
      chqFA.push(
        this.fb.group({
          sno: [sno],
          chequeDate: [{ value: today, disabled: true }, [Validators.required]],
          favourOf: [
            { value: this.DEFAULT_FAVOUR_OF, disabled: true },
            [Validators.required],
          ],
          amount: [
            { value: chequeAmounts[i], disabled: true },
            [Validators.required, Validators.min(1)],
          ],
          chequeNo: [
            '',
            [
              Validators.required,
              Validators.minLength(4),
              Validators.maxLength(30),
            ],
          ],
          dueDate: [null, [Validators.required]],
          mode: ['PDC' as ChequeMode, [Validators.required]],
          remarks: [''],
        })
      );
    }
    this.step2Form.setControl('cheques', chqFA);
  }

  private todayISO(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private scalePlan(
    amounts: number[],
    targetTotal: number,
    baseTotal: number
  ): number[] {
    if (!baseTotal || targetTotal <= 0) return amounts.map(() => 0);

    const raw = amounts.map((a) => Math.floor((a / baseTotal) * targetTotal));
    let sum = raw.reduce((s, x) => s + x, 0);
    let diff = targetTotal - sum;

    let idx = raw.length - 1;
    while (diff !== 0 && idx >= 0) {
      raw[idx] = raw[idx] + 1;
      diff--;
      idx--;
      if (idx < 0) idx = raw.length - 1;
    }
    return raw;
  }

  // ---------- workflow ----------
  submitPayments(): void {
    if (this.step2Form.invalid) {
      this.step2Form.markAllAsTouched();
      this.alert.error('Please fill all required NEFT/cheque details.');
      return;
    }

    const entered = this.neftTotalEntered;
    if (entered <= 0) {
      this.alert.error('Please add at least one NEFT reference amount.');
      return;
    }
    if (entered > this.neftAmount) {
      this.alert.error(
        `NEFT total (₹${entered}) cannot exceed NEFT split (₹${this.neftAmount}).`
      );
      return;
    }

    this.submitting = true;
    setTimeout(() => {
      this.submitting = false;
      this.submittedForAck = true;
      this.alert.success(
        'Payment details submitted. Now generate fee calculation.'
      );
    }, 300);
  }

  generateFeeCalculation(): void {
    if (!this.submittedForAck) {
      this.alert.error('Please submit payment details first.');
      return;
    }
    if (this.step2Form.invalid) {
      this.step2Form.markAllAsTouched();
      this.alert.error(
        'Fill required NEFT/cheque details before generating fee calculation.'
      );
      return;
    }
    this.feeCalcGenerated = true;
    this.alert.success('Fee calculation generated (dummy).');
  }

  sendForApproval(): void {
    if (!this.feeCalcGenerated) {
      this.alert.error('Generate fee calculation first.');
      return;
    }
    this.approvalSent = true;
    this.alert.success('Sent for approval (dummy).');
  }

  confirmAdmission(): void {
    if (!this.submittedForAck) {
      this.alert.error('Please submit payment details first.');
      return;
    }
    if (this.step2Form.invalid) {
      this.step2Form.markAllAsTouched();
      this.alert.error('Please fill all required payment details.');
      return;
    }
    if (!this.feeCalcGenerated || !this.approvalSent) {
      this.alert.error(
        'Please generate fee calculation and send for approval before confirming.'
      );
      return;
    }

    const step1 = this.step1Form.getRawValue();

    const payload = {
      student: {
        portalStudentId: step1.portalStudentId,
        regNo: step1.regNo,
        name: step1.name,
        phone: step1.phone,
        parentName: step1.parentName,
        parentPhone: step1.parentPhone,
        email: step1.email,
      },
      program: {
        programName: step1.programName,
        centerName: step1.centerName,
      },
      fee: {
        feePlanId: step1.feePlanId,
        baseFee: step1.baseFee,
        testScholarshipPct: step1.testScholarshipPct,
        scholarshipPct: step1.scholarshipPct,
        additionalScholarshipPct: step1.additionalScholarshipPct,
        totalDiscountPct: this.totalDiscountPct,
        finalFee: this.finalFee,
      },
      payments: {
        neft: {
          splitAmount: this.neftAmount,
          refs: this.neftRefsFA.value,
          totalEntered: this.neftTotalEntered,
        },
        cheques: this.chequesFA.getRawValue(),
      },
      workflow: {
        feeCalcGenerated: this.feeCalcGenerated,
        approvalSent: this.approvalSent,
      },
    };

    console.log('ADMISSION PAYLOAD', payload);
    this.alert.success('Admission completed successfully (dummy).');
    this.router.navigate(['app/admissions/view/ADM-001']);
  }

  trackByIndex(i: number): number {
    return i;
  }

  get feeHeadPreview(): Array<{
    label: string;
    fee: number;
    stax: number;
    total: number;
    scholBenefits: number;
  }> {
    const plan = this.selectedPlan;
    const heads = plan?.feeHeads || [];
    const pct = this.totalDiscountPct; // your existing combined discount %
    if (!heads.length) return [];

    return heads.map((h) => {
      const fee = Number(h.fee || 0);
      const stax = Number(h.stax || 0);

      // default (no discount)
      let outFee = fee;
      let outStax = stax;
      let schol = 0;

      // ✅ Apply discount ONLY to Tuition Fee
      if (h.key === 'tuition' && pct > 0) {
        const rate = fee > 0 ? stax / fee : 0; // keep same tax ratio
        outFee = Math.round(fee * (1 - pct / 100));
        outStax = Math.round(outFee * rate);
        const beforeTotal = fee + stax;
        const afterTotal = outFee + outStax;
        schol = Math.max(0, beforeTotal - afterTotal);
      }

      return {
        label: h.label,
        fee: outFee,
        stax: outStax,
        total: outFee + outStax,
        scholBenefits: schol,
      };
    });
  }
}
