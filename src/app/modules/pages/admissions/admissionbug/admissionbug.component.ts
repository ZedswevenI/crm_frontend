import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import {
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Subject, combineLatest, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs/operators';

import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
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
  centerName?: string;
  centerCode?: string;
  studyCentre?: string;
  testScholarshipPct?: number;
  scholarshipTestId?: string;
  academicYear?: string;
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
  instalments: Array<{
    seq: number;
    label: string;
    amount: number;
    dueDate?: string | null;
  }>;
  feeHeads: Array<{
    key: string;
    label: string;
    fee: number;
    stax: number;
  }>;
}

interface CenterItem {
  centerId: string;
  centerName: string;
  centerCode?: string;
}

type Step = 0 | 1 | 2;

@Component({
  selector: 'app-admissionbug',
  standalone: false,
  templateUrl: './admissionbug.component.html',
  styleUrl: './admissionbug.component.scss',
})
export class AdmissionbugComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  // ---------- UI State ----------
  step: Step = 0;
  directMode: 'NONE' | 'NO_TEST' | 'WITH_TEST' = 'NONE';

  loading = false;
  submitting = false;

  submittedForAck = false;
  feeCalcGenerated = false;
  approvalSent = false;

  isDirectEnrolment = false;
  portal: PortalStudentResult | null = null;
  admissionId: string | null = null;

  discountOptions = Array.from({ length: 21 }, (_, i) => i * 5);

  academicYearOptions: string[] = [];
  testInfo: any = {};

  readonly DEFAULT_FAVOUR_OF = 'ZEDSWEVEN I PRIVATE LIMITED';
  readonly PRINT_LOGO_URL = '../../../../../assets/logo.png';

  // ---------- Forms ----------
  lookupForm!: UntypedFormGroup;
  step1Form!: UntypedFormGroup;
  step2Form!: UntypedFormGroup;

  // ---------- Masters (Subjects for OnPush friendly updates) ----------
  private programsSub = new BehaviorSubject<ProgramItem[]>([]);
  programs$ = this.programsSub.asObservable();
  programsLoading$ = new BehaviorSubject<boolean>(false);

  private centersSub = new BehaviorSubject<CenterItem[]>([]);
  centers$ = this.centersSub.asObservable();
  centersLoading$ = new BehaviorSubject<boolean>(false);

  private feePlansSub = new BehaviorSubject<FeePlan[]>([]);
  feePlans$ = this.feePlansSub.asObservable();
  feePlansLoading$ = new BehaviorSubject<boolean>(false);

  // triggers feeplan reload (cancellable)
  private feePlanReload$ = new Subject<void>();

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

  // ---------- Derived streams (NO heavy getters in template) ----------
  readonly feePlanId$ = () =>
    this.step1Form.get('feePlanId')!.valueChanges.pipe(
      startWith(this.step1Form.get('feePlanId')!.value),
      map((v) => String(v || '').trim()),
      distinctUntilChanged()
    );

  readonly selectedPlan$ = () =>
    combineLatest([this.feePlans$, this.feePlanId$()]).pipe(
      map(([plans, id]) => plans.find((p) => p.id === id) || null),
      shareReplay(1)
    );

  readonly testScholarshipPct$ = () =>
    this.step1Form.get('testScholarshipPct')!.valueChanges.pipe(
      startWith(this.step1Form.getRawValue().testScholarshipPct),
      map((v) => Number(v || 0) || 0),
      distinctUntilChanged()
    );

  readonly scholarshipPct$ = () =>
    this.step1Form.get('scholarshipPct')!.valueChanges.pipe(
      startWith(this.step1Form.get('scholarshipPct')!.value),
      map((v) => Number(v || 0) || 0),
      distinctUntilChanged()
    );

  readonly additionalScholarshipPct$ = () =>
    this.step1Form.get('additionalScholarshipPct')!.valueChanges.pipe(
      startWith(this.step1Form.get('additionalScholarshipPct')!.value),
      map((v) => Number(v || 0) || 0),
      distinctUntilChanged()
    );

  readonly feeHeadPreview$ = () =>
    combineLatest([
      this.selectedPlan$(),
      this.testScholarshipPct$(),
      this.scholarshipPct$(),
      this.additionalScholarshipPct$(),
    ]).pipe(
      map(([plan, t, s, a]) => this.computeFeeHeadPreview(plan, t, s, a)),
      shareReplay(1)
    );

  readonly finalFee$ = () =>
    this.feeHeadPreview$().pipe(
      map((rows) => rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0)),
      shareReplay(1)
    );

  readonly totalDiscountPct$ = () =>
    combineLatest([
      this.testScholarshipPct$(),
      this.scholarshipPct$(),
      this.additionalScholarshipPct$(),
    ]).pipe(
      map(([t, s, a]) => {
        const A = Math.max(0, Math.min(100, t)) / 100;
        const B = Math.max(0, Math.min(100, s)) / 100;
        const C = Math.max(0, Math.min(100, a)) / 100;
        const eff = 1 - (1 - A) * (1 - B) * (1 - C);
        return Math.round(eff * 10000) / 100;
      }),
      shareReplay(1)
    );

  // Step2 streamed totals
  readonly neftTotalEntered$ = () =>
    this.neftRefsFA.valueChanges.pipe(
      startWith(this.neftRefsFA.getRawValue()),
      map((rows: any[]) =>
        (rows || []).reduce((s, r) => s + (Number(r?.amount) || 0), 0)
      ),
      shareReplay(1)
    );

  readonly chequeTotal$ = () =>
    this.chequesFA.valueChanges.pipe(
      startWith(this.chequesFA.getRawValue()),
      map((rows: any[]) =>
        (rows || []).reduce((s, r) => s + (Number(r?.amount) || 0), 0)
      ),
      shareReplay(1)
    );

  readonly totalCollected$ = () =>
    combineLatest([this.neftTotalEntered$(), this.chequeTotal$()]).pipe(
      map(([n, c]) => (Number(n) || 0) + (Number(c) || 0)),
      shareReplay(1)
    );

  readonly balanceAmount$ = () =>
    combineLatest([this.finalFee$(), this.totalCollected$()]).pipe(
      map(([due, paid]) => {
        const D = Math.round(Number(due) || 0);
        const P = Math.round(Number(paid) || 0);
        return Math.max(0, D - P);
      }),
      shareReplay(1)
    );

  // Small display-only fields
  readonly regNoView$ = () =>
    this.step1Form.get('regNo')!.valueChanges.pipe(
      startWith(this.step1Form.get('regNo')!.value),
      map((v) => String(v || '—')),
      shareReplay(1)
    );

  // ---------- Init ----------
  ngOnInit(): void {
    this.lookupForm = this.fb.group({
      regNo: [''],
    });

    this.step1Form = this.fb.group({
      academicYear: ['', Validators.required],
      portalStudentId: [''],
      scholarshipTestId: [''],
      regNo: [{ value: '', disabled: true }],
      name: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      parentName: ['', Validators.required],
      parentPhone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      email: ['', [Validators.email]],
      programId: ['', Validators.required],
      programName: ['', Validators.required],
      programCode: [''],
      centerId: ['', Validators.required],
      centerName: [''],
      centerCode: [''],
      studyCentre: [''],
      feePlanId: ['', Validators.required],
      feePlanCode: [''],
      baseFee: [{ value: 0, disabled: true }],
      testScholarshipPct: [{ value: 0, disabled: true }],
      scholarshipPct: [0, [Validators.min(0), Validators.max(100)]],
      additionalScholarshipPct: [0, [Validators.min(0), Validators.max(100)]],
      schoolOverallPct: [null],
      schoolCorePct: [null],
      schoolRemarks: [''],
    });

    this.step2Form = this.fb.group({
      neftAmount: [{ value: 0, disabled: true }],
      neftRefs: this.fb.array([]),
      cheques: this.fb.array([]),
    });

    this.buildAcademicYearOptions();
    this.buildEmptyPayments();

    // phone -> parentPhone sync (cheap, but prevent loops)
    this.step1Form
      .get('phone')!
      .valueChanges.pipe(
        map((v) => String(v || '').trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((phone) => {
        const cur = String(
          this.step1Form.get('parentPhone')?.value || ''
        ).trim();
        if (phone && phone !== cur) {
          this.step1Form
            .get('parentPhone')
            ?.setValue(phone, { emitEvent: false });
        }
      });

    // Load masters once
    this.loadPrograms();
    this.loadCenters();

    // Program change -> reload feeplans (debounced, cancellable)
    this.step1Form
      .get('programId')!
      .valueChanges.pipe(
        map((v) => String(v || '').trim()),
        distinctUntilChanged(),
        debounceTime(50),
        tap((pid) => this.applyProgramFromMaster(pid)),
        tap(() => this.feePlanReload$.next()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    // academicYear change -> reload feeplans
    this.step1Form
      .get('academicYear')!
      .valueChanges.pipe(
        map((v) => String(v || '').trim()),
        distinctUntilChanged(),
        debounceTime(50),
        tap(() => {
          this.resetWorkflowFlags();
          this.feePlanReload$.next();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    // feePlanId change -> update feePlanCode + baseFee (cheap)
    combineLatest([this.selectedPlan$(), this.feePlanId$()])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([plan]) => {
        this.step1Form.patchValue(
          { feePlanCode: plan?.feePlanCode || '' },
          { emitEvent: false }
        );

        const total =
          plan?.feeHeads?.reduce(
            (s, x) => s + (Number(x.fee || 0) + Number(x.stax || 0)),
            0
          ) || 0;
        this.step1Form.get('baseFee')?.setValue(total, { emitEvent: false });

        this.resetWorkflowFlags();
      });

    // Any scholarship change resets workflow flags
    combineLatest([
      this.testScholarshipPct$(),
      this.scholarshipPct$(),
      this.additionalScholarshipPct$(),
    ])
      .pipe(
        tap(() => this.resetWorkflowFlags()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    // Fee plan loader stream (switchMap = cancels old calls)
    this.feePlanReload$
      .pipe(
        startWith(void 0),
        debounceTime(0),
        switchMap(() => this.fetchFeePlans$()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  // ---------- FormArray getters (safe, used by template for form bindings) ----------
  get neftRefsFA(): UntypedFormArray {
    return this.step2Form.get('neftRefs') as UntypedFormArray;
  }
  get chequesFA(): UntypedFormArray {
    return this.step2Form.get('cheques') as UntypedFormArray;
  }

  // ---------- trackBy ----------
  trackByIndex = (i: number) => i;
  trackByProgramId = (_: number, x: ProgramItem) => x.programId;
  trackByCenterId = (_: number, x: CenterItem) => x.centerId;
  trackByFeePlanId = (_: number, x: FeePlan) => x.id;
  trackByFeeHeadLabel = (_: number, x: any) => x.label;

  // ---------- UI handlers ----------
  onDirectModeChange(mode: 'NO_TEST' | 'WITH_TEST', ev: any): void {
    const checked = !!ev?.target?.checked;
    if (!checked) {
      if (this.directMode === mode) this.directMode = 'NONE';
      return;
    }
    this.directMode = mode;
    if (mode === 'NO_TEST') {
      this.lookupForm.patchValue({ regNo: '' }, { emitEvent: false });
    }
  }

  startDirectEnrolmentNoTest(): void {
    if (this.directMode !== 'NO_TEST') {
      this.alert.error('Please select "Direct Enrollment without Test data".');
      return;
    }
    const newReg = this.uuidv4();

    this.isDirectEnrolment = true;
    this.portal = null;
    this.admissionId = null;

    this.step1Form.reset();
    this.step1Form.patchValue(
      {
        portalStudentId: '',
        scholarshipTestId: '',
        regNo: newReg,
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
        academicYear: this.step1Form.get('academicYear')?.value || '',
      },
      { emitEvent: false }
    );

    this.testInfo = {
      testDate: null,
      testCity: null,
      testCentre: null,
      centerCode: null,
      resultCategory: null,
      paper1Total: null,
      paper2Total: null,
      gtotal: null,
      normalizedScore: null,
      normalizedPercentage: null,
      normalizedRank: null,
      programOffered1: null,
      programOffered2: null,
      waiverPerInTf: null,
      studyCentre: null,
    };

    this.setRegNoLock(true);
    this.setTestScholarshipLock(true);

    this.feePlansSub.next([]);
    this.buildEmptyPayments();
    this.resetWorkflowFlags();

    this.step = 1;
    this.alert.success('Direct enrolment started (RegNo auto generated).');
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
    const body: any = { entiId: tenantId, registrationNumber: regNo };

    this.api
      .fetchData(body, 'admi', 'portal/fetch')
      .pipe(
        catchError((err) => {
          this.loading = false;
          if (this.handleAdmissionAlreadyExists(err?.error)) return of(null);
          this.alert.error(
            err?.error?.message || err?.message || 'Fetch failed'
          );
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res: any) => {
        if (!res) return;
        this.loading = false;

        if (!res?.status) {
          this.alert.error(res?.message || res?.error || 'Fetch failed');
          return;
        }

        const d = res?.data || {};
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
          phone,
          parentName,
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
            programName: '',
            programCode: portal.programCode || '',
            centerName: portal.centerName || portal.studyCentre || '',
            centerCode: portal.centerCode || '',
            studyCentre: portal.studyCentre || '',
            academicYear: portal.academicYear || '',
            testScholarshipPct: portal.testScholarshipPct || 0,
            scholarshipPct: 0,
            additionalScholarshipPct: 0,
            feePlanId: '',
            feePlanCode: '',
            baseFee: 0,
          },
          { emitEvent: false }
        );

        this.testInfo = {
          testDate: d.testDate,
          testCity: d.testCity,
          testCentre: d.testCentre,
          testName: d.testName,
          centerCode: d.centerCode,
          resultCategory: d.resultCategory,
          paper1Total: d.paper1Total,
          paper2Total: d.paper2Total,
          gtotal: d.gtotal,
          normalizedScore: d.normalizedScore,
          normalizedPercentage: d.normalizedPercentage,
          normalizedRank: d.normalizedRank,
          programOffered1: d.programOffered1,
          programOffered2: d.programOffered2,
          waiverPerInTf: d.waiverPerInTf,
          studyCentre: d.studyCentre,
        };

        this.setRegNoLock(true);
        this.setTestScholarshipLock(true);

        this.tryMapProgramFromPortal();
        this.step = 1;
        this.resetWorkflowFlags();
        this.buildEmptyPayments();

        this.alert.success('Fetched student details.');
        this.feePlanReload$.next();
      });
  }

  fetchByRegNoDirectWithTest(): void {
    if (this.directMode !== 'WITH_TEST') {
      this.alert.error('Please select "Direct Enrollment with Test".');
      return;
    }
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }
    const regNo = String(this.lookupForm.value.regNo || '').trim();
    if (!regNo) {
      this.alert.error('Please enter Enrolment / Reg No.');
      return;
    }

    this.loading = true;
    const body: any = { entiId: tenantId, registrationNumber: regNo };

    this.api
      .fetchData(body, 'admi', 'portal/fetch')
      .pipe(
        catchError((err) => {
          this.loading = false;
          this.alert.error(`${err?.error?.message || 'Fetch failed'}`);
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res: any) => {
        if (!res) return;
        this.loading = false;

        if (!res?.status) {
          this.alert.error(res?.message || res?.error || 'Fetch failed');
          return;
        }

        const d = res?.data || {};
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
          scholarshipTestId: '',
          regNo: d.regNo || d.registrationNumber || regNo,
          registrationNumber: d.registrationNumber || regNo,
          name:
            d.name ||
            d.studentName ||
            `${d.firstName || ''} ${d.lastName || ''}`.trim(),
          phone,
          parentName,
          parentPhone: String(
            d.parentPhone || d.parentMobile || phone || ''
          ).trim(),
          email: d.email || '',
          programName: d.programName || '',
          programCode: d.programCode || '',
          centerName: d.centerName || '',
          centerCode: d.centerCode || '',
          studyCentre: d.studyCentre || '',
          testScholarshipPct: 0,
          academicYear: academicYear || '',
        };

        this.portal = portal;
        this.isDirectEnrolment = true;
        this.admissionId = null;

        this.step1Form.reset();
        this.step1Form.patchValue(
          {
            portalStudentId: portal.portalStudentId || '',
            scholarshipTestId: '',
            regNo: portal.regNo || regNo,
            name: portal.name || '',
            phone: portal.phone || '',
            parentName: portal.parentName || '',
            parentPhone: portal.parentPhone || portal.phone || '',
            email: portal.email || '',
            programName: '',
            programCode: portal.programCode || '',
            centerName: portal.centerName || portal.studyCentre || '',
            centerCode: portal.centerCode || '',
            studyCentre: portal.studyCentre || '',
            academicYear: portal.academicYear || '',
            testScholarshipPct: 0,
            scholarshipPct: 0,
            additionalScholarshipPct: 0,
            feePlanId: '',
            feePlanCode: '',
            baseFee: 0,
          },
          { emitEvent: false }
        );

        this.testInfo = {
          testDate: d.testDate,
          testCity: d.testCity,
          testCentre: d.testCentre,
          centerCode: d.centerCode,
          resultCategory: d.resultCategory,
          paper1Total: d.paper1Total,
          paper2Total: d.paper2Total,
          gtotal: d.gtotal,
          normalizedScore: d.normalizedScore,
          normalizedPercentage: d.normalizedPercentage,
          normalizedRank: d.normalizedRank,
          programOffered1: d.programOffered1,
          programOffered2: d.programOffered2,
          waiverPerInTf: d.waiverPerInTf,
          studyCentre: d.studyCentre,
        };

        this.setRegNoLock(true);
        this.setTestScholarshipLock(true);

        this.tryMapProgramFromPortal();
        this.step = 1;
        this.resetWorkflowFlags();
        this.buildEmptyPayments();

        this.alert.success(
          'Student details fetched (test scholarship ignored).'
        );
        this.feePlanReload$.next();
      });
  }

  goToLookup(): void {
    this.step = 0;
    this.resetWorkflowFlags();
  }

  cancel(): void {
    this.router.navigate(['/app/admissions']);
  }

  back(): void {
    this.step = 1;
  }

  // ---------- Step 1 -> Step 2 (Create draft) ----------
  next(): void {
    this.step1Form.markAllAsTouched();
    if (this.step1Form.invalid) {
      this.alert.error('Some required fields are missing/invalid.');
      return;
    }

    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }

    const plan =
      this.feePlansSub
        .getValue()
        .find(
          (p) =>
            p.id === String(this.step1Form.get('feePlanId')?.value || '').trim()
        ) || null;

    if (!plan) {
      this.alert.error('Please select a valid fee plan.');
      return;
    }

    this.submitting = true;
    const s1 = this.step1Form.getRawValue();
    const sourceType = s1.portalStudentId ? 'PORTAL' : 'DIRECT';

    // compute fee preview once for payload (avoid template getters)
    const feePreview = this.computeFeeHeadPreview(
      plan,
      Number(s1.testScholarshipPct || 0),
      Number(s1.scholarshipPct || 0),
      Number(s1.additionalScholarshipPct || 0)
    );
    const finalFee = feePreview.reduce(
      (sum, r) => sum + (Number(r.total) || 0),
      0
    );
    const totalDisc = this.computeTotalDiscountPct(
      Number(s1.testScholarshipPct || 0),
      Number(s1.scholarshipPct || 0),
      Number(s1.additionalScholarshipPct || 0)
    );

    const body: any = {
      entiId: tenantId,
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
      scholarshipTestId:
        this.directMode === 'WITH_TEST' ? null : s1.scholarshipTestId || null,
      student: {
        name: String(s1.name || '').trim(),
        phone: String(s1.phone || '').trim(),
        parentName: String(s1.parentName || '').trim(),
        parentPhone: String(s1.parentPhone || s1.phone || '').trim(),
        email: String(s1.email || '').trim() || null,
      },
      fee: {
        baseFee: Number(s1.baseFee || 0),
        finalFee: Number(finalFee || 0),
        testScholarshipPct:
          this.directMode === 'WITH_TEST'
            ? 0
            : Number(s1.testScholarshipPct || 0),
        scholarshipPct: Number(s1.scholarshipPct || 0),
        additionalScholarshipPct: Number(s1.additionalScholarshipPct || 0),
        totalDiscountPct: Number(totalDisc || 0),
        breakup: feePreview.map((x) => ({
          label: x.label,
          total: x.total,
          scholBenefits: x.scholBenefits,
        })),
      },
      schoolMarks: {
        overallPct: s1.schoolOverallPct,
        coreSubjectPct: s1.schoolCorePct,
        remarks: String(s1.schoolRemarks || '').trim() || null,
      },
      test: this.testInfo,
    };

    this.api
      .fetchData(body, 'admi', 'create')
      .pipe(
        catchError(() => {
          this.submitting = false;
          this.alert.error('Failed to create admission draft');
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res: any) => {
        if (!res) return;
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
        this.buildPaymentsFromFinalFee(this.roundRupee(finalFee), plan);
        this.step = 2;
        this.alert.success('Admission draft created. Proceed to payments.');
      });
  }

  // ---------- Step 2 actions ----------
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

    const entered = (this.neftRefsFA.getRawValue() || []).reduce(
      (s: number, r: any) => s + (Number(r.amount) || 0),
      0
    );
    const neftAmount =
      Number(this.step2Form.getRawValue().neftAmount ?? 0) || 0;

    if (entered <= 0) {
      this.alert.error('Please add at least one NEFT reference amount.');
      return;
    }
    if (entered > neftAmount) {
      this.alert.error(
        `NEFT total (₹${entered}) cannot exceed NEFT split (₹${neftAmount}).`
      );
      return;
    }

    const chequeTotal = (this.chequesFA.getRawValue() || []).reduce(
      (s: number, r: any) => s + (Number(r.amount) || 0),
      0
    );

    // finalFee snapshot (cheap sync by recompute from plan list)
    const plan =
      this.feePlansSub
        .getValue()
        .find(
          (p) =>
            p.id === String(this.step1Form.get('feePlanId')?.value || '').trim()
        ) || null;

    const s1 = this.step1Form.getRawValue();
    const feePreview = this.computeFeeHeadPreview(
      plan,
      Number(s1.testScholarshipPct || 0),
      Number(s1.scholarshipPct || 0),
      Number(s1.additionalScholarshipPct || 0)
    );
    const finalFee = feePreview.reduce(
      (sum, r) => sum + (Number(r.total) || 0),
      0
    );

    const totalPaid = entered + chequeTotal;
    const totalDue = this.roundRupee(finalFee || 0);

    if (totalDue > 0 && Math.round(totalPaid) !== totalDue) {
      this.alert.error(
        `Total of NEFT and cheques (₹${totalPaid}) must match final fee (₹${totalDue}).`
      );
      return;
    }

    const neftRefs = (this.neftRefsFA.getRawValue() || [])
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
    this.api
      .fetchData(body, 'admi', 'payments/save')
      .pipe(
        catchError(() => {
          this.submitting = false;
          this.alert.error('Failed to save payments');
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res: any) => {
        if (!res) return;
        this.submitting = false;

        if (!res?.status) {
          this.alert.error(
            res?.message || res?.error || 'Failed to save payments'
          );
          return;
        }
        this.submittedForAck = true;
        this.alert.success('Payment details saved.');
      });
  }

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
    this.api
      .fetchData(body, 'admi', 'submit-approval')
      .pipe(
        catchError(() => {
          this.submitting = false;
          this.alert.error('Failed to send for approval');
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res: any) => {
        if (!res) return;
        this.submitting = false;

        if (!res?.status) {
          this.alert.error(
            res?.message || res?.error || 'Failed to send for approval'
          );
          return;
        }
        this.approvalSent = true;
        this.alert.success('Sent for approval.');
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
    this.api
      .fetchData(body, 'admi', 'approve')
      .pipe(
        catchError(() => {
          this.submitting = false;
          this.alert.error('Failed to confirm admission');
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res: any) => {
        if (!res) return;
        this.submitting = false;
        if (!res?.status) {
          this.alert.error(
            res?.message || res?.error || 'Failed to confirm admission'
          );
          return;
        }
        this.alert.success('Admission confirmed.');
        this.router.navigate(['app/admissions/view', this.admissionId]);
      });
  }

  private loadPrograms(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }
    this.programsLoading$.next(true);
    const body: any = { entiId: tenantId };
    this.api
      .fetchData(body, 'ims/program', 'list?list=full')
      .pipe(
        catchError(() => {
          this.programsLoading$.next(false);
          this.programsSub.next([]);
          this.alert.error('Failed to load programs');
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res: any) => {
        this.programsLoading$.next(false);
        if (!res?.status) {
          this.programsSub.next([]);
          this.alert.error(
            res?.message || res?.error || 'Failed to load programs'
          );
          return;
        }
        const arr = Array.isArray(res?.data) ? res.data : [];
        const programs = arr
          .map((x: any) => ({
            programId: String(x.programId || x._id || x.id || '').trim(),
            programName: String(x.programName || x.name || '').trim(),
            programCode: String(x.programCodes || x.programCode || '').trim(),
            centerId: x.centerId ? String(x.centerId).trim() : '',
            centerName: x.centerName ? String(x.centerName).trim() : '',
          }))
          .filter((p: ProgramItem) => !!p.programId && !!p.programName);
        this.programsSub.next(programs);
        if (this.portal) {
          this.tryMapProgramFromPortal();
          this.feePlanReload$.next();
        }
      });
  }

  private loadCenters(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }
    this.centersLoading$.next(true);
    const body: any = { entiId: tenantId };
    this.api
      .fetchData(body, 'ims/center', 'list?list=full')
      .pipe(
        catchError(() => {
          this.centersLoading$.next(false);
          this.centersSub.next([]);
          this.alert.error('Failed to load centers');
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res: any) => {
        this.centersLoading$.next(false);
        if (!res?.status) {
          this.centersSub.next([]);
          this.alert.error(
            res?.message || res?.error || 'Failed to load centers'
          );
          return;
        }
        const arr = Array.isArray(res?.data) ? res.data : [];
        const centers = arr
          .map((x: any) => ({
            centerId: String(x.centerId || x._id || x.id || '').trim(),
            centerName: String(x.centerName || x.name || '').trim(),
            centerCode: x.centerCode ? String(x.centerCode).trim() : '',
          }))
          .filter((c: CenterItem) => !!c.centerId && !!c.centerName);
        this.centersSub.next(centers);
        const cur = String(this.step1Form.get('centerId')?.value || '').trim();
        if (!cur && centers.length === 1) {
          this.onCenterChanged(centers[0].centerId);
        }
      });
  }

  private fetchFeePlans$() {
    const tenantId = this.pickTenantId();
    if (!tenantId) return of(null);
    const programId = String(
      this.step1Form.get('programId')?.value || ''
    ).trim();
    const programCode = String(
      this.step1Form.get('programCode')?.value || ''
    ).trim();
    if (!programId && !programCode) {
      this.feePlansSub.next([]);
      this.step1Form.patchValue(
        { feePlanId: '', feePlanCode: '' },
        { emitEvent: false }
      );
      this.step1Form.get('baseFee')?.setValue(0, { emitEvent: false });
      return of(null);
    }
    this.feePlansLoading$.next(true);
    const body: any = { entiId: tenantId };
    let route = `list?list=full`;
    if (programId) route += `&programId=${encodeURIComponent(programId)}`;
    else route += `&programCode=${encodeURIComponent(programCode)}`;
    return this.api.fetchData(body, 'ims/feeplan', route).pipe(
      catchError(() => {
        this.feePlansLoading$.next(false);
        this.feePlansSub.next([]);
        this.alert.error('Failed to load fee plans');
        return of(null);
      }),
      tap((res: any) => {
        this.feePlansLoading$.next(false);
        if (!res?.status) {
          this.feePlansSub.next([]);
          this.alert.error(
            res?.message || res?.error || 'Failed to load fee plans'
          );
          return;
        }
        const arr = Array.isArray(res?.data) ? res.data : [];
        const plans: FeePlan[] = arr
          .map((x: any) => ({
            id: String(x.feePlanId || x.id || x._id || '').trim(),
            name: String(
              x.feePlanName || x.feePlanCode || x.name || 'Fee Plan'
            ).trim(),
            feePlanCode: x.feePlanCode ? String(x.feePlanCode).trim() : '',
            instalments: Array.isArray(x.instalments)
              ? x.instalments.map((i: any) => ({
                  seq: Number(i.seq || 0) || 0,
                  label: String(i.label || `Instalment ${i.seq || ''}`).trim(),
                  amount: Number(i.amount || 0) || 0,
                  dueDate: i.dueDate ? String(i.dueDate) : null,
                }))
              : [],
            feeHeads: Array.isArray(x.feeHeads)
              ? x.feeHeads.map((h: any) => ({
                  key: String(h.key || h.feeHeadKey || '').trim(),
                  label: String(h.label || h.feeHeadName || '').trim(),
                  fee: Number(h.amount || 0),
                  stax: Number(h.gstAmount || 0),
                }))
              : [],
          }))
          .filter((fp: FeePlan) => !!fp.id);
        this.feePlansSub.next(plans);
        const cur = String(this.step1Form.get('feePlanId')?.value || '').trim();
        const exists = !!plans.find((p) => p.id === cur);
        if (cur && !exists) {
          this.step1Form.patchValue(
            { feePlanId: '', feePlanCode: '' },
            { emitEvent: false }
          );
          this.step1Form.get('baseFee')?.setValue(0, { emitEvent: false });
        }
        const after = String(
          this.step1Form.get('feePlanId')?.value || ''
        ).trim();
        if (!after && plans.length) {
          this.step1Form.patchValue(
            { feePlanId: plans[0].id },
            { emitEvent: true }
          );
        }
      })
    );
  }

  onCenterChanged(centerId: any): void {
    const id = String(centerId || '').trim();
    const c = this.centersSub.getValue().find((x) => x.centerId === id) || null;
    this.step1Form.patchValue(
      {
        centerId: id,
        centerName: c?.centerName || '',
        centerCode: c?.centerCode || '',
      },
      { emitEvent: false }
    );
    this.resetWorkflowFlags();
  }

  private applyProgramFromMaster(programId: string): void {
    const pid = String(programId || '').trim();
    const p =
      this.programsSub.getValue().find((x) => x.programId === pid) || null;
    this.step1Form.patchValue(
      {
        programName: p?.programName || '',
        programCode: p?.programCode || '',
        feePlanId: '',
        feePlanCode: '',
      },
      { emitEvent: false }
    );
    this.step1Form.get('baseFee')?.setValue(0, { emitEvent: false });
    this.resetWorkflowFlags();
  }

  private pendingPortalProgramCode: string | null = null;
  private pendingPortalProgramName: string | null = null;

  private norm(v: any): string {
    return String(v ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[-_/]/g, '');
  }

  private tryMapProgramFromPortal(): void {
    if (!this.portal) return;
    const programs = this.programsSub.getValue();
    if (!programs.length) {
      this.pendingPortalProgramCode = this.norm(this.portal.programCode);
      this.pendingPortalProgramName = this.norm(this.portal.programName);
      return;
    }
    const portalCode = this.norm(this.portal.programCode);
    const portalName = this.norm(this.portal.programName);
    let match = portalCode
      ? programs.find((p) => this.norm(p.programCode) === portalCode) ?? null
      : null;
    if (!match && portalName) {
      match =
        programs.find((p) => this.norm(p.programName) === portalName) ?? null;
    }
    if (!match) {
      this.alert.error(
        `Program not found in master. Portal ProgramCode="${
          this.portal.programCode || ''
        }", ProgramName="${this.portal.programName || ''}".`
      );
      this.step1Form.patchValue(
        {
          programId: '',
          programName: '',
          programCode: this.portal.programCode || '',
          feePlanId: '',
          feePlanCode: '',
        },
        { emitEvent: false }
      );
      this.feePlansSub.next([]);
      this.step1Form.get('baseFee')?.setValue(0, { emitEvent: false });
      return;
    }
    this.step1Form.patchValue(
      {
        programId: match.programId,
        programName: match.programName,
        programCode: match.programCode || this.portal?.programCode || '',
      },
      { emitEvent: true }
    );
    this.pendingPortalProgramCode = null;
    this.pendingPortalProgramName = null;
  }

  private buildEmptyPayments(): void {
    this.step2Form.get('neftAmount')?.setValue(0, { emitEvent: false });
    this.step2Form.setControl('neftRefs', this.fb.array([]));
    this.step2Form.setControl('cheques', this.fb.array([]));
  }

  public isoToDDMMYYYY(iso: any): string {
    const s = String(iso || '').trim();
    if (!s) return '';
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    return `${m[2]}-${m[3]}-${m[1]}`;
  }

  private buildPaymentsFromFinalFee(finalFee: number, plan: FeePlan): void {
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
    const neftAmt = scaled[0] || 0;
    const chequeAmounts = scaled.slice(1);
    this.step2Form.get('neftAmount')?.setValue(neftAmt, { emitEvent: false });
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
    const chqFA = this.fb.array([]) as UntypedFormArray;
    const instals = (plan?.instalments || []).slice(1);
    chequeAmounts.forEach((amt, idx) => {
      const sno = idx + 1;
      const dueFromPlan = this.toDateInputISO(
        instals[idx]?.label ? String(instals[idx].label) : null
      );
      chqFA.push(
        this.fb.group({
          sno: [sno],
          dueDate: [
            { value: dueFromPlan, disabled: true },
            [Validators.required],
          ],
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
              Validators.minLength(6),
              Validators.maxLength(6),
            ],
          ],
          chequeDate: [null, [Validators.required]],
          mode: ['PDC' as ChequeMode, [Validators.required]],
          bankName: [''],
          remarks: [''],
        })
      );
    });
    this.step2Form.setControl('cheques', chqFA);
  }

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
    const plans = this.feePlansSub.getValue();
    const planId = String(this.step1Form.get('feePlanId')?.value || '').trim();
    const plan = plans.find((p) => p.id === planId) || null;
    if (!plan) {
      this.alert.error('Please select a valid fee plan to preview fees.');
      return;
    }
    const s1 = this.step1Form.getRawValue();
    const heads = this.computeFeeHeadPreview(
      plan,
      Number(s1.testScholarshipPct || 0),
      Number(s1.scholarshipPct || 0),
      Number(s1.additionalScholarshipPct || 0)
    );
    if (!heads.length) {
      this.alert.error('No fee heads found for this plan.');
      return;
    }
    const html = this.buildFeeCalcHtmlStep1(plan, heads);
    this.openPrintWindow('Fee Calculation Sheet', html);
  }

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
    const plans = this.feePlansSub.getValue();
    const planId = String(this.step1Form.get('feePlanId')?.value || '').trim();
    const plan = plans.find((p) => p.id === planId) || null;
    const html = this.buildPaymentsAckHtmlStep2(plan);
    this.openPrintWindow('Enrolment Report', html);
  }

  private computeFeeHeadPreview(
    plan: FeePlan | null,
    testPct: number,
    schlPct: number,
    addPct: number
  ): Array<{
    label: string;
    fee: number;
    stax: number;
    total: number;
    scholBenefits: number;
  }> {
    const heads = plan?.feeHeads || [];
    if (!heads.length) return [];
    const clamp = (v: number) => Math.max(0, Math.min(100, Number(v || 0)));
    const p1 = clamp(testPct);
    const p2 = clamp(schlPct);
    const p3 = clamp(addPct);
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
      if (isTuition) {
        const fee1 = applyPct(outFee, p1);
        const tax1 = Math.round(fee1 * rate);
        const fee2 = applyPct(fee1, p2);
        const tax2 = Math.round(fee2 * rate);
        const fee3 = applyPct(fee2, p3);
        const tax3 = Math.round(fee3 * rate);
        outFee = fee3;
        outTax = tax3;
        scholBenefits = Math.max(0, fee0 + tax0 - (outFee + outTax));
      }
      return {
        label: h.label,
        fee: outFee,
        stax: outTax,
        total: outFee + outTax,
        scholBenefits,
      };
    });
  }

  private computeTotalDiscountPct(t: number, s: number, a: number): number {
    const A = Math.max(0, Math.min(100, t || 0)) / 100;
    const B = Math.max(0, Math.min(100, s || 0)) / 100;
    const C = Math.max(0, Math.min(100, a || 0)) / 100;
    const eff = 1 - (1 - A) * (1 - B) * (1 - C);
    return Math.round(eff * 10000) / 100;
  }

  private scalePlan(
    amounts: number[],
    targetTotal: number,
    baseTotal: number
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

  private buildAcademicYearOptions(): void {
    const base = new Date().getFullYear();
    this.academicYearOptions = [1, 2, 3, 4].map((n) => `${base} - ${base + n}`);
    const cur = String(this.step1Form?.get('academicYear')?.value || '').trim();
    if (!cur) {
      setTimeout(() => {
        const now = String(
          this.step1Form.get('academicYear')?.value || ''
        ).trim();
        if (!now) {
          this.step1Form.patchValue(
            { academicYear: this.academicYearOptions[0] },
            { emitEvent: true }
          );
        }
      });
    }
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

  private pickTenantId(): string {
    return (
      (localStorage.getItem('entiId') || '').trim() ||
      (localStorage.getItem('tenantId') || '').trim()
    );
  }

  private uuidv4(): string {
    const c: any = (window as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const r = (Math.random() * 16) | 0;
      const v = ch === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private todayISO(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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

  // private toDateInputISO(v: any): string | null {
  //   if (!v) return null;
  //   if (/^\d{4}-\d{2}-\d{2}$/.test(String(v).trim())) return String(v).trim();
  //   const s = String(v).trim();
  //   const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  //   if (isoMatch?.[1]) return isoMatch[1];
  //   const dm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  //   if (dm) {
  //     const dd = dm[1].padStart(2, '0');
  //     const mm = dm[2].padStart(2, '0');
  //     const yyyy = dm[3];
  //     return `${yyyy}-${mm}-${dd}`;
  //   }
  //   const d = new Date(s);
  //   if (!isNaN(d.getTime())) {
  //     const yyyy = d.getFullYear();
  //     const mm = String(d.getMonth() + 1).padStart(2, '0');
  //     const dd = String(d.getDate()).padStart(2, '0');
  //     return `${yyyy}-${mm}-${dd}`;
  //   }
  //   return null;
  // }

  private toDateInputISO(v: any): string | null {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (isoMatch?.[1]) return isoMatch[1];
    const dmyDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dmyDash) {
      const dd = dmyDash[1].padStart(2, '0');
      const mm = dmyDash[2].padStart(2, '0');
      const yyyy = dmyDash[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    const dmySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmySlash) {
      const dd = dmySlash[1].padStart(2, '0');
      const mm = dmySlash[2].padStart(2, '0');
      const yyyy = dmySlash[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }

  private handleAdmissionAlreadyExists(payload: any): boolean {
    const admissionId = String(payload?.data?.admissionId || '').trim();
    const admissionNo = String(payload?.data?.admissionNo || '').trim();
    const msgRaw = String(payload?.message || '').trim();
    const looksLikeExists =
      !!admissionId &&
      (msgRaw.toLowerCase().includes('already exists') ||
        msgRaw.toLowerCase().includes('admission'));
    if (!looksLikeExists) return false;
    const msg = admissionNo
      ? `Admission already exists (Admission No: ${admissionNo}).`
      : `Admission already exists for this registration number.`;
    this.alert.error(msg);
    this.router.navigate(['app/admissions/view', admissionId]);
    return true;
  }

  get isL1(): boolean {
    const role = (localStorage.getItem('userRole') || '').trim().toUpperCase();
    return role === 'L1';
  }

  get alert$() {
    return this.alert.alert$;
  }

  clearAlert(): void {
    this.alert.clear();
  }

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
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 11px; margin: 16px; color: #111827; }
      .page { width: 100%; max-width: 800px; margin: 0 auto; }
      .title-main { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; text-align:center; }
      .subtitle { font-size: 11px; margin-top: 2px; text-align:center; }
      table { width:100%; border-collapse: collapse; margin-top: 4px; }
      th, td { border:1px solid #e5e7eb; padding: 3px 4px; vertical-align: top; }
      th { background:#f3f4f6; font-weight:600; }
      .text-right { text-align:right; }
      .text-center { text-align:center; }
      .section { margin-top: 10px; }
      .section-title { font-weight: 700; text-transform: uppercase; font-size: 11px; border-bottom: 1px solid #e5e7eb; padding-bottom: 2px; margin-bottom: 4px; }
      .brand-center { display:flex; justify-content:center; align-items:center; margin-bottom: 6px; }
      .brand-center img { height: 46px; width:auto; object-fit:contain; display:block; }
      .meta-row { margin-top: 6px; display:flex; justify-content: space-between; font-size: 10px; }
      .kv-grid { display: grid; grid-template-columns: 32% 68%; border: 1px solid #e5e7eb; }
      .kv-grid > div { border-bottom: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; padding: 3px 4px; }
      .kv-grid > div:nth-child(2n) { border-right: none; }
      .kv-label { background: #f9fafb; font-weight: 600; font-size: 10px; }
      .sign-row { margin-top: 18px; display:flex; justify-content: flex-end; }
      .sign-box { width: 220px; text-align: center; }
      .sign-line { height: 24px; border-bottom:1px solid #111827; }
      .sign-label { margin-top: 6px; font-size: 14px; font-weight: 600; }
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

  private buildInstallmentBreakupForStep1(
    plan: FeePlan,
    finalFee: number
  ): string {
    const instals = plan?.instalments || [];
    if (!instals.length)
      return `<tr><td colspan="5" class="text-center">No instalment structure available.</td></tr>`;
    const baseAmounts = instals.map((i) => Number(i.amount) || 0);
    const baseTotal = baseAmounts.reduce((s, x) => s + (Number(x) || 0), 0);
    const scaled = this.scalePlan(baseAmounts, finalFee || 0, baseTotal);
    return instals
      .map((i, idx) => {
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

  private buildFeeCalcHtmlStep1(plan: FeePlan, heads: any[]): string {
    const s1 = this.step1Form.getRawValue();
    const today = new Date();
    const finalFee = heads.reduce(
      (s: number, r: any) => s + Number(r.total || 0),
      0
    );
    const scholTotal = heads.reduce(
      (s: number, r: any) => s + Number(r.scholBenefits || 0),
      0
    );
    return `
    <div class="page">
      <div class="brand-center">
        <img src="${this.esc(this.PRINT_LOGO_URL)}" alt="Logo" />
      </div>
      <div class="title-main">FEE CALCULATION SHEET</div>
      <div class="subtitle">Please check the details carefully and sign.</div>
      <div class="meta-row">
        <div><b>Date :</b> ${today.toLocaleDateString('en-IN')}</div>
        <div><b>Prepared On :</b> ${today.toLocaleString('en-IN')}</div>
      </div>
      <div class="section">
        <div class="section-title">Student and Program Details</div>
        <div class="kv-grid">
          <div class="kv-label">Name of the Student</div><div>${this.esc(
            s1.name || ''
          )}</div>
          <div class="kv-label">Registration / Reg No</div><div>${this.esc(
            s1.regNo || ''
          )}</div>
          <div class="kv-label">Academic Year</div><div>${this.esc(
            s1.academicYear || ''
          )}</div>
          <div class="kv-label">Mobile (Student / Parent)</div><div>${this.esc(
            s1.phone || ''
          )}</div>
          <div class="kv-label">Program</div><div>${this.esc(
            s1.programName || ''
          )}</div>
          <div class="kv-label">Fee Plan</div><div>${this.esc(
            plan.feePlanCode || s1.feePlanCode || plan.name || ''
          )}</div>
          <div class="kv-label">Study Centre</div><div>${this.esc(
            s1.centerName || ''
          )}</div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Scholarship Details</div>
        <table>
          <tbody>
            <tr><td>Test Scholarship (%)</td><td class="text-right">${Number(
              s1.testScholarshipPct || 0
            ).toFixed(2)}%</td></tr>
            <tr><td>Scholarship (%)</td><td class="text-right">${Number(
              s1.scholarshipPct || 0
            ).toFixed(2)}%</td></tr>
            <tr><td>Additional Scholarship (%)</td><td class="text-right">${Number(
              s1.additionalScholarshipPct || 0
            ).toFixed(2)}%</td></tr>
            <tr><td><b>Total Scholarship Benefits</b></td><td class="text-right"><b>₹ ${scholTotal.toLocaleString(
              'en-IN'
            )}</b></td></tr>
          </tbody>
        </table>
      </div>
      <div class="section">
        <div class="section-title">Final Fee Summary</div>
        <table>
          <tbody>
            <tr><td><b>Final Fee (After Scholarships)</b></td><td class="text-right"><b>₹ ${finalFee.toLocaleString(
              'en-IN'
            )}</b></td></tr>
          </tbody>
        </table>
      </div>
      <div class="section">
        <div class="section-title">Fee Instalment Breakup</div>
        <table>
          <thead>
            <tr>
              <th style="width:40px;" class="text-center">S.No</th>
              <th>Instalment</th>
              <th style="width:140px;">Due Date</th>
              <th style="width:90px;" class="text-center">Mode</th>
              <th style="width:140px;" class="text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${this.buildInstallmentBreakupForStep1(plan, finalFee)}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="4" class="text-right">Total</th>
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
    </div>`;
  }

  private buildPaymentsAckHtmlStep2(plan: FeePlan | null): string {
    const s1 = this.step1Form.getRawValue();
    const today = new Date();
    const nefts = (this.neftRefsFA.getRawValue() || []) as any[];
    const cheques = (this.chequesFA.getRawValue() || []) as any[];
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
          <td class="text-right">${amount.toLocaleString('en-IN')}</td>
        </tr>
      `);
    });
    const totalPaid =
      (nefts || []).reduce((s, x) => s + (Number(x.amount) || 0), 0) +
      (cheques || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    return `
    <div class="page">
      <div class="brand-center">
        <img src="${this.esc(this.PRINT_LOGO_URL)}" alt="Logo" />
      </div>
      <div class="title-main">ACKNOWLEDGEMENT</div>
      <div class="subtitle">Provisional Admission Confirmation</div>
      <div class="meta-row">
        <div><b>Date :</b> ${today.toLocaleDateString('en-IN')}</div>
        <div><b>Academic Year :</b> ${this.esc(s1.academicYear || '')}</div>
      </div>
      <div class="section">
        <div class="section-title">Student, Program and Study Centre Details</div>
        <table>
          <tbody>
            <tr><td>Registration No.</td><td>${this.esc(
              s1.regNo || ''
            )}</td></tr>
            <tr><td>Student Name</td><td>${this.esc(
              s1.name || ''
            )}</td><td>Enrollment Date</td><td>${today.toLocaleDateString(
      'en-IN'
    )}</td></tr>
            <tr><td>Student Mobile</td><td>${this.esc(
              s1.phone || ''
            )}</td><td>Parent Name</td><td>${this.esc(
      s1.parentName || ''
    )}</td></tr>
            <tr><td>Email ID</td><td>${this.esc(
              s1.email || ''
            )}</td><td>Program</td><td>${this.esc(
      s1.programName || ''
    )}</td></tr>
            <tr><td>Study Centre</td><td>${this.esc(
              s1.centerName || ''
            )}</td><td>Fee Plan</td><td>${this.esc(
      plan?.feePlanCode || s1.feePlanCode || plan?.name || ''
    )}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="section">
        <div class="section-title">Payment Schedule</div>
        <table>
          <thead>
            <tr>
              <th style="width:40px;" class="text-center">S.No</th>
              <th style="width:70px;">Mode</th>
              <th style="width:110px;">Dated</th>
              <th>Cheque/DD/UTR No.</th>
              <th style="width:120px;" class="text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${
              paymentRows.length
                ? paymentRows.join('')
                : '<tr><td colspan="5" class="text-center">No payment details captured.</td></tr>'
            }
          </tbody>
          <tfoot>
            <tr>
              <th colspan="4" class="text-right">Total payments captured</th>
              <th class="text-right">₹ ${totalPaid.toLocaleString('en-IN')}</th>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="sign-row">
        <div class="sign-box">
          <div class="sign-line"></div>
          <div class="sign-label">Authorized Signatory</div>
        </div>
      </div>
    </div>`;
  }
}
