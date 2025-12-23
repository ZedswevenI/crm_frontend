import { Component, OnInit } from '@angular/core';
import {
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { Router } from '@angular/router';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

type ChequeMode = 'PDC' | 'CDC';

interface PortalStudentResult {
  portalStudentId?: string;
  regNo?: string;
  registrationNumber?: string;

  name?: string;
  phone?: string;

  parentName?: string;
  parentPhone?: string;

  email?: string;

  programName?: string;
  programCode?: string;

  centerName?: string; // may not come
  centerCode?: string; // comes
  studyCentre?: string; // comes

  testScholarshipPct?: number; // waiverPerInTf

  scholarshipTestId?: string;
  academicYear?: string; // ✅ new
}

interface ProgramItem {
  programId: string;
  programName: string;
  programCode?: string;
  centerId?: string;
  centerName?: string;
}

interface FeePlan {
  id: string;
  name: string;
  feePlanCode?: string;

  // instalments coming from backend: feePlan.instalments[]
  instalments: Array<{
    seq: number;
    label: string;
    amount: number;
  }>;

  // fee heads from backend: feePlan.feeHeads[]
  feeHeads: Array<{
    key: string;
    label: string;
    fee: number; // base amount
    stax: number; // GST amount
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

  // fetched portal data
  portal: PortalStudentResult | null = null;

  // loaded from backend
  programs: ProgramItem[] = [];
  feePlans: FeePlan[] = [];
  programsLoading = false;
  feePlansLoading = false;

  // admission state
  admissionId: string | null = null;

  // ✅ favour of fixed as requested
  readonly DEFAULT_FAVOUR_OF = 'ZEDSWEVEN I PRIVATE LIMITED';

  constructor(
    private fb: UntypedFormBuilder,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private router: Router,
    private api: CommonapiService
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Admissions' },
      { label: 'New Admission' },
    ]);
  }

  ngOnInit(): void {
    // Step 0
    this.lookupForm = this.fb.group({
      regNo: [''],
      directEnrolment: [false],
    });

    // Step 1
    this.step1Form = this.fb.group({
      academicYear: [''],
      portalStudentId: [''],
      scholarshipTestId: [''],

      regNo: [{ value: '', disabled: true }],

      name: ['', Validators.required],

      // ✅ single mobile field (used for parentPhone internally)
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],

      parentName: ['', Validators.required],

      // ✅ keep parentPhone for backend payload but do NOT show in UI
      parentPhone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],

      email: ['', [Validators.email]],

      programId: ['', Validators.required],
      programName: ['', Validators.required],
      programCode: [''],

      centerId: [''],
      centerName: ['', Validators.required],
      centerCode: [''],
      studyCentre: [''],

      feePlanId: ['', Validators.required],
      feePlanCode: [''],

      baseFee: [{ value: 0, disabled: true }],

      testScholarshipPct: [{ value: 0, disabled: true }],
      scholarshipPct: [0, [Validators.min(0), Validators.max(100)]],
      additionalScholarshipPct: [0, [Validators.min(0), Validators.max(100)]],
    });

    // ✅ Sync parentPhone = phone always
    this.step1Form.get('phone')?.valueChanges.subscribe((v) => {
      const phone = String(v || '').trim();
      const cur = String(this.step1Form.get('parentPhone')?.value || '').trim();
      if (phone && phone !== cur) {
        this.step1Form
          .get('parentPhone')
          ?.setValue(phone, { emitEvent: false });
      }
    });

    // Step 2
    this.step2Form = this.fb.group({
      neftAmount: [{ value: 0, disabled: true }],
      neftRefs: this.fb.array([]),
      cheques: this.fb.array([]),
    });

    this.loadPrograms();

    this.step1Form.get('programId')?.valueChanges.subscribe((pid) => {
      this.onProgramChanged(String(pid || '').trim());
    });

    this.step1Form.get('academicYear')?.valueChanges.subscribe(() => {
      this.loadFeePlans();
      this.resetWorkflowFlags();
    });

    this.step1Form.get('feePlanId')?.valueChanges.subscribe((id) => {
      this.onFeePlanChanged(String(id || '').trim());
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

    this.buildEmptyPayments();
  }

  private pickTenantId(): string {
    const entiId =
      (localStorage.getItem('entiId') || '').trim() ||
      (localStorage.getItem('tenantId') || '').trim();
    return entiId;
  }

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

  trackByIndex(i: number): number {
    return i;
  }

  private todayISO(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // ---------------------- Masters loading ----------------------

  private loadPrograms(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }

    this.programsLoading = true;
    const body: any = { entiId: tenantId };

    this.api.fetchData(body, 'ims/program', 'list?list=full').subscribe({
      next: (res: any) => {
        this.programsLoading = false;
        if (!res?.status) {
          this.alert.error(
            res?.message || res?.error || 'Failed to load programs'
          );
          this.programs = [];
          return;
        }

        const arr = Array.isArray(res?.data) ? res.data : [];
        this.programs = arr
          .map((x: any) => ({
            programId: String(x.programId || x._id || ''),
            programName: String(x.programName || x.name || ''),
            programCode: x.programCode ? String(x.programCode) : '',
            centerId: x.centerId ? String(x.centerId) : '',
            centerName: x.centerName ? String(x.centerName) : '',
          }))
          .filter((p: ProgramItem) => !!p.programId && !!p.programName);

        // ✅ if portal already fetched, map programId now
        this.tryMapProgramFromPortal();
      },
      error: () => {
        this.programsLoading = false;
        this.programs = [];
        this.alert.error('Failed to load programs');
      },
    });
  }

  private tryMapProgramFromPortal(): void {
    if (!this.portal) return;

    const code = String(this.portal.programCode || '').trim();
    if (!code) return;

    const match =
      this.programs.find((p) => String(p.programCode || '').trim() === code) ||
      null;

    // ✅ If program from portal is not created, hard-stop with alert and send back to step 0
    if (!match) {
      this.alert.error(
        'Program is not created. Please create the program and retry.'
      );

      this.step1Form.patchValue(
        {
          programId: '',
          programName: '',
          programCode: this.portal.programCode || '',
          centerId: '',
          centerName: '',
        },
        { emitEvent: false }
      );

      this.step = 0;
      return;
    }

    // patch programId -> triggers onProgramChanged -> loadFeePlans
    this.step1Form.patchValue(
      {
        programId: match.programId,
      },
      { emitEvent: true }
    );

    // also patch center/program info from program master (more reliable)
    this.step1Form.patchValue(
      {
        programName:
          match.programName || this.step1Form.value.programName || '',
        programCode:
          match.programCode || this.step1Form.value.programCode || '',
        centerId: match.centerId || '',
        centerName:
          String(match.centerName || '').trim() ||
          String(this.portal.studyCentre || '').trim() ||
          String(this.portal.centerCode || '').trim() ||
          String(this.step1Form.value.centerName || '').trim() ||
          '',
      },
      { emitEvent: false }
    );
  }

  private loadFeePlans(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }

    const programId = String(
      this.step1Form.get('programId')?.value || ''
    ).trim();
    const programCode = String(
      this.step1Form.get('programCode')?.value || ''
    ).trim();

    // ✅ ONLY require programId OR programCode
    if (!programId && !programCode) {
      this.feePlans = [];
      this.step1Form.patchValue(
        { feePlanId: '', feePlanCode: '' },
        { emitEvent: false }
      );
      this.step1Form.get('baseFee')?.setValue(0, { emitEvent: false });
      return;
    }

    this.feePlansLoading = true;

    const body: any = { entiId: tenantId };

    // ✅ backend expects query params, we send only programId/programCode
    let route = `list?list=full`;
    if (programId) route += `&programId=${encodeURIComponent(programId)}`;
    else route += `&programCode=${encodeURIComponent(programCode)}`;

    this.api.fetchData(body, 'ims/feeplan', route).subscribe({
      next: (res: any) => {
        this.feePlansLoading = false;

        if (!res?.status) {
          this.alert.error(
            res?.message || res?.error || 'Failed to load fee plans'
          );
          this.feePlans = [];
          return;
        }

        const arr = Array.isArray(res?.data) ? res.data : [];
        this.feePlans = arr
          .map((x: any) => ({
            id: String(x.feePlanId || x.id || x._id || '').trim(),
            name: String(
              x.feePlanName || x.feePlanCode || x.name || 'Fee Plan'
            ).trim(),
            feePlanCode: x.feePlanCode ? String(x.feePlanCode).trim() : '',

            // ✅ map instalments correctly from backend
            instalments: Array.isArray(x.instalments)
              ? x.instalments.map((i: any) => ({
                  seq: Number(i.seq || 0) || 0,
                  label: String(i.label || `Instalment ${i.seq || ''}`).trim(),
                  amount: Number(i.amount || 0) || 0,
                }))
              : [],

            // ✅ map fee heads: amount + gstAmount
            feeHeads: Array.isArray(x.feeHeads)
              ? x.feeHeads.map((h: any) => ({
                  key: String(h.key || h.feeHeadKey || '').trim(),
                  label: String(h.label || h.feeHeadName || '').trim(),
                  fee: Number(h.amount || 0), // base
                  stax: Number(h.gstAmount || 0), // GST
                }))
              : [],
          }))
          .filter((fp: FeePlan) => !!fp.id);

        // auto pick first if nothing selected
        const cur = String(this.step1Form.get('feePlanId')?.value || '').trim();
        const exists = !!this.feePlans.find((p) => p.id === cur);

        if (cur && !exists) {
          this.step1Form.patchValue(
            { feePlanId: '', feePlanCode: '' },
            { emitEvent: false }
          );
          this.step1Form.get('baseFee')?.setValue(0, { emitEvent: false });
        }

        const newCur = String(
          this.step1Form.get('feePlanId')?.value || ''
        ).trim();
        if (!newCur && this.feePlans.length) {
          this.step1Form.patchValue(
            { feePlanId: this.feePlans[0].id },
            { emitEvent: true }
          );
        } else {
          this.onFeePlanChanged(newCur);
        }
      },
      error: () => {
        this.feePlansLoading = false;
        this.feePlans = [];
        this.alert.error('Failed to load fee plans');
      },
    });
  }

  public onProgramCodeChanged(programCode: any): void {
    const code = String(programCode || '').trim();
    if (!code) {
      this.feePlans = [];
      this.step1Form.patchValue(
        { feePlanId: '', feePlanCode: '' },
        { emitEvent: false }
      );
      this.step1Form.get('baseFee')?.setValue(0, { emitEvent: false });
      return;
    }

    const p =
      this.programs.find((x) => String(x.programCode || '').trim() === code) ||
      null;

    if (p) {
      this.step1Form.patchValue(
        {
          programId: p.programId,
          programName: p.programName,
          centerName:
            p.centerName || this.step1Form.get('centerName')?.value || '',
        },
        { emitEvent: false }
      );
    }

    this.step1Form.patchValue(
      { feePlanId: '', feePlanCode: '' },
      { emitEvent: false }
    );
    this.step1Form.get('baseFee')?.setValue(0, { emitEvent: false });

    // ✅ Call feeplans even if programId isn't found (fallback to programCode)
    this.loadFeePlans();
    this.resetWorkflowFlags();
  }

  public onProgramChanged(programId: any): void {
    const pid = String(programId || '').trim();
    const p = this.programs.find((x) => x.programId === pid) || null;

    this.step1Form.patchValue(
      {
        programName: p?.programName || '',
        programCode:
          p?.programCode || this.step1Form.get('programCode')?.value || '',
        centerName:
          p?.centerName || this.step1Form.get('centerName')?.value || '',
        feePlanId: '',
        feePlanCode: '',
      },
      { emitEvent: false }
    );

    this.step1Form.get('baseFee')?.setValue(0, { emitEvent: false });

    // ✅ Always refresh fee plans
    this.loadFeePlans();
    this.resetWorkflowFlags();
  }

  private onFeePlanChanged(feePlanId: string): void {
    const fp = this.feePlans.find((x) => x.id === feePlanId) || null;
    this.step1Form.patchValue(
      { feePlanCode: fp?.feePlanCode || '' },
      { emitEvent: false }
    );

    const total =
      fp?.feeHeads?.reduce(
        (s, x) => s + (Number(x.fee || 0) + Number(x.stax || 0)),
        0
      ) || 0;

    this.step1Form.get('baseFee')?.setValue(total, { emitEvent: false });
  }

  // ---------------------- Step 0 ----------------------

  proceedDirectEnrolment(): void {
    this.isDirectEnrolment = true;
    this.lookupForm.patchValue({ directEnrolment: true }, { emitEvent: false });

    this.portal = null;
    this.admissionId = null;
    this.step1Form.reset();

    this.step1Form.patchValue({
      portalStudentId: '',
      scholarshipTestId: '',
      regNo: '',
      testScholarshipPct: 0,
      scholarshipPct: 0,
      additionalScholarshipPct: 0,
      phone: '',
      parentPhone: '',
      programId: '',
      programName: '',
      programCode: '',
      centerId: '',
      centerName: '',
      centerCode: '',
      studyCentre: '',
      feePlanId: '',
      feePlanCode: '',
      academicYear: '',
    });

    this.setRegNoLock(false);
    this.setTestScholarshipLock(false);

    this.feePlans = [];
    this.resetWorkflowFlags();
    this.buildEmptyPayments();

    this.step = 1;
  }

  fetchByRegNo(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }

    const regNo = String(this.lookupForm.value.regNo || '').trim();
    if (!regNo) {
      this.alert.error(
        'Please enter Enrolment / Reg No. Or use Direct Enrolment.'
      );
      return;
    }

    this.loading = true;

    const body: any = {
      entiId: tenantId,
      registrationNumber: regNo,
    };

    this.api.fetchData(body, 'admi', 'portal/fetch').subscribe({
      next: (res: any) => {
        this.loading = false;
        if (!res?.status) {
          this.alert.error(res?.message || res?.error || 'Fetch failed');
          return;
        }

        const d = res?.data || {};

        // portal payload has only one mobile: mobileNo
        const phone = String(d.mobileNo || d.phone || d.mobile || '').trim();
        const parentName = String(
          d.fatherName || d.parentName || d.guardianName || ''
        ).trim();
        const academicYear = String(
          d.academicYear || d.academic_year || ''
        ).trim();

        const portal: PortalStudentResult = {
          portalStudentId:
            d.portalStudentId || d.portalStudentID || d.studentId || '',
          scholarshipTestId: d.testId || d.scholarshipTestId || d._id || '',

          regNo: d.regNo || d.registrationNumber || regNo,
          registrationNumber: d.registrationNumber || regNo,

          name:
            d.name ||
            d.studentName ||
            `${d.firstName || ''} ${d.lastName || ''}`.trim(),
          phone: phone,

          parentName: parentName,
          parentPhone: String(
            d.parentPhone || d.parentMobile || phone || ''
          ).trim(),

          email: d.email || '',

          programName: d.programName || '',
          programCode: d.programCode || '',

          centerName: d.centerName || '',
          centerCode: d.centerCode || '',
          studyCentre: d.studyCentre || '',

          testScholarshipPct:
            Number(
              d.waiverPerInTf ?? d.testScholarshipPct ?? d.testScholarship ?? 0
            ) || 0,

          academicYear: academicYear || '',
        };

        this.portal = portal;
        this.isDirectEnrolment = false;
        this.admissionId = null;

        this.step1Form.reset();
        this.step1Form.patchValue(
          {
            portalStudentId: portal.portalStudentId || '',
            scholarshipTestId: portal.scholarshipTestId || '',
            regNo: portal.regNo || regNo,

            name: portal.name || '',
            phone: portal.phone || '',
            parentName: portal.parentName || '',
            parentPhone: portal.parentPhone || portal.phone || '',
            email: portal.email || '',

            programName: portal.programName || '',
            programCode: portal.programCode || '',
            centerName: portal.centerName || portal.studyCentre || '',
            centerCode: portal.centerCode || '',
            studyCentre: portal.studyCentre || '',

            academicYear: portal.academicYear || '',

            testScholarshipPct: portal.testScholarshipPct || 0,
            scholarshipPct: 0,
            additionalScholarshipPct: 0,

            // reset fee plan selection (will be loaded after mapping programId)
            feePlanId: '',
            feePlanCode: '',
            baseFee: 0,
          },
          { emitEvent: false }
        );

        // lock portal-only fields
        this.setRegNoLock(true);
        this.setTestScholarshipLock(true);

        // ✅ map programId from portal programCode
        this.tryMapProgramFromPortal();

        this.step = 1;
        this.resetWorkflowFlags();
        this.buildEmptyPayments();

        this.alert.success('Fetched student details.');
      },
      error: (err) => {
        console.log(err);
        this.loading = false;
        this.alert.error(`${err.error.message}`);
      },
    });
  }

  goToLookup(): void {
    this.step = 0;
    this.resetWorkflowFlags();
  }

  // ---------------------- Fee previews ----------------------

  get selectedPlan(): FeePlan | null {
    const id = String(this.step1Form.get('feePlanId')?.value || '').trim();
    return this.feePlans.find((p) => p.id === id) || null;
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
    const pct = this.totalDiscountPct;

    if (!heads.length) return [];

    return heads.map((h) => {
      const fee = Number(h.fee || 0);
      const stax = Number(h.stax || 0);

      let outFee = fee;
      let outStax = stax;
      let schol = 0;

      const key = String(h.key || '')
        .trim()
        .toLowerCase();
      const isTuition =
        key === 'tuition' ||
        key === 'tuitionfee' ||
        key === 'tuition_fee' ||
        String(h.label || '')
          .toLowerCase()
          .includes('tuition');

      if (isTuition && pct > 0) {
        // Keep same tax ratio
        const rate = fee > 0 ? stax / fee : 0;
        outFee = Math.round(fee * (1 - pct / 100));
        outStax = Math.round(outFee * rate);

        schol = Math.max(0, fee + stax - (outFee + outStax));
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

  get finalFee(): number {
    return this.feeHeadPreview.reduce((s, r) => s + Number(r.total || 0), 0);
  }

  get feeSplitPreview(): Array<{
    label: string;
    amount: number;
    type: 'NEFT' | 'CHEQUE';
  }> {
    const plan = this.selectedPlan;
    const instals = plan?.instalments || [];
    if (!instals.length) return [];

    // base instalment amounts from backend
    const baseAmounts = instals.map((i) => Number(i.amount) || 0);
    const baseTotal = baseAmounts.reduce(
      (s: number, x: number) => s + (Number(x) || 0),
      0
    );

    const scaled = this.scalePlan(baseAmounts, this.finalFee, baseTotal);

    const rows: Array<{
      label: string;
      amount: number;
      type: 'NEFT' | 'CHEQUE';
    }> = [];

    // 1st instalment → NEFT
    if (scaled.length) {
      rows.push({
        label: instals[0]?.label || 'Advance (NEFT)',
        amount: scaled[0] || 0,
        type: 'NEFT',
      });
    }

    // Remaining instalments → Cheques
    for (let i = 1; i < scaled.length; i++) {
      rows.push({
        label: instals[i]?.label || `Cheque ${i}`,
        amount: scaled[i] || 0,
        type: 'CHEQUE',
      });
    }

    return rows;
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
    while (diff > 0 && raw.length) {
      raw[idx] = raw[idx] + 1;
      diff--;
      idx--;
      if (idx < 0) idx = raw.length - 1;
    }
    return raw;
  }

  // ---------------------- Step 1 actions ----------------------

  generateAcknowledgementStep2(): void {
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
    this.alert.success('Fee calculation generated (stub).');
    this.printPaymentsAck();
  }

  next(): void {
    this.step1Form.markAllAsTouched();

    if (this.step1Form.invalid) {
      this.logInvalidStep1Controls();
      this.alert.error(
        'Some required fields are missing/invalid. Check console for details.'
      );
      return;
    }
    // ensure phone -> parentPhone sync before validation
    const phone = String(this.step1Form.get('phone')?.value || '').trim();
    if (phone) {
      this.step1Form.get('parentPhone')?.setValue(phone, { emitEvent: false });
    }

    if (this.step1Form.invalid) {
      this.step1Form.markAllAsTouched();
      this.alert.error('Please correct the student details.');
      return;
    }

    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }

    const plan = this.selectedPlan;
    if (!plan) {
      this.alert.error('Please select a valid fee plan.');
      return;
    }

    this.submitting = true;

    const s1 = this.step1Form.getRawValue();
    const sourceType = s1.portalStudentId ? 'PORTAL' : 'DIRECT';

    const body: any = {
      entiId: tenantId,

      // ✅ no hard-coded default academic year
      academicYear: String(s1.academicYear || '').trim() || null,
      sourceType,

      feePlanId: String(s1.feePlanId || '').trim(),
      feePlanCode: s1.feePlanCode || plan.feePlanCode || '',

      centerName: String(s1.centerName || '').trim(),
      centerId: s1.centerId || '',
      centerCode: String(s1.centerCode || '').trim() || null,
      studyCentre: String(s1.studyCentre || '').trim() || null,

      programName: String(s1.programName || '').trim(),
      programId: s1.programId || '',
      programCode: s1.programCode || '',

      registrationNumber: String(s1.regNo || '').trim() || null,
      portalStudentId: s1.portalStudentId || null,
      scholarshipTestId: s1.scholarshipTestId || null,

      student: {
        name: String(s1.name || '').trim(),
        phone: String(s1.phone || '').trim(),
        parentName: String(s1.parentName || '').trim(),
        parentPhone: String(s1.parentPhone || s1.phone || '').trim(),
        email: String(s1.email || '').trim() || null,
      },

      fee: {
        baseFee: Number(s1.baseFee || 0),
        finalFee: Number(this.finalFee || 0),
        testScholarshipPct: Number(this.testScholarshipPct || 0),
        scholarshipPct: Number(this.scholarshipPct || 0),
        additionalScholarshipPct: Number(this.additionalScholarshipPct || 0),
        totalDiscountPct: Number(this.totalDiscountPct || 0),
        breakup: this.feeHeadPreview.map((x) => ({
          label: x.label,
          total: x.total,
          scholBenefits: x.scholBenefits,
        })),
      },
    };

    this.api.fetchData(body, 'admi', 'create').subscribe({
      next: (res: any) => {
        this.submitting = false;
        if (!res?.status) {
          this.alert.error(
            res?.message || res?.error || 'Failed to create admission draft'
          );
          return;
        }

        const adm = res?.data || {};
        this.admissionId =
          String(adm.admissionId || adm._id || '').trim() || null;

        if (!this.admissionId) {
          this.alert.error('Draft created but admissionId not returned.');
          return;
        }

        this.resetWorkflowFlags();
        this.buildPaymentsFromFinalFee(this.finalFee);
        this.step = 2;
        this.alert.success('Admission draft created. Proceed to payments.');
      },
      error: () => {
        this.submitting = false;
        this.alert.error('Failed to create admission draft');
      },
    });
  }

  back(): void {
    this.step = 1;
  }

  // ---------------------- Step 2 payments ----------------------

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
        utr: [
          '',
          [
            Validators.required,
            Validators.minLength(6),
            Validators.maxLength(40),
          ],
        ],
        amount: [0, [Validators.required, Validators.min(1)]],
        paidOn: [null],
        bankName: [''],
        referenceNote: [''],
        remarks: [''],
      })
    );
  }

  removeNeftRef(i: number): void {
    if (this.neftRefsFA.length <= 1) return;
    this.neftRefsFA.removeAt(i);
  }

  private buildEmptyPayments(): void {
    this.step2Form.get('neftAmount')?.setValue(0, { emitEvent: false });
    this.step2Form.setControl('neftRefs', this.fb.array([]));
    this.step2Form.setControl('cheques', this.fb.array([]));
  }

  private buildPaymentsFromFinalFee(finalFee: number): void {
    const plan = this.selectedPlan;

    // ✅ get base instalment amounts from backend instalments
    const baseAmounts = (plan?.instalments || []).map(
      (i) => Number(i.amount) || 0
    );

    if (!baseAmounts.length) {
      this.alert.error('Selected fee plan has no instalment structure.');
      this.buildEmptyPayments();
      return;
    }

    const baseTotal = baseAmounts.reduce(
      (s: number, x: number) => s + (Number(x) || 0),
      0
    );
    const scaled = this.scalePlan(baseAmounts, finalFee, baseTotal);

    // ✅ your requirement: 1 NEFT + remaining as PDC
    const neftAmt = scaled[0] || 0;
    const chequeAmounts = scaled.slice(1); // 2nd..nth instalments

    // Set NEFT split
    this.step2Form.get('neftAmount')?.setValue(neftAmt, { emitEvent: false });

    // NEFT refs (1 row by default, user can add more)
    const neftFA = this.fb.array([]) as UntypedFormArray;
    neftFA.push(
      this.fb.group({
        utr: [
          '',
          [
            Validators.required,
            Validators.minLength(6),
            Validators.maxLength(40),
          ],
        ],
        amount: [neftAmt, [Validators.required, Validators.min(1)]],
        paidOn: [null],
        bankName: [''],
        referenceNote: [''],
        remarks: [''],
      })
    );
    this.step2Form.setControl('neftRefs', neftFA);

    // Cheque rows (PDC/CDC) – one per remaining instalment
    const today = this.todayISO();
    const chqFA = this.fb.array([]) as UntypedFormArray;

    chequeAmounts.forEach((amt, idx) => {
      const sno = idx + 1;
      chqFA.push(
        this.fb.group({
          sno: [sno],
          chequeDate: [{ value: today, disabled: true }, [Validators.required]],
          favourOf: [
            { value: this.DEFAULT_FAVOUR_OF, disabled: true },
            [Validators.required],
          ],
          amount: [
            { value: amt, disabled: true },
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
          bankName: [''],
          remarks: [''],
        })
      );
    });

    this.step2Form.setControl('cheques', chqFA);
  }

  submitPayments(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }
    if (!this.admissionId) {
      this.alert.error(
        'Admission draft not created. Go back and proceed again.'
      );
      return;
    }

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

    // ✅ Ensure NEFT + cheques total equals final fee
    const totalPaid = entered + this.chequeTotal;
    const totalDue = Math.round(this.finalFee || 0);
    if (totalDue > 0 && Math.round(totalPaid) !== totalDue) {
      this.alert.error(
        `Total of NEFT and cheques (₹${totalPaid}) must match final fee (₹${totalDue}).`
      );
      return;
    }

    const neftRefs = (this.neftRefsFA.value || [])
      .map((r: any) => ({
        utr: String(r.utr || '').trim(),
        amount: Number(r.amount || 0),
        paidOn: r.paidOn || null,
        bankName: String(r.bankName || '').trim() || null,
        referenceNote: String(r.referenceNote || '').trim() || null,
        remarks: String(r.remarks || '').trim() || null,
      }))
      .filter((x: any) => !!x.utr && x.amount > 0);

    const cheques = (this.chequesFA.getRawValue() || [])
      .map((r: any) => ({
        sno: Number(r.sno || 0) || 0,
        chequeNo: String(r.chequeNo || '').trim(),
        chequeDate: r.chequeDate || this.todayISO(),
        dueDate: r.dueDate || null,
        favourOf: String(this.DEFAULT_FAVOUR_OF || '').trim(),
        mode: (r.mode === 'CDC' ? 'CDC' : 'PDC') as ChequeMode,
        bankName: String(r.bankName || '').trim() || null,
        amount: Number(r.amount || 0),
        remarks: String(r.remarks || '').trim() || null,
      }))
      .filter(
        (x: any) =>
          !!x.chequeNo &&
          !!x.dueDate &&
          !!x.favourOf &&
          (x.mode === 'PDC' || x.mode === 'CDC') &&
          x.amount > 0
      );

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
            res?.message || res?.error || 'Failed to save payments'
          );
          return;
        }
        this.submittedForAck = true;
        this.alert.success('Payment details saved.');
      },
      error: () => {
        this.submitting = false;
        this.alert.error('Failed to save payments');
      },
    });
  }

  sendForApproval(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }
    if (!this.admissionId) {
      this.alert.error('Admission not available.');
      return;
    }
    if (!this.submittedForAck) {
      this.alert.error('Submit payments first.');
      return;
    }
    if (!this.feeCalcGenerated) {
      this.alert.error('Generate fee calculation first.');
      return;
    }

    this.submitting = true;
    const body: any = { entiId: tenantId, admissionId: this.admissionId };

    this.api.fetchData(body, 'admi', 'submit-approval').subscribe({
      next: (res: any) => {
        this.submitting = false;
        if (!res?.status) {
          this.alert.error(
            res?.message || res?.error || 'Failed to send for approval'
          );
          return;
        }
        this.approvalSent = true;
        this.alert.success('Sent for approval.');
      },
      error: () => {
        this.submitting = false;
        this.alert.error('Failed to send for approval');
      },
    });
  }

  confirmAdmission(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }
    if (!this.admissionId) {
      this.alert.error('Admission not available.');
      return;
    }

    if (!this.submittedForAck) {
      this.alert.error('Submit payments first.');
      return;
    }
    if (!this.feeCalcGenerated || !this.approvalSent) {
      this.alert.error(
        'Generate fee calculation and send for approval before confirming.'
      );
      return;
    }

    this.submitting = true;
    const body: any = { entiId: tenantId, admissionId: this.admissionId };

    this.api.fetchData(body, 'admi', 'approve').subscribe({
      next: (res: any) => {
        this.submitting = false;
        if (!res?.status) {
          this.alert.error(
            res?.message || res?.error || 'Failed to confirm admission'
          );
          return;
        }
        this.alert.success('Admission confirmed.');
        this.router.navigate(['app/admissions/view', this.admissionId]);
      },
      error: () => {
        this.submitting = false;
        this.alert.error('Failed to confirm admission');
      },
    });
  }

  get testScholarshipPct(): number {
    // IMPORTANT: uses getRawValue so it works even if control is disabled
    const v = Number(this.step1Form.getRawValue().testScholarshipPct ?? 0);
    return Number.isFinite(v) ? v : 0;
  }

  get scholarshipPct(): number {
    const v = Number(this.step1Form.get('scholarshipPct')?.value ?? 0);
    return Number.isFinite(v) ? v : 0;
  }

  get additionalScholarshipPct(): number {
    const v = Number(
      this.step1Form.get('additionalScholarshipPct')?.value ?? 0
    );
    return Number.isFinite(v) ? v : 0;
  }

  get totalDiscountPct(): number {
    const t =
      this.testScholarshipPct +
      this.scholarshipPct +
      this.additionalScholarshipPct;
    return Math.max(0, Math.min(100, t));
  }

  private logInvalidStep1Controls(): void {
    const fg = this.step1Form;
    const invalid: Array<{
      key: string;
      errors: any;
      value: any;
      disabled: boolean;
    }> = [];

    Object.keys(fg.controls).forEach((key) => {
      const c = fg.get(key);
      if (!c) return;
      if (c.invalid) {
        invalid.push({
          key,
          errors: c.errors,
          value: c instanceof Object ? (c as any).value : null,
          disabled: c.disabled,
        });
      }
    });

    console.log('STEP1 INVALID CONTROLS =>', invalid);
  }

  /** Simple HTML escape */
  private esc(v: any): string {
    const s = String(v ?? '');
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return s.replace(/[&<>"']/g, (c) => map[c] || c);
  }

  /** Generic print window with basic styles */
  private openPrintWindow(title: string, bodyHtml: string): void {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      this.alert.error('Popup blocked. Please allow popups to print.');
      return;
    }

    const fullHtml = `<!doctype html>
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
    .subtitle {
      font-size: 11px;
      margin-top: 2px;
    }
    .meta {
      text-align: right;
      font-size: 10px;
    }
    .section {
      margin-top: 10px;
    }
    .section-title {
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 2px;
      margin-bottom: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 3px 4px;
      vertical-align: top;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .small { font-size: 10px; }
    .tiny { font-size: 9px; }
    .mt-1 { margin-top: 4px; }
    .mt-2 { margin-top: 8px; }
    .mt-3 { margin-top: 12px; }
    .note-list {
      margin: 4px 0 0 16px;
      padding: 0;
      font-size: 10px;
    }
    .note-list li { margin-bottom: 2px; }
    .kv-grid {
      display: grid;
      grid-template-columns: 32% 68%;
      border: 1px solid #e5e7eb;
      border-collapse: collapse;
    }
    .kv-grid > div {
      border-bottom: 1px solid #e5e7eb;
      border-right: 1px solid #e5e7eb;
      padding: 3px 4px;
    }
    .kv-grid > div:nth-child(2n) {
      border-right: none;
    }
    .kv-label {
      background: #f9fafb;
      font-weight: 600;
      font-size: 10px;
    }
  </style>
</head>
<body onload="window.print();">
  ${bodyHtml}
</body>
</html>`;

    win.document.open();
    win.document.write(fullHtml);
    win.document.close();
  }

  /** Build Fee Calculation Sheet for STEP 1 (using form + preview data) */
  private buildFeeCalcHtmlStep1(): string {
    const s1 = this.step1Form.getRawValue();
    const plan = this.selectedPlan;
    const today = new Date();

    if (this.step1Form.invalid || !plan) {
      return '<p>Step 1 details are incomplete. Please fill all required fields and select a fee plan.</p>';
    }

    const heads = this.feeHeadPreview;
    const baseFee = Number(s1.baseFee || 0);
    const finalFee = this.finalFee || 0;
    const testSch = this.testScholarshipPct;
    const schl = this.scholarshipPct;
    const addSchl = this.additionalScholarshipPct;
    const totalDisc = this.totalDiscountPct;

    const scholTotal = heads.reduce(
      (s, r) => s + Number(r.scholBenefits || 0),
      0
    );

    const feeRows = heads
      .map(
        (r) => `
      <tr>
        <td>${this.esc(r.label)}</td>
        <td class="text-right">${Number(r.fee || 0).toLocaleString(
          'en-IN'
        )}</td>
        <td class="text-right">${Number(r.stax || 0).toLocaleString(
          'en-IN'
        )}</td>
        <td class="text-right">${Number(r.total || 0).toLocaleString(
          'en-IN'
        )}</td>
        <td class="text-right">${Number(r.scholBenefits || 0).toLocaleString(
          'en-IN'
        )}</td>
      </tr>`
      )
      .join('');

    return `
      <div class="page">
        <div class="header-row">
          <div>
            <div class="title-main">FEE CALCULATION SHEET</div>
            <div class="subtitle">Current Status : Please check the details carefully and sign.</div>
          </div>
          <div class="meta">
            <div><b>Date :</b> ${today.toLocaleDateString('en-IN')}</div>
            <div><b>Prepared On :</b> ${today.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <!-- Student & Program -->
        <div class="section">
          <div class="section-title">Student and Program Details</div>
          <div class="kv-grid">
            <div class="kv-label">Name of the Student</div>
            <div>${this.esc(s1.name || '')}</div>

            <div class="kv-label">Registration / Reg No</div>
            <div>${this.esc(s1.regNo || '')}</div>

            <div class="kv-label">Academic Year</div>
            <div>${this.esc(s1.academicYear || '')}</div>

            <div class="kv-label">Mobile (Student / Parent)</div>
            <div>${this.esc(s1.phone || '')}</div>

            <div class="kv-label">Program</div>
            <div>${this.esc(s1.programName || '')}</div>

            <div class="kv-label">Fee Plan</div>
            <div>${this.esc(
              plan.feePlanCode || s1.feePlanCode || plan.name || ''
            )}</div>

            <div class="kv-label">Study Centre</div>
            <div>${this.esc(s1.centerName || '')}</div>
          </div>
        </div>

        <!-- Scholarship summary -->
        <div class="section">
          <div class="section-title">Scholarship Details</div>
          <table>
            <tbody>
              <tr>
                <td>Base Fee (before discounts)</td>
                <td class="text-right">₹ ${baseFee.toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td>Test Scholarship (%)</td>
                <td class="text-right">${testSch.toFixed(2)}%</td>
              </tr>
              <tr>
                <td>Scholarship (%)</td>
                <td class="text-right">${schl.toFixed(2)}%</td>
              </tr>
              <tr>
                <td>Additional Scholarship (%)</td>
                <td class="text-right">${addSchl.toFixed(2)}%</td>
              </tr>
              <tr>
                <td><b>Total Discount (%)</b></td>
                <td class="text-right"><b>${totalDisc.toFixed(2)}%</b></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Fee heads table -->
        <div class="section">
          <div class="section-title">Fee Plan Breakup</div>
          <table>
            <thead>
              <tr>
                <th>Fee Head</th>
                <th class="text-right">Fee</th>
                <th class="text-right">STax</th>
                <th class="text-right">Total</th>
                <th class="text-right">Schol Benefits</th>
              </tr>
            </thead>
            <tbody>
              ${
                feeRows ||
                '<tr><td colspan="5">No fee heads available.</td></tr>'
              }
            </tbody>
            <tfoot>
              <tr>
                <th colspan="3" class="text-right">Grand Total</th>
                <th class="text-right">₹ ${finalFee.toLocaleString(
                  'en-IN'
                )}</th>
                <th class="text-right">₹ ${scholTotal.toLocaleString(
                  'en-IN'
                )}</th>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- NEFT static section like reference sheet -->
        <div class="section small">
          <div class="section-title">Details for NEFT Transfer</div>
          <table>
            <tbody>
              <tr>
                <td>Account Number</td>
                <td>XXXXXXXXXXXX</td>
              </tr>
              <tr>
                <td>IFSC Code</td>
                <td>XXXX0000XXX</td>
              </tr>
              <tr>
                <td>Bank Name</td>
                <td>Your Bank Name Here</td>
              </tr>
              <tr>
                <td>Beneficiary Name</td>
                <td>${this.esc(this.DEFAULT_FAVOUR_OF)}</td>
              </tr>
            </tbody>
          </table>
          <div class="tiny mt-2">
            For office use only – kindly verify student name, registration number, program, study centre,
            fee plan and all instrument details before approving this sheet.
          </div>
        </div>
      </div>
    `;
  }

  /** STEP 1 – Fee Calculation Sheet print */
  printReportStep1(): void {
    if (this.step !== 1) {
      this.alert.error('Fee calculation can be printed from Step 1 only.');
      return;
    }
    this.step1Form.markAllAsTouched();
    if (this.step1Form.invalid) {
      this.alert.error('Please fill the required student and fee details.');
      return;
    }
    if (!this.selectedPlan || !this.feeHeadPreview.length) {
      this.alert.error('Please select a valid fee plan to preview fees.');
      return;
    }

    const html = this.buildFeeCalcHtmlStep1();
    this.openPrintWindow('Fee Calculation Sheet', html);
  }

  /** Build Acknowledgement / Enrolment Report for STEP 2 */
  private buildPaymentsAckHtmlStep2(): string {
    const s1 = this.step1Form.getRawValue();
    const plan = this.selectedPlan;
    const today = new Date();

    const nefts = (this.neftRefsFA.getRawValue() || []) as any[];
    const cheques = (this.chequesFA.getRawValue() || []) as any[];

    const finalFee = this.finalFee || 0;

    const paymentRows: string[] = [];
    let sno = 1;

    nefts.forEach((n: any) => {
      const amount = Number(n.amount || 0);
      if (!amount) return;
      paymentRows.push(`
        <tr>
          <td class="text-center">${sno++}</td>
          <td>NEFT</td>
          <td>${this.esc(
            n.paidOn ? new Date(n.paidOn).toLocaleDateString('en-IN') : ''
          )}</td>
          <td>${this.esc(n.utr || '')}</td>
          <td>${this.esc(n.bankName || '')}</td>
          <td class="text-right">${amount.toLocaleString('en-IN')}</td>
        </tr>
      `);
    });

    cheques.forEach((c: any) => {
      const amount = Number(c.amount || 0);
      if (!amount) return;
      paymentRows.push(`
        <tr>
          <td class="text-center">${sno++}</td>
          <td>${this.esc(c.mode || 'PDC')}</td>
          <td>${this.esc(
            c.dueDate ? new Date(c.dueDate).toLocaleDateString('en-IN') : ''
          )}</td>
          <td>${this.esc(c.chequeNo || '')}</td>
          <td>${this.esc(c.bankName || '')}</td>
          <td class="text-right">${amount.toLocaleString('en-IN')}</td>
        </tr>
      `);
    });

    const totalPaid = this.neftTotalEntered + this.chequeTotal;

    return `
      <div class="page">
        <div class="header-row">
          <div>
            <div class="title-main">ENROLMENT REPORT</div>
            <div class="subtitle">Acknowledgement of Fee & Instruments (Draft)</div>
          </div>
          <div class="meta">
            <div><b>Date :</b> ${today.toLocaleDateString('en-IN')}</div>
            ${
              this.admissionId
                ? `<div><b>Admission ID :</b> ${this.esc(
                    this.admissionId
                  )}</div>`
                : ''
            }
          </div>
        </div>

        <!-- Part 1: Student / Program / Study Centre -->
        <div class="section">
          <div class="section-title">Student, Program and Study Centre Details (Part 1)</div>
          <table>
            <tbody>
              <tr>
                <td>Registration No.</td>
                <td>${this.esc(s1.regNo || '')}</td>
                <td>Admission ID</td>
                <td>${this.esc(this.admissionId || '')}</td>
              </tr>
              <tr>
                <td>Student Name</td>
                <td>${this.esc(s1.name || '')}</td>
                <td>Enrollment Date</td>
                <td>${today.toLocaleDateString('en-IN')}</td>
              </tr>
              <tr>
                <td>Student Mobile</td>
                <td>${this.esc(s1.phone || '')}</td>
                <td>Parent Name</td>
                <td>${this.esc(s1.parentName || '')}</td>
              </tr>
              <tr>
                <td>Email ID</td>
                <td>${this.esc(s1.email || '')}</td>
                <td>Academic Year</td>
                <td>${this.esc(s1.academicYear || '')}</td>
              </tr>
              <tr>
                <td>Program</td>
                <td colspan="3">${this.esc(s1.programName || '')}</td>
              </tr>
              <tr>
                <td>Study Centre</td>
                <td>${this.esc(s1.centerName || '')}</td>
                <td>Fee Plan</td>
                <td>${this.esc(
                  plan?.feePlanCode || s1.feePlanCode || plan?.name || ''
                )}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Part 2 + 3: Course Fee & Payment Schedule -->
        <div class="section">
          <div class="section-title">Details of Course Fee & Payment Schedule</div>

          <table>
            <thead>
              <tr>
                <th colspan="2">Particulars of Fee</th>
                <th style="width:120px;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="2">Final Course Fee (after scholarships)</td>
                <td class="text-right">${finalFee.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          <div class="mt-2 small"><b>Payment Schedule (Part 3)</b></div>
          <table>
            <thead>
              <tr>
                <th style="width:40px;" class="text-center">S.No</th>
                <th style="width:70px;">Mode</th>
                <th style="width:110px;">Dated</th>
                <th>DD/Chq/UTR No</th>
                <th>Bank</th>
                <th style="width:120px;" class="text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${
                paymentRows.length
                  ? paymentRows.join('')
                  : '<tr><td colspan="6" class="text-center">No payment details captured.</td></tr>'
              }
            </tbody>
            <tfoot>
              <tr>
                <th colspan="5" class="text-right">Total payments captured</th>
                <th class="text-right">₹ ${totalPaid.toLocaleString(
                  'en-IN'
                )}</th>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Important notes -->
        <div class="section small">
          <div class="section-title">Important</div>
          <ul class="note-list">
            <li>Cheques / DDs are subject to realisation.</li>
            <li>
              This acknowledgement is generated from the admission screen. Please verify student,
              program, fee plan and instrument details before final approval.
            </li>
            <li>
              In case of any mismatch between this sheet and the core system, the system records
              will be treated as final.
            </li>
          </ul>
        </div>
      </div>
    `;
  }

  /** STEP 2 – Acknowledgement / Enrolment Report print */
  printPaymentsAck(): void {
    if (this.step !== 2) {
      this.alert.error('Acknowledgement can be printed from Step 2 only.');
      return;
    }
    if (!this.submittedForAck) {
      this.alert.error(
        'Please submit payment details before printing acknowledgement.'
      );
      return;
    }
    if (this.step2Form.invalid) {
      this.step2Form.markAllAsTouched();
      this.alert.error('Please correct NEFT / cheque details before printing.');
      return;
    }

    const html = this.buildPaymentsAckHtmlStep2();
    this.openPrintWindow('Enrolment Report', html);
  }

  // === Alert bindings for template ===
  get alert$() {
    return this.alert.alert$;
  }

  clearAlert(): void {
    this.alert.clear();
  }
  cancel(): void {
    // navigate back to admissions list
    this.router.navigate(['/app/admissions']);
  }
}
