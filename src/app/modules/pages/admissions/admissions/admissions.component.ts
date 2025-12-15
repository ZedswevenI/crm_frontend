import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { Router } from '@angular/router';

type PayMode = 'NEFT' | 'PDC';

interface PortalStudentResult {
  portalStudentId: string;
  regNo: string;

  // editable fields (after fetch)
  name: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  email?: string;
  programName: string;
  centerName: string;

  scholarshipPct: number;
  baseFee: number;
}

interface FeePlanInst {
  no: number;
  amount: number;
}

@Component({
  selector: 'app-admissions',
  standalone: false,
  templateUrl: './admissions.component.html',
  styleUrl: './admissions.component.scss'
})
export class AdmissionsComponent implements OnInit {
  // ✅ Step 0 added
  step: 0 | 1 | 2 = 0;

  // dropdown: 0..100 step 5
  discountOptions = Array.from({ length: 21 }, (_, i) => i * 5);

  // Forms
  lookupForm!: FormGroup;
  step1Form!: FormGroup;
  step2Form!: FormGroup;

  submittedForAck = false;   // after Submit in step2
submitting = false;

  loading = false;

  // workflow flags
  ackGenerated = false;
  approvalSent = false;

  // fetched portal data (dummy now)
  portal: PortalStudentResult | null = null;

  // Base Plan amounts (from your acknowledgement)
  private basePlan16: FeePlanInst[] = [
    { no: 1, amount: 92866 },
    { no: 2, amount: 55720 },
    { no: 3, amount: 55720 },
    { no: 4, amount: 55720 },
    { no: 5, amount: 55720 },
    { no: 6, amount: 55720 },
  ];

  constructor(
    private fb: FormBuilder,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private router: Router
  ) {
    this.breadcrumb.set([{ label: 'Control Panel' }, { label: 'Admissions' }, { label: 'New Admission' }]);
  }

  ngOnInit(): void {
    this.lookupForm = this.fb.group({
      regNo: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(30)]]
    });
    this.step1Form = this.fb.group({
      portalStudentId: [''],
      regNo: [{ value: '', disabled: true }, Validators.required],
      name: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      parentName: ['', Validators.required],
      parentPhone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      email: ['', [Validators.email]],
      programName: ['', Validators.required],
      centerName: ['', Validators.required],
      baseFee: [{ value: 0, disabled: true }],
      scholarshipPct: [{ value: 0, disabled: true }],
      specialDiscountPct: [0, [Validators.min(0), Validators.max(100)]],
      siblingDiscountPct: [0, [Validators.min(0), Validators.max(100)]]
    });

    this.step2Form = this.fb.group({
      instalments: this.fb.array([] as any[])
    });
  }

  // ---------------- Step 0: fetch portal ----------------
  fetchByRegNo(): void {
    if (this.lookupForm.invalid) {
      this.lookupForm.markAllAsTouched();
      return;
    }

    const regNo = String(this.lookupForm.value.regNo || '').trim();
    this.loading = true;

    // TODO: replace with API call to external portal
    // Dummy response:
    setTimeout(() => {
      this.portal = {
        portalStudentId: 'PORTAL-1001',
        regNo,

        name: 'NIDHIN K',
        phone: '9000012345',
        parentName: 'KUMAR',
        parentPhone: '9000099999',
        email: 'student@email.com',
        programName: 'Aspire 4 Year Integrated School Program',
        centerName: 'Gandhipuram Center',

        scholarshipPct: 10,
        baseFee: 928660
      };

      // patch step1
      this.step1Form.reset({
        portalStudentId: this.portal.portalStudentId,
        regNo: this.portal.regNo,

        name: this.portal.name,
        phone: this.portal.phone,
        parentName: this.portal.parentName,
        parentPhone: this.portal.parentPhone,
        email: this.portal.email || '',
        programName: this.portal.programName,
        centerName: this.portal.centerName,

        baseFee: this.portal.baseFee,
        scholarshipPct: this.portal.scholarshipPct,

        specialDiscountPct: 0,
        siblingDiscountPct: 0
      });

      // ensure disabled values are set
      this.step1Form.get('regNo')?.disable();
      this.step1Form.get('baseFee')?.disable();
      this.step1Form.get('scholarshipPct')?.disable();

      this.step = 1;
      this.loading = false;
      this.alert.success('Scholarship result loaded.');
    }, 400);
  }

  // ---------------- Derived values ----------------
  private val(path: string): any {
    return this.step1Form.get(path)?.value;
  }

  get baseFee(): number {
    // baseFee is disabled, so use getRawValue
    return Number(this.step1Form.getRawValue().baseFee ?? 0) || 0;
  }

  get scholarshipPct(): number {
    return Number(this.step1Form.getRawValue().scholarshipPct ?? 0) || 0;
  }

  get specialDiscountPct(): number {
    return Number(this.val('specialDiscountPct') ?? 0) || 0;
  }

  get siblingDiscountPct(): number {
    return Number(this.val('siblingDiscountPct') ?? 0) || 0;
  }

  get totalDiscountPct(): number {
    const t = this.scholarshipPct + this.specialDiscountPct + this.siblingDiscountPct;
    return Math.max(0, Math.min(100, t));
  }

  get finalFee(): number {
    const final = Math.round(this.baseFee * (1 - this.totalDiscountPct / 100));
    return Math.max(0, final);
  }

  // ---------------- Step nav ----------------
  goToLookup(): void {
    this.step = 0;
    this.ackGenerated = false;
    this.approvalSent = false;
  }

next(): void {
  if (this.step1Form.invalid) {
    this.step1Form.markAllAsTouched();
    this.alert.error('Please correct the student details.');
    return;
  }

  this.ackGenerated = false;
  this.approvalSent = false;
  this.submittedForAck = false; // ✅ reset

  this.buildInstalmentsFromFinalFee(this.finalFee);
  this.step = 2;
}


  back(): void {
    this.step = 1;
  }

  // ---------------- Instalments ----------------
  get instalmentsFA(): FormArray {
    return this.step2Form.get('instalments') as FormArray;
  }

  get neftRows(): AbstractControl[] {
    return this.instalmentsFA.controls.filter(c => c.get('mode')?.value === 'NEFT');
  }

  get pdcRows(): AbstractControl[] {
    return this.instalmentsFA.controls.filter(c => c.get('mode')?.value === 'PDC');
  }

  private buildInstalmentsFromFinalFee(finalFee: number): void {
    const baseTotal = this.basePlan16.reduce((s, x) => s + x.amount, 0);
    const scaled = this.scalePlan(this.basePlan16.map(x => x.amount), finalFee, baseTotal);

    const fa = this.fb.array([] as any[]);

    for (let i = 0; i < scaled.length; i++) {
      const instNo = i + 1;
      const isAdvance = instNo === 1 || instNo === 2; // first 2 as NEFT
      const mode: PayMode = isAdvance ? 'NEFT' : 'PDC';

      fa.push(
        this.fb.group({
          instalmentNo: [instNo],
          amount: [scaled[i], [Validators.required, Validators.min(1)]],
          mode: [mode],

          // NEFT
          utrNo: [
            '',
            isAdvance ? [Validators.required, Validators.minLength(6), Validators.maxLength(40)] : []
          ],
          paidOn: [null],

          // PDC
          chequeNo: [
            '',
            !isAdvance ? [Validators.required, Validators.minLength(4), Validators.maxLength(20)] : []
          ],
          bank: ['', !isAdvance ? [Validators.required, Validators.maxLength(50)] : []],
          chequeDate: [null, !isAdvance ? [Validators.required] : []],

          remarks: ['']
        }) as any
      );
    }

    this.step2Form.setControl('instalments', fa as any);
  }

  private scalePlan(amounts: number[], targetTotal: number, baseTotal: number): number[] {
    if (!baseTotal || targetTotal <= 0) return amounts.map(() => 0);

    const raw = amounts.map(a => Math.floor((a / baseTotal) * targetTotal));
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

  // ---------------- Workflow buttons ----------------
  generateAcknowledgement(): void {
    if (!this.submittedForAck) {
    this.alert.error('Please submit payment details first.');
    return;
  }
    if (this.step2Form.invalid) {
      this.step2Form.markAllAsTouched();
      this.alert.error('Fill required NEFT/PDC details before generating acknowledgement.');
      return;
    }

    // TODO: call API -> generate acknowledgement pdf/html
    this.ackGenerated = true;
    this.alert.success('Acknowledgement generated (dummy).');
    
  }

  sendForApproval(): void {
    if (!this.ackGenerated) {
      this.alert.error('Generate acknowledgement first.');
      return;
    }

    // TODO: call API -> send for approval workflow
    this.approvalSent = true;
    this.alert.success('Sent for approval (dummy).');
  }

  // ---------------- Confirm ----------------
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

    if (!this.ackGenerated || !this.approvalSent) {
      this.alert.error('Please generate acknowledgement and send for approval before confirming.');
      return;
    }

    const step1 = this.step1Form.getRawValue(); // includes disabled fields

    const payload = {
      student: {
        portalStudentId: step1.portalStudentId,
        regNo: step1.regNo,
        name: step1.name,
        phone: step1.phone,
        parentName: step1.parentName,
        parentPhone: step1.parentPhone,
        email: step1.email
      },
      program: {
        programName: step1.programName,
        centerName: step1.centerName
      },
      fee: {
        baseFee: step1.baseFee,
        scholarshipPct: step1.scholarshipPct,
        specialDiscountPct: step1.specialDiscountPct,
        siblingDiscountPct: step1.siblingDiscountPct,
        totalDiscountPct: this.totalDiscountPct,
        finalFee: this.finalFee
      },
      schedule: this.instalmentsFA.value,
      workflow: {
        ackGenerated: this.ackGenerated,
        approvalSent: this.approvalSent
      }
    };

    console.log('ADMISSION PAYLOAD', payload);
    this.alert.success('Admission completed successfully (dummy).');
    this.router.navigate(['/app/admissions']);
  }

  trackByIndex(i: number): number {
    return i;
  }

  submitPayments(): void {
  if (this.step2Form.invalid) {
    this.step2Form.markAllAsTouched();
    this.alert.error('Please fill all required NEFT/PDC details.');
    return;
  }

  // TODO: call API save payments as draft
  this.submitting = true;
  setTimeout(() => {
    this.submitting = false;
    this.submittedForAck = true;
    this.alert.success('Payment details submitted. Now generate acknowledgement.');
  }, 300);
}

}