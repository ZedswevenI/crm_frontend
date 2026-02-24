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

@Component({
  selector: 'app-admissions',
  standalone: false,
  templateUrl: './admissions.component.html',
  styleUrl: './admissions.component.scss',
})
export class AdmissionsComponent implements OnInit {
  step: 0 | 1 | 2 = 0;
  directMode: 'NONE' | 'NO_TEST' | 'WITH_TEST' = 'NONE';
  discountOptions = Array.from({ length: 21 }, (_, i) => i * 5);
  lookupForm!: UntypedFormGroup;
  step1Form!: UntypedFormGroup;
  step2Form!: UntypedFormGroup;
  loading = false;
  submittedForAck = false;
  submitting = false;
  feeCalcGenerated = false;
  approvalSent = false;
  isDirectEnrolment = false;
  portal: PortalStudentResult | null = null;
  programs: ProgramItem[] = [];
  feePlans: FeePlan[] = [];
  programsLoading = false;
  feePlansLoading = false;
  admissionId: string | null = null;
  centers: CenterItem[] = [];
  centersLoading = false;
  academicYearOptions: string[] = [];
  testInfo = {};
  readonly DEFAULT_FAVOUR_OF = 'ZEDSWEVEN I PRIVATE LIMITED';
  readonly PRINT_LOGO_URL = 'assets/logo.png';
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

    this.step1Form.get('phone')?.valueChanges.subscribe((v) => {
      const phone = String(v || '').trim();
      const cur = String(this.step1Form.get('parentPhone')?.value || '').trim();
      if (phone && phone !== cur) {
        this.step1Form
          .get('parentPhone')
          ?.setValue(phone, { emitEvent: false });
      }
    });

    this.step2Form = this.fb.group({
      neftAmount: [{ value: 0, disabled: true }],
      neftRefs: this.fb.array([]),
      cheques: this.fb.array([]),
    });

    this.loadPrograms();
    this.loadCenters();
    this.buildAcademicYearOptions();
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

  private uuidv4(): string {
    const c: any = (window as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
      const r = (Math.random() * 16) | 0;
      const v = ch === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
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
    this.feePlans = [];
    this.resetWorkflowFlags();
    this.buildEmptyPayments();
    this.step = 1;

    this.alert.success('Direct enrolment started (RegNo auto generated).');
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
    this.api.fetchData(body, 'admi', 'portal/fetch').subscribe({
      next: (res: any) => {
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
      },
      error: (err) => {
        this.loading = false;
        this.alert.error(`${err?.error?.message || 'Fetch failed'}`);
      },
    });
  }

  private pickTenantId(): string {
    const entiId =
      (localStorage.getItem('entiId') || '').trim() ||
      (localStorage.getItem('tenantId') || '').trim();
    return entiId;
  }

  private buildAcademicYearOptions(): void {
    const base = new Date().getFullYear();
    this.academicYearOptions = [1, 2, 3, 4].map((n) => `${base} - ${base + n}`);
    const cur = String(this.step1Form.get('academicYear')?.value || '').trim();
    if (!cur) {
      this.step1Form.patchValue(
        { academicYear: this.academicYearOptions[0] },
        { emitEvent: true }
      );
    }
  }

  private loadCenters(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }
    this.centersLoading = true;
    const body: any = { entiId: tenantId };
    this.api.fetchData(body, 'ims/center', 'list?list=full').subscribe({
      next: (res: any) => {
        this.centersLoading = false;

        if (!res?.status) {
          this.alert.error(
            res?.message || res?.error || 'Failed to load centers'
          );
          this.centers = [];
          return;
        }
        const arr = Array.isArray(res?.data) ? res.data : [];
        this.centers = arr
          .map((x: any) => ({
            centerId: String(x.centerId || x._id || x.id || '').trim(),
            centerName: String(x.centerName || x.name || '').trim(),
            centerCode: x.centerCode ? String(x.centerCode).trim() : '',
          }))
          .filter((c: CenterItem) => !!c.centerId && !!c.centerName);
        const cur = String(this.step1Form.get('centerId')?.value || '').trim();
        if (!cur && this.centers.length === 1) {
          this.onCenterChanged(this.centers[0].centerId);
        }
      },
      error: () => {
        this.centersLoading = false;
        this.centers = [];
        this.alert.error('Failed to load centers');
      },
    });
  }

  public onCenterChanged(centerId: any): void {
    const id = String(centerId || '').trim();
    const c = this.centers.find((x) => x.centerId === id) || null;
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
          .map((x: any) => {
            const programId = String(x.programId || x._id || x.id || '').trim();
            const programName = String(x.programName || x.name || '').trim();
            const programCode = String(x.programCodes).trim();
            return {
              programId,
              programName,
              programCode,
              centerId: x.centerId ? String(x.centerId).trim() : '',
              centerName: x.centerName ? String(x.centerName).trim() : '',
            };
          })
          .filter((p: ProgramItem) => !!p.programId && !!p.programName);
        if (
          this.portal ||
          this.pendingPortalProgramCode ||
          this.pendingPortalProgramName
        ) {
          this.tryMapProgramFromPortal();
        }
      },
      error: () => {
        this.programsLoading = false;
        this.programs = [];
        this.alert.error('Failed to load programs');
      },
    });
  }

  private pendingPortalProgramCode: string | null = null;
  private pendingPortalProgramName: string | null = null;

  private normCode(v: any): string {
    return String(v ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
  }

  private mapProgramByCode(programCodeRaw: any): void {
    const code = this.normCode(programCodeRaw);
    if (!code) return;
    if (this.programsLoading || !this.programs || this.programs.length === 0) {
      this.pendingPortalProgramCode = code;
      return;
    }
    const match =
      this.programs.find((p) => this.normCode(p.programCode) === code) || null;
    if (!match) {
      this.alert.error(
        'Program is not created. Please create the program and retry.'
      );
      this.step1Form.patchValue(
        {
          programId: '',
          programName: '',
          programCode: String(programCodeRaw || '').trim(),
          feePlanId: '',
          feePlanCode: '',
        },
        { emitEvent: false }
      );
      this.feePlans = [];
      this.step1Form.get('baseFee')?.setValue(0, { emitEvent: false });
      this.step = 0;
      return;
    }
    this.applyProgramSelection(match);
  }

  private applyProgramSelection(p: ProgramItem | null): void {
    if (!p) return;
    this.step1Form
      .get('programId')
      ?.setValue(p.programId, { emitEvent: false });
    this.step1Form.patchValue(
      {
        programName: p.programName || '',
        programCode: p.programCode || '',
      },
      { emitEvent: false }
    );
    this.onProgramChanged(p.programId);
  }

  private norm(v: any): string {
    return String(v ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[-_/]/g, '');
  }

  private tryMapProgramFromPortal(): void {
    if (!this.portal) return;
    const portalCode = this.norm(this.portal.programCode);
    const portalName = this.norm(this.portal.programName);
    if (this.programsLoading || !this.programs.length) {
      this.pendingPortalProgramCode = portalCode || null;
      this.pendingPortalProgramName = portalName || null;
      return;
    }
    let match = portalCode
      ? this.programs.find((p) => this.norm(p.programCode) === portalCode) ??
        null
      : null;
    if (!match && portalName) {
      match =
        this.programs.find((p) => this.norm(p.programName) === portalName) ??
        null;
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
      this.feePlans = [];
      this.step1Form.get('baseFee')?.setValue(0, { emitEvent: false });
      return;
    }
    this.step1Form.patchValue(
      {
        programId: match.programId,
        programName: match.programName,
        programCode:
          match.programCode && match.programCode.trim()
            ? match.programCode
            : this.portal?.programCode || '',
      },
      { emitEvent: true }
    );
    this.pendingPortalProgramCode = null;
    this.pendingPortalProgramName = null;
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
            instalments: Array.isArray(x.instalments)
              ? x.instalments.map((i: any) => ({
                  seq: Number(i.seq || 0) || 0,
                  label: String(i.label || `Instalment ${i.seq || ''}`).trim(),
                  amount: Number(i.amount || 0) || 0,
                  dueDate: i.label ? String(i.label).trim() : null,
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
    this.loadFeePlans();
    this.resetWorkflowFlags();
  }

  public onProgramChanged(programId: any): void {
    const pid = String(programId || '').trim();
    const p = this.programs.find((x) => x.programId === pid) || null;
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
          console.log('this is the error block received');
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
      },
      error: (err) => {
        console.log(err);
        this.loading = false;
        if (this.handleAdmissionAlreadyExists(err?.error)) return;
        this.alert.error(err?.error?.message || err?.message || 'Fetch failed');
      },
    });
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

  goToLookup(): void {
    this.step = 0;
    this.resetWorkflowFlags();
  }

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
    if (!heads.length) return [];
    const testPct = this.testScholarshipPct || 0;
    const schlPct = this.scholarshipPct || 0;
    const addPct = this.additionalScholarshipPct || 0;
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
    if (scaled.length) {
      rows.push({
        label: instals[0]?.label || 'Advance (NEFT)',
        amount: scaled[0] || 0,
        type: 'NEFT',
      });
    }
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
    const target = this.roundRupee(targetTotal); // <-- key
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
        finalFee: Number(this.finalFee || 0),
        testScholarshipPct:
          this.directMode === 'WITH_TEST'
            ? 0
            : Number(this.testScholarshipPct || 0),
        scholarshipPct: Number(this.scholarshipPct || 0),
        additionalScholarshipPct: Number(this.additionalScholarshipPct || 0),
        totalDiscountPct: Number(this.totalDiscountPct || 0),
        breakup: this.feeHeadPreview.map((x) => ({
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
        const dueRupee = this.roundRupee(this.finalFee);
        this.buildPaymentsFromFinalFee(dueRupee);
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

  private buildPaymentsFromFinalFee(finalFee: number): void {
    const plan = this.selectedPlan;
    console.log('plan ', plan);
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
    const today = this.todayISO();
    const chqFA = this.fb.array([]) as UntypedFormArray;
    const instals = (plan?.instalments || []).slice(1);
    chequeAmounts.forEach((amt, idx) => {
      const sno = idx + 1;
      const dueFromPlan = this.toDateInputISO(
        instals[idx]?.dueDate ? String(instals[idx].dueDate) : null
      );
      console.log(idx, dueFromPlan);
      chqFA.push(
        this.fb.group({
          sno: [sno],
          chequeDate: [
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
      console.log(chqFA);
    });
    this.step2Form.setControl('cheques', chqFA);
  }

  get totalCollected(): number {
    return (this.neftTotalEntered || 0) + (this.chequeTotal || 0);
  }

  get balanceAmount(): number {
    const due = Math.round(this.finalFee || 0);
    const paid = Math.round(this.totalCollected || 0);
    return Math.max(0, due - paid);
  }

  get isL1(): boolean {
    const role = (localStorage.getItem('userRole') || '').trim().toUpperCase();
    return role === 'L1';
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
    const totalPaid = entered + this.chequeTotal;
    const totalDue = this.roundRupee(this.finalFee || 0);
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

  private toDateInputISO(v: any): string | null {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(v).trim())) return String(v).trim();
    const s = String(v).trim();
    const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (isoMatch?.[1]) return isoMatch[1];
    const dm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dm) {
      const dd = dm[1].padStart(2, '0');
      const mm = dm[2].padStart(2, '0');
      const yyyy = dm[3];
      return `${dd}-${mm}-${yyyy}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${dd}-${mm}-${yyyy}`;
    }
    return null;
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
    const a = Math.max(0, Math.min(100, this.testScholarshipPct || 0)) / 100;
    const b = Math.max(0, Math.min(100, this.scholarshipPct || 0)) / 100;
    const c =
      Math.max(0, Math.min(100, this.additionalScholarshipPct || 0)) / 100;
    const eff = 1 - (1 - a) * (1 - b) * (1 - c);
    return Math.round(eff * 10000) / 100;
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
      .brand {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        gap: 10px;
        margin-bottom: 8px;
      }
      .brand img {
        height: 42px;
        width: auto;
        object-fit: contain;
        display: block;
      }
      .print-header { margin-bottom: 10px; border-bottom: 2px solid #111827; padding-bottom: 8px; }
      .brand-center { display:flex; justify-content:center; align-items:center; margin-bottom: 6px; }
      .brand-center img { height: 46px; width:auto; object-fit:contain; display:block; }
      .title-wrap { text-align: center; }
      .meta-row { margin-top: 6px; display:flex; justify-content: space-between; font-size: 10px; }
      .sign-row { margin-top: 18px; display:flex; justify-content: flex-end; }
      .sign-box { width: 220px; text-align: center; }
      .sign-line { height: 24px; }
      .sign-label { margin-top: 4px; font-size: 14px; font-weight: 600; }
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

  private buildFeeCalcHtmlStep1(): string {
    const s1 = this.step1Form.getRawValue();
    const plan = this.selectedPlan;
    const today = new Date();
    if (this.step1Form.invalid || !plan) {
      return '<p>Step 1 details are incomplete. Please fill all required fields and select a fee plan.</p>';
    }
    const heads = this.feeHeadPreview;
    const finalFee = this.finalFee || 0;
    const testSch = this.testScholarshipPct;
    const schl = this.scholarshipPct;
    const addSchl = this.additionalScholarshipPct;
    const scholTotal = heads.reduce(
      (s, r) => s + Number(r.scholBenefits || 0),
      0
    );
    return `
    <div class="page">
      <!-- Header with centered logo -->
      <div class="print-header">
        <div class="brand-center">
          <img src="${this.esc(this.PRINT_LOGO_URL)}" alt="Logo" />
        </div>
        <div class="title-wrap">
          <div class="title-main">FEE CALCULATION SHEET</div>
          <div class="subtitle">Current Status : Please check the details carefully and sign.</div>
        </div>
        <div class="meta-row">
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
      <!-- Scholarship summary (removed Base Fee + Total Discount) -->
      <div class="section">
        <div class="section-title">Scholarship Details</div>
        <table>
          <tbody>
            <tr>
              <td>Test Scholarship (%)</td>
              <td class="text-right">${Number(testSch || 0).toFixed(2)}%</td>
            </tr>
            <tr>
              <td>Scholarship (%)</td>
              <td class="text-right">${Number(schl || 0).toFixed(2)}%</td>
            </tr>
            <tr>
              <td>Additional Scholarship (%)</td>
              <td class="text-right">${Number(addSchl || 0).toFixed(2)}%</td>
            </tr>
            <tr>
              <td><b>Total Scholarship Benefits</b></td>
              <td class="text-right"><b>₹ ${scholTotal.toLocaleString(
                'en-IN'
              )}</b></td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Final fee summary (instead of breakup) -->
      <div class="section">
        <div class="section-title">Final Fee Summary</div>
        <table>
          <tbody>
            <tr>
              <td><b>Final Fee (After Scholarships)</b></td>
              <td class="text-right"><b>₹ ${finalFee.toLocaleString(
                'en-IN'
              )}</b></td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Instalment Breakup -->
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
            ${this.buildInstallmentBreakupForStep1()}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="4" class="text-right">Total</th>
              <th class="text-right">₹ ${(this.finalFee || 0).toLocaleString(
                'en-IN'
              )}</th>
            </tr>
          </tfoot>
        </table>
      </div>
      <!-- Signature bottom-right -->
      <div class="sign-row">
        <div class="sign-box">
          <div class="sign-line"></div>
          <div class="sign-label">ENROLLMENT MANAGER</div>
        </div>
      </div>
    </div>
  `;
  }

  private buildInstallmentBreakupForStep1(): string {
    const plan = this.selectedPlan;
    const instals = plan?.instalments || [];
    if (!instals.length) {
      return `<tr><td colspan="4" class="text-center">No instalment structure available.</td></tr>`;
    }
    const baseAmounts = instals.map((i) => Number(i.amount) || 0);
    const baseTotal = baseAmounts.reduce((s, x) => s + (Number(x) || 0), 0);
    const scaled = this.scalePlan(baseAmounts, this.finalFee || 0, baseTotal);
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

  private buildPaymentsAckHtmlStep2(): string {
    const s1 = this.step1Form.getRawValue();
    const plan = this.selectedPlan;
    const today = new Date();
    const nefts = (this.neftRefsFA.getRawValue() || []) as any[];
    const cheques = (this.chequesFA.getRawValue() || []) as any[];
    const finalFee = this.finalFee || 0;
    const testSch = this.testScholarshipPct || 0;
    const schl = this.scholarshipPct || 0;
    const addSchl = this.additionalScholarshipPct || 0;
    const totalDisc = this.totalDiscountPct || 0;
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
    const totalPaid = (this.neftTotalEntered || 0) + (this.chequeTotal || 0);
    return `
    <div class="page">
      <div class="brand">
        <img src="${this.esc(this.PRINT_LOGO_URL)}" alt="Logo" />
      </div>
      <div class="header-row">
        <div>
          <div class="title-main">ACKNOWLEDGEMENT</div>
          <div class="subtitle">Provisional Admission Confirmation</div>
        </div>
        <div class="meta">
          <div><b>Date :</b> ${today.toLocaleDateString('en-IN')}</div>
        </div>
      </div>
      <!-- Part 1 -->
      <div class="section">
        <div class="section-title">Student, Program and Study Centre Details (Part 1)</div>
        <table>
          <tbody>
            <tr>
              <td>Registration No.</td>
              <td>${this.esc(s1.regNo || '')}</td>
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
      <!-- Scholarship Details (NEW) -->
      <div class="section">
        <div class="section-title">Scholarship Details</div>
        <table>
          <tbody>
            <tr>
              <td>Test Scholarship (%)</td>
              <td class="text-right">${Number(testSch).toFixed(2)}%</td>
            </tr>
            <tr>
              <td>Scholarship (%)</td>
              <td class="text-right">${Number(schl).toFixed(2)}%</td>
            </tr>
            <tr>
              <td>Additional Scholarship (%)</td>
              <td class="text-right">${Number(addSchl).toFixed(2)}%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Part 2 + 3 -->
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
              <th>Cheque/DD/UTR No.</th>
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
              <th colspan="4" class="text-right">Total payments captured</th>
              <th class="text-right">₹ ${totalPaid.toLocaleString('en-IN')}</th>
            </tr>
          </tfoot>
        </table>
      </div>
      <!-- Important + Signature row (NEW) -->
      <div class="section small">
        <div class="section-title">Important</div>
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div style="flex:1;">
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
      </div>
      <br>
      <div style="width:240px; text-align:right;">
        <div style="height:55px; border-bottom:1px solid #111827;"></div>
        <div class="tiny" style="margin-top:15px;">
          Authorized Signatory<br/>
        </div>
      </div>
    </div>
  `;
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

    const html = this.buildPaymentsAckHtmlStep2();
    this.openPrintWindow('Enrolment Report', html);
  }

  get alert$() {
    return this.alert.alert$;
  }

  clearAlert(): void {
    this.alert.clear();
  }

  cancel(): void {
    this.router.navigate(['/app/admissions']);
  }
}
