import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
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
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

declare var bootstrap: any;

type ChequeMode = 'PDC' | 'CDC' | 'DD' | 'NEFT';

interface PortalStudentResult {
  portalStudentId?: string;
  regNo?: string;
  registrationNumber?: string;
  name?: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
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
  durationYears?: number;
}

interface FeePlan {
  id: string;
  name: string;
  feePlanCode?: string;
  instalments: Array<{
    seq: number;
    feeHead: string;
    label: string;
    instalmentDate: number;
    amount: number;
    mode: string;
    chequeFavour?: string;
    discountApplied?: boolean;
  }>;
  feeHeads: Array<{
    key: string;
    label: string;
    fee: number;
    stax: number;
    discountAllowed?: boolean;
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
  courseStartYearOptions: { label: string; value: string }[] = [];
  academicYearOptions: string[] = [];
  testInfo: any = {};
  readonly DEFAULT_FAVOUR_OF = 'ZEDSWEVEN I PRIVATE LIMITED';
  readonly PRINT_LOGO_URL = '../../../../../assets/logo.png';
  lookupForm!: UntypedFormGroup;
  step1Form!: UntypedFormGroup;
  step2Form!: UntypedFormGroup;
  private programsSub = new BehaviorSubject<ProgramItem[]>([]);
  programs$ = this.programsSub.asObservable();
  programsLoading$ = new BehaviorSubject<boolean>(false);
  private centersSub = new BehaviorSubject<CenterItem[]>([]);
  centers$ = this.centersSub.asObservable();
  centersLoading$ = new BehaviorSubject<boolean>(false);
  private feePlansSub = new BehaviorSubject<FeePlan[]>([]);
  feePlans$ = this.feePlansSub.asObservable();
  feePlansLoading$ = new BehaviorSubject<boolean>(false);
  private feePlanReload$ = new Subject<void>();
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
  @ViewChild('splitModal') splitModalRef!: ElementRef;
  splitForm!: UntypedFormGroup;
  splitModalInstance: any;
  splitRowIndex: number = -1;
  splitOriginalAmount: number = 0;
  selectedChequeIndices: Set<number> = new Set();

  constructor(
    private fb: UntypedFormBuilder,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private router: Router,
    private api: CommonapiService,
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Admissions' },
      { label: 'New Admission' },
    ]);
  }

  readonly feePlanId$ = () =>
    this.step1Form.get('feePlanId')!.valueChanges.pipe(
      startWith(this.step1Form.get('feePlanId')!.value),
      map((v) => String(v || '').trim()),
      distinctUntilChanged(),
    );

  readonly selectedPlan$ = () =>
    combineLatest([this.feePlans$, this.feePlanId$()]).pipe(
      map(([plans, id]) => plans.find((p) => p.id === id) || null),
      shareReplay(1),
    );

  readonly testScholarshipPct$ = () =>
    this.step1Form.get('testScholarshipPct')!.valueChanges.pipe(
      startWith(this.step1Form.getRawValue().testScholarshipPct),
      map((v) => Number(v || 0) || 0),
      distinctUntilChanged(),
    );

  readonly scholarshipPct$ = () =>
    this.step1Form.get('scholarshipPct')!.valueChanges.pipe(
      startWith(this.step1Form.get('scholarshipPct')!.value),
      map((v) => Number(v || 0) || 0),
      distinctUntilChanged(),
    );

  readonly additionalScholarshipPct$ = () =>
    this.step1Form.get('additionalScholarshipPct')!.valueChanges.pipe(
      startWith(this.step1Form.get('additionalScholarshipPct')!.value),
      map((v) => Number(v || 0) || 0),
      distinctUntilChanged(),
    );

  readonly feeHeadPreview$ = () =>
    combineLatest([
      this.selectedPlan$(),
      this.testScholarshipPct$(),
      this.scholarshipPct$(),
      this.additionalScholarshipPct$(),
    ]).pipe(
      map(([plan, t, s, a]) => this.computeFeeHeadPreview(plan, t, s, a)),
      shareReplay(1),
    );

  readonly finalFee$ = () =>
    this.feeHeadPreview$().pipe(
      map((rows) => rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0)),
      shareReplay(1),
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
      shareReplay(1),
    );

  readonly neftTotalEntered$ = () =>
    this.neftRefsFA.valueChanges.pipe(
      startWith(this.neftRefsFA.getRawValue()),
      map(() => {
        let total = 0;
        this.neftRefsFA.controls.forEach((control) => {
          if (control.valid) {
            const val = control.getRawValue();
            total += Number(val.amount) || 0;
          }
        });
        return this.roundRupee(total);
      }),
      shareReplay(1),
    );

  readonly chequeTotal$ = () =>
    this.chequesFA.valueChanges.pipe(
      startWith(this.chequesFA.getRawValue()),
      map((rows: any[]) =>
        this.roundRupee(
          (rows || []).reduce((s, r) => s + (Number(r?.amount) || 0), 0),
        ),
      ),
      shareReplay(1),
    );

  readonly totalCollected$ = () =>
    combineLatest([this.neftTotalEntered$(), this.chequeTotal$()]).pipe(
      map(([n, c]) => this.roundRupee((Number(n) || 0) + (Number(c) || 0))),
      shareReplay(1),
    );

  readonly balanceAmount$ = () =>
    combineLatest([this.finalFee$(), this.totalCollected$()]).pipe(
      map(([due, paid]) => {
        const D = this.roundRupee(due || 0);
        const P = this.roundRupee(paid || 0);
        return Math.max(0, D - P);
      }),
      shareReplay(1),
    );

  readonly grandTotalView$ = () =>
    combineLatest([this.totalCollected$(), this.otherTotal$()]).pipe(
      map(([neft, other]) =>
        this.roundRupee((Number(neft) || 0) + (Number(other) || 0)),
      ),
      shareReplay(1),
    );

  readonly regNoView$ = () =>
    this.step1Form.get('regNo')!.valueChanges.pipe(
      startWith(this.step1Form.get('regNo')!.value),
      map((v) => String(v || '—')),
      shareReplay(1),
    );

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
      address: [''],
      city: [''],
      state: [''],
      pincode: [''],
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
      courseStartYear: [''],
    });
    this.step2Form = this.fb.group({
      neftAmount: [{ value: 0, disabled: true }],
      neftRefs: this.fb.array([]),
      cheques: this.fb.array([]),
      additionalPaymentsEnabled: [false],
      otherPayments: this.fb.array([]),
    });
    this.splitForm = this.fb.group({
      originalAmount: [{ value: 0, disabled: true }],
      splitAmount: [0, [Validators.required, Validators.min(1)]],
      splitMode: ['NEFT', Validators.required],
      remarks: ['Split payment'],
    });
    this.bindStep2NeftValidator();
    this.buildCourseStartYearOptions();
    this.buildEmptyPayments();
    this.step1Form
      .get('phone')!
      .valueChanges.pipe(
        map((v) => String(v || '').trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((phone) => {
        const cur = String(
          this.step1Form.get('parentPhone')?.value || '',
        ).trim();
        if (phone && phone !== cur) {
          this.step1Form
            .get('parentPhone')
            ?.setValue(phone, { emitEvent: false });
        }
      });
    this.loadPrograms();
    this.loadCenters();
    this.step1Form
      .get('programId')!
      .valueChanges.pipe(
        map((v) => String(v || '').trim()),
        distinctUntilChanged(),
        debounceTime(50),
        tap((pid) => this.applyProgramFromMaster(pid)),
        tap(() => this.feePlanReload$.next()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
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
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
    combineLatest([this.selectedPlan$(), this.feePlanId$()])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([plan]) => {
        this.step1Form.patchValue(
          { feePlanCode: plan?.feePlanCode || '' },
          { emitEvent: false },
        );

        const total =
          plan?.feeHeads?.reduce(
            (s, x) => s + (Number(x.fee || 0) + Number(x.stax || 0)),
            0,
          ) || 0;
        this.step1Form.get('baseFee')?.setValue(total, { emitEvent: false });

        this.resetWorkflowFlags();
      });
    combineLatest([
      this.testScholarshipPct$(),
      this.scholarshipPct$(),
      this.additionalScholarshipPct$(),
    ])
      .pipe(
        tap(() => this.resetWorkflowFlags()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
    this.feePlanReload$
      .pipe(
        startWith(void 0),
        debounceTime(0),
        switchMap(() => this.fetchFeePlans$()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  get neftRefsFA(): UntypedFormArray {
    return this.step2Form.get('neftRefs') as UntypedFormArray;
  }

  get chequesFA(): UntypedFormArray {
    return this.step2Form.get('cheques') as UntypedFormArray;
  }

  get otherPaymentsFA(): UntypedFormArray {
    return this.step2Form.get('otherPayments') as UntypedFormArray;
  }

  private chequeAllowedByDate = new Map<number, number>();
  trackByIndex = (i: number) => i;
  trackByProgramId = (_: number, x: ProgramItem) => x.programId;
  trackByCenterId = (_: number, x: CenterItem) => x.centerId;
  trackByFeePlanId = (_: number, x: FeePlan) => x.id;
  trackByFeeHeadLabel = (_: number, x: any) => x.label;

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
        address: '',
        city: '',
        state: '',
        pincode: '',
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
      { emitEvent: false },
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
        'Please enter Enrolment / Reg No. Or use Direct Enrolment.',
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
            err?.error?.message || err?.message || 'Fetch failed',
          );
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
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
          d.fatherName || d.parentName || d.guardianName || '',
        ).trim();
        const academicYear = String(
          d.academicYear || d.academic_year || '',
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
            d.parentPhone || d.parentMobile || phone || '',
          ).trim(),
          email: d.email || '',
          address: d.address || '',
          city: d.city || '',
          state: d.state || '',
          pincode: d.pincode || '',
          programName: d.programName || '',
          programCode: d.programCode || '',
          centerName: d.centerName || '',
          centerCode: d.centerCode || '',
          studyCentre: d.studyCentre || '',
          testScholarshipPct:
            Number(
              d.waiverPerInTf ?? d.testScholarshipPct ?? d.testScholarship ?? 0,
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
          { emitEvent: false },
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
        takeUntilDestroyed(this.destroyRef),
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
          d.fatherName || d.parentName || d.guardianName || '',
        ).trim();
        const academicYear = String(
          d.academicYear || d.academic_year || '',
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
            d.parentPhone || d.parentMobile || phone || '',
          ).trim(),
          email: d.email || '',
          address: d.address || '',
          city: d.city || '',
          state: d.state || '',
          pincode: d.pincode || '',
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
          { emitEvent: false },
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
          'Student details fetched (test scholarship ignored).',
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
            p.id ===
            String(this.step1Form.get('feePlanId')?.value || '').trim(),
        ) || null;
    if (!plan) {
      this.alert.error('Please select a valid fee plan.');
      return;
    }
    this.submitting = true;
    const s1 = this.step1Form.getRawValue();
    const rawYear = s1.courseStartYear;
    const yearStr =
      rawYear && typeof rawYear === 'object' && rawYear.value
        ? String(rawYear.value)
        : String(rawYear || '').trim();
    console.log('yearStr ', yearStr);
    const sourceType = s1.portalStudentId ? 'PORTAL' : 'DIRECT';
    const feePreview = this.computeFeeHeadPreview(
      plan,
      Number(s1.testScholarshipPct || 0),
      Number(s1.scholarshipPct || 0),
      Number(s1.additionalScholarshipPct || 0),
    );
    const finalFee = feePreview.reduce(
      (sum, r) => sum + (Number(r.total) || 0),
      0,
    );
    const totalDisc = this.computeTotalDiscountPct(
      Number(s1.testScholarshipPct || 0),
      Number(s1.scholarshipPct || 0),
      Number(s1.additionalScholarshipPct || 0),
    );
    const body: any = {
      entiId: tenantId,
      academicYear: String(s1.courseStartYear || '').trim() || null,
      courseStartYear: yearStr,
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
        parentPhone: String(s1.parentPhone || '').trim(),
        email: String(s1.email || '').trim() || null,
        address: String(s1.address || '').trim() || null,
        city: String(s1.city || '').trim() || null,
        state: String(s1.state || '').trim() || null,
        pincode: String(s1.pincode || '').trim() || null,
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

      test: this.normalizeTestInfoForPayload(this.testInfo),
    };
    this.api
      .fetchData(body, 'admi', 'create')
      .pipe(
        catchError(() => {
          this.submitting = false;
          this.alert.error('Failed to create admission draft');
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res: any) => {
        if (!res) return;
        this.submitting = false;
        if (!res?.status) {
          this.alert.error(
            res?.message || res?.error || 'Failed to create admission draft',
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
        this.buildPaymentsFromFeePlanInstalments(plan);
        this.step = 2;
        this.alert.success('Admission draft created. Proceed to payments.');
      });
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
        branchName: [''],
        referenceNote: [''],
        remarks: [''],
      }),
    );
    this.neftRefsFA.updateValueAndValidity();
  }

  removeNeftRef(i: number): void {
    if (this.neftRefsFA.length <= 1) return;
    this.neftRefsFA.removeAt(i);
    this.neftRefsFA.updateValueAndValidity();
  }

  private formatDateForRemark(epoch: number): string {
    if (!epoch) return '';
    const d = new Date(epoch);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }

  submitPayments(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }
    if (!this.admissionId) {
      this.alert.error(
        'Admission draft not created. Go back and proceed again.',
      );
      return;
    }
    if (this.step2Form.invalid) {
      const invalidControls = [];
      const controls = this.chequesFA.controls;
      for (let i = 0; i < controls.length; i++) {
        if (controls[i].invalid) {
          const row = controls[i] as UntypedFormGroup;
          const errors = Object.keys(row.controls)
            .filter((key) => row.get(key)?.invalid)
            .map((key) => `${key} (${JSON.stringify(row.get(key)?.errors)})`);
          invalidControls.push(`Row ${i + 1}: ${errors.join(', ')}`);
        }
      }
      console.log('Invalid Cheque Rows:', invalidControls);
    }
    if (this.step2Form.invalid) {
      this.step2Form.markAllAsTouched();
      this.alert.error('Please fill all required NEFT/cheque details.');
      return;
    }
    if (this.neftError) {
      this.alert.error(`NEFT Amount mismatch: ${this.neftError}`);
      return;
    }
    const neftTotal = (this.neftRefsFA.getRawValue() || []).reduce(
      (s: number, r: any) => s + (Number(r.amount) || 0),
      0,
    );
    const chequeTotal = (this.chequesFA.getRawValue() || []).reduce(
      (s: number, r: any) => s + (Number(r.amount) || 0),
      0,
    );
    const otherTotal = (this.otherPaymentsFA.getRawValue() || []).reduce(
      (s: number, r: any) => s + (Number(r.amount) || 0),
      0,
    );
    const totalPaid = this.roundRupee(neftTotal + chequeTotal + otherTotal);
    const plan =
      this.feePlansSub
        .getValue()
        .find(
          (p) =>
            p.id ===
            String(this.step1Form.get('feePlanId')?.value || '').trim(),
        ) || null;

    const s1 = this.step1Form.getRawValue();
    const feePreview = this.computeFeeHeadPreview(
      plan,
      Number(s1.testScholarshipPct || 0),
      Number(s1.scholarshipPct || 0),
      Number(s1.additionalScholarshipPct || 0),
    );
    let finalFee = this.roundRupee(
      feePreview.reduce((sum, r) => sum + (Number(r.total) || 0), 0),
    );
    finalFee = finalFee + this.roundRupee(otherTotal);
    const diff = Math.abs(totalPaid - finalFee);
    if (diff > 2) {
      this.alert.error(
        `Total Mismatch. Paid: ₹${totalPaid}, Due: ₹${finalFee} (Diff: ₹${diff})`,
      );
      return;
    }
    const rawCheques = this.chequesFA.getRawValue();
    const finalCheques: any[] = [];
    const convertedNefts: any[] = [];
    rawCheques.forEach((r: any) => {
      const mode = String(r.mode || '').toUpperCase();
      const amt = Number(r.amount || 0);
      const chequeNo = String(r.chequeNo || '').trim();
      const paidOn = this.dateInputToEpoch(r.chequeDate);
      const bank = String(r.bankName || '').trim();
      const branch = String(r.branchName || '').trim();
      const userRemark = String(r.remarks || '').trim();
      if (mode === 'NEFT') {
        convertedNefts.push({
          utr: chequeNo,
          amount: amt,
          paidOn: paidOn,
          remarks: `${this.formatDateForRemark(r.instalmentDate)} installment paid via NEFT. ${userRemark}`,
          bankName: bank,
          branchName: branch,
        });
      } else {
        finalCheques.push({
          sno: r.sno,
          description: r.description,
          dueDate: r.instalmentDate,
          amount: amt,
          chequeNo: chequeNo,
          chequeDate: paidOn,
          favourOf: r.favourOf,
          mode: mode,
          bankName: bank,
          branchName: branch,
          remarks: userRemark,
        });
      }
    });
    const standardNefts = this.neftRefsFA.getRawValue().map((r: any) => ({
      utr: String(r.utr || '').trim(),
      amount: Number(r.amount || 0),
      paidOn: this.dateInputToEpoch(r.paidOn),
      bankName: r.bankName,
      branchName: r.branchName,
      referenceNote: r.referenceNote,
      remarks: r.remarks,
    }));
    const finalOther = this.otherPaymentsFA.getRawValue().map((o: any) => ({
      mode: o.mode,
      amount: Number(o.amount || 0),
      paidOn: this.dateInputToEpoch(o.paidOn),
      refNo: o.refNo,
      bankName: o.bankName,
      branchName: o.branchName,
      referenceNote: o.referenceNote,
      remarks: o.remarks,
    }));
    const finalNeftRefs = [...standardNefts, ...convertedNefts];
    this.submitting = true;
    const body: any = {
      entiId: tenantId,
      admissionId: this.admissionId,
      neftRefs: finalNeftRefs,
      cheques: finalCheques,
      otherPayments: finalOther,
    };
    this.api
      .fetchData(body, 'admi', 'payments/save')
      .pipe(
        catchError(() => {
          this.submitting = false;
          this.alert.error('Failed to save payments');
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res: any) => {
        this.submitting = false;
        if (res?.status) {
          this.submittedForAck = true;
          this.alert.success('Payments saved successfully.');
        } else {
          this.alert.error(res?.message || 'Save failed');
        }
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
        'Fill required NEFT/cheque details before generating fee calculation.',
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
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res: any) => {
        if (!res) return;
        this.submitting = false;

        if (!res?.status) {
          this.alert.error(
            res?.message || res?.error || 'Failed to send for approval',
          );
          return;
        }
        this.approvalSent = true;
        this.alert.success('Sent for approval.');
        this.router.navigate(['app/admissions/new']);
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
        'Generate fee calculation and send for approval before confirming.',
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
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res: any) => {
        if (!res) return;
        this.submitting = false;
        if (!res?.status) {
          this.alert.error(
            res?.message || res?.error || 'Failed to confirm admission',
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
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res: any) => {
        this.programsLoading$.next(false);
        if (!res?.status) {
          this.programsSub.next([]);
          this.alert.error(
            res?.message || res?.error || 'Failed to load programs',
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
            durationYears:
              Number(x.durationYears ?? x.duration ?? x.programDuration ?? 0) ||
              0,
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
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res: any) => {
        this.centersLoading$.next(false);
        if (!res?.status) {
          this.centersSub.next([]);
          this.alert.error(
            res?.message || res?.error || 'Failed to load centers',
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
      this.step1Form.get('programId')?.value || '',
    ).trim();
    const programCode = String(
      this.step1Form.get('programCode')?.value || '',
    ).trim();
    if (!programId && !programCode) {
      this.feePlansSub.next([]);
      this.step1Form.patchValue(
        { feePlanId: '', feePlanCode: '' },
        { emitEvent: false },
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
            res?.message || res?.error || 'Failed to load fee plans',
          );
          return;
        }
        const arr = Array.isArray(res?.data) ? res.data : [];
        const plans: FeePlan[] = arr
          .map((x: any) => ({
            id: String(x.feePlanId || x.id || x._id || '').trim(),
            name: String(
              x.feePlanName || x.feePlanCode || x.name || 'Fee Plan',
            ).trim(),
            feePlanCode: x.feePlanCode ? String(x.feePlanCode).trim() : '',
            instalments: Array.isArray(x.instalments)
              ? x.instalments.map((i: any) => ({
                  seq: Number(i.seq || 0) || 0,
                  feeHead: String(i.feeHead || '').trim(),
                  label: String(i.label || `Instalment ${i.seq || ''}`).trim(),
                  instalmentDate: Number(i.instalmentDate || 0) || 0,
                  amount: Number(i.amount || 0) || 0,
                  mode: String(i.mode || 'PDC').trim(),
                  chequeFavour: String(i.chequeFavour || '').trim(),
                  discountApplied: !!i.discountApplied,
                }))
              : [],

            feeHeads: Array.isArray(x.feeHeads)
              ? x.feeHeads.map((h: any) => ({
                  key: String(h.key || '').trim(),
                  label: String(h.label || '').trim(),
                  fee: Number(h.amount || 0) || 0,
                  stax: Number(h.gstAmount || 0) || 0,
                  discountAllowed: !!h.discountAllowed,
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
            { emitEvent: false },
          );
          this.step1Form.get('baseFee')?.setValue(0, { emitEvent: false });
        }
        const after = String(
          this.step1Form.get('feePlanId')?.value || '',
        ).trim();
        if (!after && plans.length) {
          this.step1Form.patchValue(
            { feePlanId: plans[0].id },
            { emitEvent: true },
          );
        }
      }),
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
      { emitEvent: false },
    );
    this.resetWorkflowFlags();
  }

  private applyProgramFromMaster(programId: string): void {
    const pid = String(programId || '').trim();
    const p =
      this.programsSub.getValue().find((x) => x.programId === pid) || null;
    this.buildAcademicYearOptions(p?.durationYears || 0);
    this.step1Form.patchValue(
      {
        programName: p?.programName || '',
        programCode: p?.programCode || '',
        feePlanId: '',
        feePlanCode: '',
      },
      { emitEvent: false },
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
      ? (programs.find((p) => this.norm(p.programCode) === portalCode) ?? null)
      : null;
    if (!match && portalName) {
      match =
        programs.find((p) => this.norm(p.programName) === portalName) ?? null;
    }
    if (!match) {
      this.alert.error(
        `Program not found in master. Portal ProgramCode="${
          this.portal.programCode || ''
        }", ProgramName="${this.portal.programName || ''}".`,
      );
      this.step1Form.patchValue(
        {
          programId: '',
          programName: '',
          programCode: this.portal.programCode || '',
          feePlanId: '',
          feePlanCode: '',
        },
        { emitEvent: false },
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
      { emitEvent: true },
    );
    this.pendingPortalProgramCode = null;
    this.pendingPortalProgramName = null;
  }

  private buildEmptyPayments(): void {
    this.step2Form.get('neftAmount')?.setValue(0, { emitEvent: false });
    this.step2Form.setControl('neftRefs', this.fb.array([]));
    this.step2Form.setControl('cheques', this.fb.array([]));
    this.step2Form.patchValue(
      { additionalPaymentsEnabled: false },
      { emitEvent: false },
    );
    this.step2Form.setControl('otherPayments', this.fb.array([]));
    this.chequeAllowedByDate.clear();
  }

  printReportStep1(): void {
    this.step1Form.markAllAsTouched();
    if (this.step1Form.invalid) {
      this.alert.error('Please fill the required student and program details.');
      return;
    }
    const plans = this.feePlansSub.getValue();
    const planId = String(this.step1Form.get('feePlanId')?.value || '').trim();
    const plan = plans.find((p) => p.id === planId) || null;

    if (!plan) {
      this.alert.error('Please select a valid fee plan.');
      return;
    }
    const html = this.buildStep1PreviewHtml(plan);
    this.openPrintWindow('Admission Preview', html);
  }

  private buildStep1PreviewHtml(plan: FeePlan): string {
    const s1 = this.step1Form.getRawValue();
    const today = new Date();
    const discounted = this.buildDiscountedInstalmentsFromPlan(plan);
    const neftItems = discounted.filter(
      (x) => Number(x.instalmentDate || 0) === 0,
    );
    const chequeItems = discounted.filter(
      (x) => Number(x.instalmentDate || 0) !== 0,
    );
    const neftAmt = this.roundRupee(
      neftItems.reduce((s, x) => s + (Number(x.amount || 0) || 0), 0),
    );
    const groupedCheques = this.groupInstalmentsByDate(
      chequeItems.map((x) => ({
        instalmentDate: x.instalmentDate,
        label: x.label,
        amount: x.amount,
        mode: x.mode,
        chequeFavour: x.chequeFavour,
      })),
    );
    const chequeTotal = this.roundRupee(
      groupedCheques.reduce((s, g) => s + (Number(g.amount || 0) || 0), 0),
    );
    const splitRows: string[] = [];
    let sno = 1;
    splitRows.push(`
    <tr>
      <td class="text-center">${sno++}</td>
      <td>ON ADMISSION</td>
      <td>Online/DD</td>
      <td>${this.esc(
        neftItems
          .map((x) => x.label)
          .filter(Boolean)
          .join(', ') || 'Admission',
      )}</td>
      <td>ZEDSWEVEN I PRIVATE LIMITED</td>
      <td class="text-right">${neftAmt.toLocaleString('en-IN')}</td>
    </tr>
  `);

    // CHEQUE rows (grouped by date)
    groupedCheques.forEach((g) => {
      const dt = Number(g.instalmentDate || 0) || 0;
      const due =
        dt > 0 ? new Date(dt).toLocaleDateString('en-IN') : 'ON ADMISSION';
      const desc = Array.from(new Set(g.labels || [])).join(', ') || '-';
      const mode = String(g.mode || 'PDC').toUpperCase();

      splitRows.push(`
      <tr>
        <td class="text-center">${sno++}</td>
        <td>${this.esc(due)}</td>
        <td>(${this.esc(mode)})</td>
        <td>${this.esc(desc)}</td>        
      <td>ZEDSWEVEN I PRIVATE LIMITED</td>
        <td class="text-right">${this.roundRupee(g.amount).toLocaleString('en-IN')}</td>
      </tr>
    `);
    });

    const total = this.roundRupee(neftAmt + chequeTotal);

    return `
  <div class="page">
    <div class="brand-center">
      <img src="${this.esc(this.PRINT_LOGO_URL)}" alt="Logo" />
    </div>

    <div class="title-main">FEE CALCULATION SHEET</div>
    <div class="subtitle">Step 1 preview (Payment split shown as per fee plan instalments).</div>

    <div class="meta-row">
      <div><b>Date :</b> ${today.toLocaleDateString('en-IN')}</div>
      <div><b>Academic Year :</b> ${this.esc(s1.academicYear || '')}</div>
    </div>

    <div class="section">
      <div class="section-title">Student and Program Details</div>
      <div class="kv-grid">
        <div class="kv-label">Registration / Reg No</div><div>${this.esc(s1.regNo || '')}</div>
        <div class="kv-label">Student Name</div><div>${this.esc(s1.name || '')}</div>
        <div class="kv-label">Student Mobile</div><div>${this.esc(s1.phone || '')}</div>
        <div class="kv-label">Parent Name</div><div>${this.esc(s1.parentName || '')}</div>
        <div class="kv-label">Parent Mobile</div><div>${this.esc(s1.parentPhone || '')}</div>
        <div class="kv-label">Email</div><div>${this.esc(s1.email || '')}</div>
        <div class="kv-label">Program</div><div>${this.esc(s1.programCode || '')} - ${this.esc(s1.programName || '')}</div>
        <div class="kv-label">Study Centre</div><div>${this.esc(s1.centerCode || '')} - ${this.esc(s1.centerName || '')}</div>
        <div class="kv-label">Fee Plan</div><div>${this.esc(plan.feePlanCode || s1.feePlanCode || plan.name || '')}</div>
        <div class="kv-label">Discounts</div><div>Test Scholarship : ${Number(s1.testScholarshipPct || 0).toFixed(2)}% , Scholarship ${Number(s1.scholarshipPct || 0).toFixed(2)}% , Additional Scholarship ${Number(s1.additionalScholarshipPct || 0).toFixed(2)}%}</div>
      </div>
    </div>

    <div class="section">
      <table>
        <thead>
          <tr>
            <th style="width:40px;" class="text-center">S.No</th>
            <th style="width:120px;">Payment Date</th>
            <th style="width:130px;">Mode</th>
            <th>Fees For</th>
            <th>Payment in Favour of</th>
            <th style="width:140px;" class="text-right">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${splitRows.join('')}
        </tbody>
        <tfoot>
          <tr>
            <th colspan="5" class="text-right">Total</th>
            <th class="text-right">₹ ${total.toLocaleString('en-IN')}</th>
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

  printPaymentsAck(): void {
    if (this.step !== 2) {
      this.alert.error('Acknowledgement can be printed from Step 2 only.');
      return;
    }
    if (!this.submittedForAck) {
      this.alert.error(
        'Please submit payment details before printing acknowledgement.',
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
    this.openPrintWindow('Acknowledgement', html);
  }

  private computeFeeHeadPreview(
    plan: FeePlan | null,
    testPct: number,
    schlPct: number,
    addPct: number,
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
        const tax3 = this.roundRupee(fee3 * rate);
        outFee = fee3;
        outTax = tax3;
        scholBenefits = this.roundRupee(
          Math.max(0, fee0 + tax0 - (outFee + outTax)),
        );
      }
      return {
        label: h.label,
        fee: outFee,
        stax: outTax,
        total: this.roundRupee(outFee + outTax),
        scholBenefits: this.roundRupee(scholBenefits),
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

  private buildAcademicYearOptions(durationYears?: number): void {
    const now = new Date().getFullYear();
    const dur = Math.max(1, Number(durationYears || 0) || 1);
    const starts = [now - 1, now, now + 1];
    this.academicYearOptions = starts.map(
      (start) => `${start} - ${start + dur}`,
    );
    const cur = String(this.step1Form?.get('academicYear')?.value || '').trim();
    if (!cur || !this.academicYearOptions.includes(cur)) {
      setTimeout(() => {
        this.step1Form.patchValue(
          { academicYear: this.academicYearOptions[0] },
          { emitEvent: true },
        );
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
    return Math.round(n);
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

  private buildPaymentsAckHtmlStep2(plan: FeePlan | null): string {
    const s1 = this.step1Form.getRawValue();
    const today = new Date();

    const nefts = (this.neftRefsFA.getRawValue() || []) as any[];
    const cheques = (this.chequesFA.getRawValue() || []) as any[];

    const neftCount = nefts.filter((x) => (Number(x?.amount) || 0) > 0).length;
    const neftTotal = this.roundRupee(
      nefts.reduce((s, x) => s + (Number(x?.amount) || 0), 0),
    );

    const chequeCount = cheques.filter(
      (x) => (Number(x?.amount) || 0) > 0,
    ).length;
    const chequeTotal = this.roundRupee(
      cheques.reduce((s, x) => s + (Number(x?.amount) || 0), 0),
    );

    const totalPaid = this.roundRupee(neftTotal + chequeTotal);

    const studentName = String(s1.name || '');
    const regNo = String(s1.regNo || '');
    const programName = String(s1.programName || '');
    const feePlanName = String(
      plan?.name || plan?.feePlanCode || s1.feePlanCode || '',
    );
    const dateStr = today.toLocaleDateString('en-IN');

    const copyHtml = (title: string) => `
    <div class="ack-copy">
      <div class="copy-title">${title}</div>

      <div class="header">
        <img src="${this.esc(this.PRINT_LOGO_URL)}" class="logo" />
        <div class="inst-name">ZEDSWEVEN I PRIVATE LIMITED, Coimbatore</div>
      </div>
      <div class="ack-title">ACKNOWLEDGEMENT</div>
      <div class="row"><b>Date:</b> ${dateStr}</div>
      <div class="para">
        Received the below mentioned Payments towards the Enrolment for
        <b>${this.esc(studentName)}</b><br/>
        with Reg No: <b>${this.esc(regNo)}</b> &amp;
        Enrolling For Program <b>${this.esc(programName)}</b>
      </div>
      <div class="para">
        Fee Plan Opted: <b>${this.esc(feePlanName)}</b>
      </div>
      <table class="pay-table">
        <thead>
          <tr>
            <th>Payment Mode</th>
            <th>Total No of Payments</th>
            <th>Total Amount in Rs.</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>UPI / DD / NEFT</td>
            <td class="center">${neftCount}</td>
            <td class="right">${neftTotal}</td>
          </tr>
          <tr>
            <td>Post Dated Cheques</td>
            <td class="center">${chequeCount}</td>
            <td class="right">${chequeTotal}</td>
          </tr>
          <tr class="total-row">
            <td colspan="2"><b>Total Value of Payments Submitted</b></td>
            <td class="right"><b>${totalPaid}</b></td>
          </tr>
        </tbody>
      </table>
      <div class="docs">
        Please ensure the below mentioned documents are also submitted:
        <ol>
          <li>Z-SAT Exam Hall Ticket in Original</li>
          <li>Student ID Proof (Xerox Copy)</li>
          <li>Offer Letter Copy (Print out Taken from Result Website)</li>
          <li>Enrolment form in filled Manner/li>
          <li>Passport size photograph of student & parent as mentioned in the enrolment form.</li>
        </ol>
      </div>
      <div class="note">
        <b>Note:</b> This is not an Enrolment FEE Receipt.<br/>
        Proper Enrolment Report will be provided at a later stage along with an enrolment Number.
      </div>
      <div class="sign">Authorised Signatory</div>
      <div class="contact">
        For any support on a later stage please contact us on contact 9159241133 / 9626292233
      </div>
      <div class="inst-name" style="margin-top : 25px">ZEDSWEVEN I PRIVATE LIMITED, Coimbatore</div>
        <div class="inst-addr">
          47D2, Nehru Nagar West, Civil Aerodrome Post,
          Kalapatti Road, Coimbatore - 641014
        </div>
    </div>
  `;
    return `
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: Arial, sans-serif; font-size: 11px; }
    .sheet {
      display: flex;
      gap: 10mm;
    }
    .ack-copy {
      width: 50%;
      padding: 6mm;
      box-sizing: border-box;
    }
    .divider {
      border-left: 2px dashed #000;
    }
    .copy-title {
      font-weight: 700;
      margin-bottom: 4px;
    }
    .header {
      text-align: center;
    }
    .logo {
      height: 40px;
      margin-bottom: 4px;
    }
    .inst-name {
      font-weight: 700;
    }
    .inst-addr {
      font-size: 10px;
      margin-bottom: 6px;
    }
    .ack-title {
      text-align: center;
      font-weight: 800;
      margin: 20px 0;
      text-decoration: underline;
    }
    .row { margin: 10px 0; }
    .para { margin: 10px 0; }
    .pay-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    .pay-table th,
    .pay-table td {
      border: 1px solid #000;
      padding: 6px;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .docs { margin-top: 6px; }
    .note { margin-top: 6px; font-weight: 600; }
    .sign {
      margin-top: 30px;
      text-align: right;
    }
    .contact {
      margin-top: 6px;
      font-size: 10px;
    }
  </style>

  <div class="sheet">
    ${copyHtml('OFFICE COPY')}
    <div class="divider"></div>
    ${copyHtml('PARENT COPY')}
  </div>
  `;
  }

  private buildDiscountedInstalmentsFromPlan(plan: FeePlan): Array<{
    seq: number;
    feeHead: string;
    label: string;
    instalmentDate: number;
    amount: number;
    mode: string;
    chequeFavour: string;
    discountApplied: boolean;
  }> {
    const s1 = this.step1Form.getRawValue();

    const testPct = Number(s1.testScholarshipPct || 0) || 0;
    const schlPct = Number(s1.scholarshipPct || 0) || 0;
    const addPct = Number(s1.additionalScholarshipPct || 0) || 0;

    // Build discounted totals per feeHead key (we mainly need TF)
    const discountedTotalsByKey = this.computeDiscountedTotalsByFeeHeadKey(
      plan,
      testPct,
      schlPct,
      addPct,
    );

    // Original totals per feeHead key from feeHeads
    const originalTotalsByKey: Record<string, number> = {};
    (plan.feeHeads || []).forEach((h) => {
      const key = String(h.key || '').trim();
      const total = (Number(h.fee || 0) || 0) + (Number(h.stax || 0) || 0);
      originalTotalsByKey[key] = total;
    });

    const tfKey = this.findDiscountFeeHeadKey(plan); // usually TF
    const origTF = Number(originalTotalsByKey[tfKey] || 0);
    const discTF = Number(discountedTotalsByKey[tfKey] || 0);

    // factor to distribute discounted TF total across all TF instalments
    const tfFactor = origTF > 0 ? discTF / origTF : 1;

    const discounted = (plan.instalments || []).map((ins) => {
      const feeHead = String(ins.feeHead || '').trim();
      const discountApplied = !!ins.discountApplied;

      let amt = Number(ins.amount || 0) || 0;

      // Apply discount ONLY when discountApplied is true
      if (discountApplied && feeHead === tfKey) {
        amt = this.roundRupee(amt * tfFactor);
      }

      return {
        seq: Number(ins.seq || 0) || 0,
        feeHead,
        label: String(ins.label || '').trim(),
        instalmentDate: Number(ins.instalmentDate || 0) || 0,
        amount: this.roundRupee(amt),
        mode: String(ins.mode || 'PDC').trim(),
        chequeFavour: String(ins.chequeFavour || this.DEFAULT_FAVOUR_OF).trim(),
        discountApplied,
      };
    });

    // ✅ requested verification log
    console.log('[Admission] Discounted instalments:', discounted);

    return discounted;
  }

  private findDiscountFeeHeadKey(plan: FeePlan): string {
    // Prefer discountAllowed feehead (your backend already sends it)
    const byFlag =
      (plan.feeHeads || []).find((h) => !!h.discountAllowed)?.key || '';
    if (byFlag) return String(byFlag).trim();

    // fallback old heuristic
    const byName =
      (plan.feeHeads || []).find((h) =>
        String(h.label || '')
          .toLowerCase()
          .includes('tuition'),
      )?.key || '';

    return String(byName || 'TF').trim();
  }

  private computeDiscountedTotalsByFeeHeadKey(
    plan: FeePlan,
    testPct: number,
    schlPct: number,
    addPct: number,
  ): Record<string, number> {
    const clamp = (v: number) => Math.max(0, Math.min(100, Number(v || 0)));

    const p1 = clamp(testPct);
    const p2 = clamp(schlPct);
    const p3 = clamp(addPct);

    const applyPct = (amount: number, pct: number) => {
      const out = Math.round(amount * (1 - pct / 100));
      return out < 0 ? 0 : out;
    };

    const out: Record<string, number> = {};
    const tfKey = this.findDiscountFeeHeadKey(plan);

    (plan.feeHeads || []).forEach((h) => {
      const key = String(h.key || '').trim();
      const fee0 = Number(h.fee || 0) || 0;
      const tax0 = Number(h.stax || 0) || 0;
      const rate = fee0 > 0 ? tax0 / fee0 : 0;
      let outFee = fee0;
      let outTax = tax0;
      const isDiscountAllowed = !!h.discountAllowed;
      const isTuition = key === tfKey;
      if (isDiscountAllowed && isTuition) {
        const fee1 = applyPct(outFee, p1);
        const tax1 = Math.round(fee1 * rate);
        const fee2 = applyPct(fee1, p2);
        const tax2 = Math.round(fee2 * rate);
        const fee3 = applyPct(fee2, p3);
        const tax3 = Math.round(fee3 * rate);
        outFee = fee3;
        outTax = tax3;
      }

      out[key] = this.roundRupee(outFee + outTax);
    });

    return out;
  }

  private groupInstalmentsByDate(
    insts: Array<{
      instalmentDate: number;
      label: string;
      amount: number;
      mode: string;
      chequeFavour: string;
    }>,
  ) {
    const map = new Map<
      number,
      {
        instalmentDate: number;
        amount: number;
        labels: string[];
        mode: string;
        favourOf: string;
      }
    >();
    for (const it of insts) {
      const dt = Number(it.instalmentDate || 0) || 0;
      const cur = map.get(dt);
      if (!cur) {
        map.set(dt, {
          instalmentDate: dt,
          amount: Number(it.amount || 0) || 0,
          labels: [String(it.label || '').trim()].filter(Boolean),
          mode: String(it.mode || 'PDC').trim(),
          favourOf: String(it.chequeFavour || this.DEFAULT_FAVOUR_OF).trim(),
        });
      } else {
        cur.amount += Number(it.amount || 0) || 0;
        const lbl = String(it.label || '').trim();
        if (lbl) cur.labels.push(lbl);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => (a.instalmentDate || 0) - (b.instalmentDate || 0),
    );
  }

  private buildPaymentsFromFeePlanInstalments(plan: FeePlan): void {
    const discountedInsts = this.buildDiscountedInstalmentsFromPlan(plan);
    const neftItems = discountedInsts.filter(
      (x) => Number(x.instalmentDate || 0) === 0,
    );
    const chequeItems = discountedInsts.filter(
      (x) => Number(x.instalmentDate || 0) !== 0,
    );
    this.chequeAllowedByDate.clear();
    chequeItems.forEach((x) => {
      const dt = Number(x.instalmentDate || 0) || 0;
      const prev = Number(this.chequeAllowedByDate.get(dt) || 0) || 0;
      this.chequeAllowedByDate.set(dt, prev + (Number(x.amount || 0) || 0));
    });
    const neftAmt = this.roundRupee(
      neftItems.reduce((s, x) => s + (Number(x.amount || 0) || 0), 0),
    );
    this.step2Form.get('neftAmount')?.setValue(neftAmt, { emitEvent: false });
    const neftFA = this.fb.array([]) as UntypedFormArray;
    if (neftAmt > 0) {
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
          paidOn: [new Date().toISOString().split('T')[0], Validators.required],
          bankName: [''],
          branchName: [''],
          referenceNote: [''],
          remarks: [''],
        }),
      );
    }
    this.step2Form.setControl('neftRefs', neftFA);
    const grouped = this.groupInstalmentsByDate(chequeItems);
    const chqFA = this.fb.array([]) as UntypedFormArray;
    grouped.forEach((g, idx) => {
      const desc = Array.from(new Set(g.labels)).join(', ');
      const rowData = {
        sno: idx + 1,
        description: desc,
        instalmentDate: g.instalmentDate,
        amount: this.roundRupee(g.amount),
        favourOf: g.favourOf || this.DEFAULT_FAVOUR_OF,
        mode: String(g.mode || 'PDC').toUpperCase() === 'CDC' ? 'CDC' : 'PDC',
        chequeDate: null,
        chequeNo: '',
        bankName: '',
        branchName: '',
        remarks: '',
      };
      chqFA.push(this.createChequeFormGroup(rowData));
    });

    this.step2Form.setControl('cheques', chqFA);
    this.bindChequeSplitValidator();
  }

  addOtherPaymentRow(): void {
    this.otherPaymentsFA.push(
      this.fb.group({
        mode: ['UPI', [Validators.required]],
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

  toggleAdditionalPayments(ev: any): void {
    const on = !!ev?.target?.checked;
    this.step2Form.patchValue(
      { additionalPaymentsEnabled: on },
      { emitEvent: false },
    );
    if (!on) {
      while (this.otherPaymentsFA.length) this.otherPaymentsFA.removeAt(0);
      return;
    }

    if (this.otherPaymentsFA.length === 0) this.addOtherPaymentRow();
  }

  private dateInputToEpoch(v: any): number | null {
    const s = String(v || '').trim();
    if (!s) return null;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const yyyy = Number(m[1]);
      const mm = Number(m[2]) - 1;
      const dd = Number(m[3]);
      const dt = new Date(yyyy, mm, dd, 0, 0, 0, 0);
      return dt.getTime();
    }
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.getTime();
    return null;
  }

  private normalizeTestInfoForPayload(testInfo: any): any {
    const t = { ...(testInfo || {}) };
    if (t.testDate !== undefined)
      t.testDate = this.dateInputToEpoch(t.testDate);
    return t;
  }

  splitChequeRow(i: number): void {
    const row = this.chequesFA.at(i) as UntypedFormGroup;
    if (!row) return;

    const due = Number(row.get('instalmentDate')?.value || 0) || 0;
    if (!due) {
      this.alert.error('Instalment date missing.');
      return;
    }
    row.get('amount')?.enable({ emitEvent: false });
    const g = this.fb.group({
      sno: [this.chequesFA.length + 1],
      description: [row.get('description')?.value || ''],
      instalmentDate: [due, [Validators.required]],
      amount: [0, [Validators.required, Validators.min(1)]], // split amount
      favourOf: [
        {
          value: row.get('favourOf')?.value || this.DEFAULT_FAVOUR_OF,
          disabled: true,
        },
        [Validators.required],
      ],
      mode: [row.get('mode')?.value || 'PDC', [Validators.required]],
      chequeDate: [null, [Validators.required]],
      chequeNo: [
        '',
        [
          Validators.required,
          Validators.minLength(6),
          Validators.maxLength(20),
        ],
      ],
      bankName: ['', [Validators.required]],
      branchName: [''], // ✅ NEW
      remarks: [''],
    });

    this.chequesFA.push(g);
    this.chequesFA.updateValueAndValidity();
  }

  private chequeSplitValidator(): ValidatorFn {
    return (ctrl: AbstractControl): ValidationErrors | null => {
      const fa = ctrl as UntypedFormArray;
      const rows = (fa?.getRawValue?.() || []) as any[];
      if (!rows.length) return null;

      // sum amounts by instalmentDate
      const sumByDate = new Map<number, number>();
      for (const r of rows) {
        const dt = Number(r?.instalmentDate || 0) || 0;
        const amt = Number(r?.amount || 0) || 0;
        if (!dt || amt <= 0) continue;
        sumByDate.set(dt, (sumByDate.get(dt) || 0) + amt);
      }

      // compare with allowed map
      for (const [dt, sum] of sumByDate.entries()) {
        const allowed = Number(this.chequeAllowedByDate.get(dt) || 0) || 0;
        if (allowed > 0 && this.roundRupee(sum) > this.roundRupee(allowed)) {
          return { chequeSplitExceed: { instalmentDate: dt, sum, allowed } };
        }
      }

      return null;
    };
  }

  private bindChequeSplitValidator(): void {
    const fa = this.chequesFA;
    fa.setValidators([this.chequeSplitValidator()]);
    fa.updateValueAndValidity({ emitEvent: false });
  }

  private neftSumNotExceedSplitValidator(): ValidatorFn {
    return (ctrl: AbstractControl): ValidationErrors | null => {
      const fa = ctrl as UntypedFormArray;
      const rows = (fa?.getRawValue?.() || []) as any[];
      const entered = (rows || []).reduce(
        (s, r) => s + (Number(r?.amount) || 0),
        0,
      );
      const split =
        Number(this.step2Form?.getRawValue?.()?.neftAmount ?? 0) || 0;
      if (!split) return null;
      return entered > split ? { neftSumExceed: { entered, split } } : null;
    };
  }

  private bindStep2NeftValidator(): void {
    const fa = this.neftRefsFA;
    fa.setValidators([this.neftSumNotExceedSplitValidator()]);
    fa.updateValueAndValidity({ emitEvent: false });
    this.step2Form
      .get('neftAmount')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.neftRefsFA.updateValueAndValidity({ emitEvent: false });
      });
  }

  private buildCourseStartYearOptions(): void {
    const cy = new Date().getFullYear();
    const years = [cy - 1, cy, cy + 1];
    this.courseStartYearOptions = years.map((y) => ({
      label: String(y),
      value: String(y),
    }));
    if (!this.step1Form.get('courseStartYear')?.value) {
      setTimeout(() => {
        this.step1Form.patchValue(
          { courseStartYear: String(cy) },
          { emitEvent: false },
        );
      });
    }
  }

  get neftError(): string | null {
    const required = Number(this.step2Form.getRawValue().neftAmount || 0);
    if (required === 0) return null;
    const entered = (this.neftRefsFA.getRawValue() || []).reduce(
      (s: number, r: any) => s + (Number(r.amount) || 0),
      0,
    );
    if (entered < required)
      return `Short by ₹${this.roundRupee(required - entered)}`;
    if (entered > required)
      return `Exceeds by ₹${this.roundRupee(entered - required)}`;
    return null;
  }

  onSplitCheckboxChange(idx: number, event: any): void {
    if (event.target.checked) {
      this.openSplitModal(idx);
      event.target.checked = false;
    }
  }

  openSplitModal(index: number): void {
    const row = this.chequesFA.at(index).getRawValue();
    this.splitRowIndex = index;
    this.splitOriginalAmount = row.amount;
    this.splitForm.patchValue({
      originalAmount: row.amount,
      splitAmount: 0,
      splitMode: 'NEFT',
      remarks: `Split from ${row.description}`,
    });
    this.splitModalInstance = new bootstrap.Modal(
      this.splitModalRef.nativeElement,
    );
    this.splitModalInstance.show();
  }

  private createChequeFormGroup(data: any): UntypedFormGroup {
    return this.fb.group({
      sno: [data.sno],
      description: [data.description],
      instalmentDate: [data.instalmentDate, [Validators.required]],
      amount: [
        { value: this.roundRupee(data.amount), disabled: true },
        [Validators.required, Validators.min(1)],
      ],
      favourOf: [
        { value: data.favourOf || this.DEFAULT_FAVOUR_OF, disabled: true },
        [Validators.required],
      ],
      mode: [data.mode, [Validators.required]],
      chequeDate: [data.chequeDate, [Validators.required]],
      chequeNo: [
        data.chequeNo,
        [
          Validators.required,
          Validators.minLength(6),
          Validators.maxLength(20),
        ],
      ],
      bankName: [data.bankName, [Validators.required]],
      branchName: [data.branchName],
      remarks: [data.remarks],
      isSplit: [false],
    });
  }

  private reindexCheques(): void {
    this.chequesFA.controls.forEach((control, index) => {
      control.patchValue({ sno: index + 1 }, { emitEvent: false });
    });
  }

  saveSplit(): void {
    if (this.splitForm.invalid) {
      this.splitForm.markAllAsTouched();
      return;
    }
    const { splitAmount, splitMode, remarks } = this.splitForm.getRawValue();
    const currentControl = this.chequesFA.at(
      this.splitRowIndex,
    ) as UntypedFormGroup;
    const currentValues = currentControl.getRawValue();
    const originalAmt = Number(currentValues.amount || 0);
    const splitAmt = Number(splitAmount || 0);
    const balanceAmt = originalAmt - splitAmt;
    if (balanceAmt <= 0) {
      this.alert.error(
        'Split amount must be less than the installment amount.',
      );
      return;
    }
    currentControl.patchValue({ amount: balanceAmt });
    currentControl.get('amount')?.setValue(balanceAmt);
    const splitRowData = {
      ...currentValues,
      amount: splitAmt,
      mode: splitMode,
      chequeNo: '',
      chequeDate: null,
      bankName: '',
      branchName: '',
      remarks: remarks || `Split from ${originalAmt}`,
      description: `${currentValues.description} (Split)`,
      isSplit: false,
    };
    const splitFG = this.createChequeFormGroup(splitRowData);
    this.chequesFA.insert(this.splitRowIndex + 1, splitFG);
    this.reindexCheques();
    this.selectedChequeIndices.clear();
    this.rebuildAllowedMap();
    this.step2Form.updateValueAndValidity();
    this.splitModalInstance.hide();
    this.alert.success(
      'Installment split. Please fill details for the new row.',
    );
  }

  readonly otherTotal$ = () =>
    this.otherPaymentsFA.valueChanges.pipe(
      startWith(this.otherPaymentsFA.getRawValue()),
      map((rows: any[]) =>
        this.roundRupee(
          (rows || []).reduce((s, r) => s + (Number(r?.amount) || 0), 0),
        ),
      ),
      shareReplay(1),
    );

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
    if (idx !== undefined) {
      this.openSplitModal(idx);
    }
  }

  mergeSelectedCheques(): void {
    const indices = Array.from(this.selectedChequeIndices).sort(
      (a, b) => a - b,
    );
    if (indices.length < 2) return;
    const selectedRowsData = indices.map((i) =>
      this.chequesFA.at(i).getRawValue(),
    );
    const minDate = selectedRowsData.reduce(
      (min, curr) => {
        const d = Number(curr.instalmentDate || 0);
        return d < min && d > 0 ? d : min;
      },
      Number(selectedRowsData[0].instalmentDate || 0),
    );
    const totalAmount = selectedRowsData.reduce(
      (sum, curr) => sum + (Number(curr.amount) || 0),
      0,
    );
    const baseRow = selectedRowsData[0];
    const mergedData = {
      ...baseRow,
      instalmentDate: minDate,
      amount: totalAmount,
      chequeNo: '',
      chequeDate: null,
      remarks: `Merged ${indices.length} installments`,
      description: `Merged Installment`,
    };
    for (let i = indices.length - 1; i >= 0; i--) {
      this.chequesFA.removeAt(indices[i]);
    }
    const insertIndex = indices[0];
    this.chequesFA.insert(insertIndex, this.createChequeFormGroup(mergedData));
    this.selectedChequeIndices.clear();
    this.reindexCheques();
    this.rebuildAllowedMap();
    this.step2Form.updateValueAndValidity();
    this.alert.success(`Merged. Please fill details for the new row.`);
  }

  resetCheques(): void {
    const planId = this.step1Form.get('feePlanId')?.value;
    const plan = this.feePlansSub.getValue().find((p) => p.id === planId);
    if (plan) {
      this.buildPaymentsFromFeePlanInstalments(plan);
      this.selectedChequeIndices.clear();
      this.alert.success('Installments reset to initial fee plan.');
    } else {
      this.alert.error('Fee Plan not found. Cannot reset.');
    }
  }

  private rebuildAllowedMap(): void {
    const rows = this.chequesFA.getRawValue();
    this.chequeAllowedByDate.clear();
    rows.forEach((r: any) => {
      const dt = Number(r.instalmentDate || 0);
      const amt = Number(r.amount || 0);
      if (dt > 0 && amt > 0) {
        const prev = this.chequeAllowedByDate.get(dt) || 0;
        this.chequeAllowedByDate.set(dt, prev + amt);
      }
    });
    this.chequesFA.updateValueAndValidity({ emitEvent: false });
  }

  get canSubmitPayments(): boolean {
    return (
      !this.submitting &&
      !this.loading &&
      !!this.admissionId &&
      !this.submittedForAck &&
      this.step === 2 &&
      !this.neftError &&
      this.step2Form.valid
    );
  }

  get canSendForApproval(): boolean {
    return (
      !this.submitting &&
      !!this.admissionId &&
      !this.approvalSent
    );
  }
}
