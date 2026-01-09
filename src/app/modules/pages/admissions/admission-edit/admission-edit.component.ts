import { Component, OnInit } from '@angular/core';
import {
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

type ChequeMode = 'PDC' | 'CDC';

interface ProgramItem {
  programId: string;
  programName: string;
  programCode?: string;
  centerId?: string;
  centerName?: string;
}

interface CenterItem {
  centerId: string;
  centerName: string;
  centerCode?: string;
}

interface FeePlan {
  id: string; // feePlanId (uuid string)
  name: string;
  feePlanCode?: string;
  instalments: Array<{ seq: number; label: string; amount: number; dueDate?: string | null }>;
  feeHeads: Array<{ key: string; label: string; fee: number; stax: number }>;
}

@Component({
  selector: 'app-admission-edit',
  standalone: false,
  templateUrl: './admission-edit.component.html',
  styleUrl: './admission-edit.component.scss'
})
export class AdmissionEditComponent implements OnInit {
  loading = false;
  saving = false;

  admissionId!: string;           // route param :id (uuid)
  tenantId!: string;

  // master data
  programs: ProgramItem[] = [];
  centers: CenterItem[] = [];
  feePlans: FeePlan[] = [];
  programsLoading = false;
  centersLoading = false;
  feePlansLoading = false;

  discountOptions = Array.from({ length: 21 }, (_, i) => i * 5);
  academicYearOptions: string[] = [];

  // forms
  step1Form!: UntypedFormGroup;
  step2Form!: UntypedFormGroup;

  // workflow
  currentStage: string | null = null;
  rejectionReason: string | null = null;

  readonly DEFAULT_FAVOUR_OF = 'ZEDSWEVEN I PRIVATE LIMITED';

  constructor(
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private api: CommonapiService
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Admissions' },
      { label: 'Edit Admission' },
    ]);
  }

  ngOnInit(): void {
    this.tenantId = this.pickTenantId();
    if (!this.tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }

    this.admissionId = String(this.route.snapshot.paramMap.get('id') || '').trim();
    if (!this.admissionId) {
      this.alert.error('Invalid admission id in URL.');
      return;
    }

    this.buildAcademicYearOptions();
    this.buildForms();

    // master loads
    this.loadPrograms();
    this.loadCenters();

    // fee plans depend on program + academic year
    this.step1Form.get('programId')?.valueChanges.subscribe(() => this.loadFeePlans());
    this.step1Form.get('academicYear')?.valueChanges.subscribe(() => this.loadFeePlans());
    this.step1Form.get('feePlanId')?.valueChanges.subscribe((id) => this.onFeePlanChanged(String(id || '').trim()));

    // reload fee calc preview when scholarship changes
    this.step1Form.get('scholarshipPct')?.valueChanges.subscribe(() => {});
    this.step1Form.get('additionalScholarshipPct')?.valueChanges.subscribe(() => {});
    this.step1Form.get('testScholarshipPct')?.valueChanges.subscribe(() => {});

    // load admission view and patch
    this.loadAdmissionView();
  }

  private buildForms(): void {
    this.step1Form = this.fb.group({
      admissionId: [{ value: this.admissionId, disabled: true }],
      academicYear: ['', Validators.required],
      sourceType: [''],
      registrationNumber: [{ value: '', disabled: true }],
      portalStudentId: [''],
      scholarshipTestId: [''],
      name: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      parentName: ['', Validators.required],
      parentPhone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      email: ['', [Validators.email]],
      centerId: ['', Validators.required],
      centerName: [''],
      programId: ['', Validators.required],
      programName: [''],
      programCode: [''],
      feePlanId: ['', Validators.required],
      feePlanName: [{ value: '', disabled: true }],
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
      if (phone && phone !== cur) this.step1Form.get('parentPhone')?.setValue(phone, { emitEvent: false });
    });

    this.step2Form = this.fb.group({
      neftAmount: [{ value: 0, disabled: true }],
      neftRefs: this.fb.array([]),
      cheques: this.fb.array([]),
    });
  }

  private buildAcademicYearOptions(): void {
    const base = new Date().getFullYear();
    this.academicYearOptions = [1, 2, 3, 4].map((n) => `${base} - ${base + n}`);
  }

  private pickTenantId(): string {
    return (
      (localStorage.getItem('entiId') || '').trim() ||
      (localStorage.getItem('tenantId') || '').trim()
    );
  }

  private loadAdmissionView(): void {
    this.loading = true;
    const body: any = { entiId: this.tenantId, admissionId: this.admissionId };
    this.api.fetchData(body, 'admi', 'view').subscribe({
      next: (res: any) => {
        this.loading = false;
        if (!res?.status) {
          this.alert.error(res?.message || res?.error || 'Failed to load admission');
          return;
        }
        const adm = res?.admission || res?.data?.admission || res?.data?.admissionInfo || res?.data?.admissionDetails || res?.admissionInfo || res?.data || null;
        const payments = Array.isArray(res?.payments) ? res.payments : (Array.isArray(res?.data?.payments) ? res.data.payments : []);
        if (!adm) {
          this.alert.error('Admission payload not found in response.');
          return;
        }
        this.currentStage = adm?.workflow?.stage || null;
        this.rejectionReason = adm?.workflow?.rejectionReason || null;
        this.step1Form.patchValue(
          {
            academicYear: adm.academicYear || '',
            sourceType: adm.sourceType || '',
            registrationNumber: adm.registrationNumber || '',
            portalStudentId: adm.portalStudentId || '',
            scholarshipTestId: adm.scholarshipTestId || '',
            name: adm?.student?.name || '',
            phone: adm?.student?.phone || '',
            parentName: adm?.student?.parentName || adm?.student?.fatherName || '',
            parentPhone: adm?.student?.parentPhone || adm?.student?.phone || '',
            email: adm?.student?.email || '',
            centerId: adm.centerId || '',
            centerName: adm.centerName || '',
            programId: adm.programId || '',
            programName: adm.programName || '',
            programCode: adm.programCode || '',
            feePlanId: adm.feePlanId || '',
            feePlanName: adm.feePlanName || '',
            feePlanCode: adm.feePlanCode || '',
            baseFee: Number(adm?.fee?.baseFee || 0),
            testScholarshipPct: Number(adm?.fee?.testScholarshipPct || 0),
            scholarshipPct: Number(adm?.fee?.scholarshipPct || 0),
            additionalScholarshipPct: Number(adm?.fee?.additionalScholarshipPct || 0),
            schoolOverallPct: adm?.schoolMarks?.overallPct ?? null,
            schoolCorePct: adm?.schoolMarks?.coreSubjectPct ?? null,
            schoolRemarks: adm?.schoolMarks?.remarks || '',
          },
          { emitEvent: false }
        );
        this.loadFeePlans(() => {
          const cur = String(this.step1Form.get('feePlanId')?.value || '').trim();
          this.onFeePlanChanged(cur);
        });
        this.buildPaymentsFromPaymentsArray(payments || [], Number(adm?.fee?.finalFee || 0));
        this.alert.success('Admission loaded. You can edit and resubmit for approval.');
      },
      error: () => {
        this.loading = false;
        this.alert.error('Failed to load admission');
      },
    });
  }

  private loadPrograms(): void {
    this.programsLoading = true;
    const body: any = { entiId: this.tenantId };
    this.api.fetchData(body, 'ims/program', 'list?list=full').subscribe({
      next: (res: any) => {
        this.programsLoading = false;
        if (!res?.status) {
          this.programs = [];
          return;
        }
        const arr = Array.isArray(res?.data) ? res.data : [];
        this.programs = arr
          .map((x: any) => ({
            programId: String(x.programId || x._id || x.id || '').trim(),
            programName: String(x.programName || x.name || '').trim(),
            programCode: String(x.programCodes || x.programCode || '').trim(),
          }))
          .filter((p: ProgramItem) => !!p.programId && !!p.programName);
      },
      error: () => {
        this.programsLoading = false;
        this.programs = [];
      },
    });
  }

  private loadCenters(): void {
    this.centersLoading = true;
    const body: any = { entiId: this.tenantId };
    this.api.fetchData(body, 'ims/center', 'list?list=full').subscribe({
      next: (res: any) => {
        this.centersLoading = false;
        if (!res?.status) {
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
      },
      error: () => {
        this.centersLoading = false;
        this.centers = [];
      },
    });
  }

  private loadFeePlans(after?: () => void): void {
    const programId = String(this.step1Form.get('programId')?.value || '').trim();
    console.log(this.step1Form.get('programCode')?.value)
    if (!programId ) {
      this.feePlans = [];
      after?.();
      return;
    }
    this.feePlansLoading = true;
    const body: any = { entiId: this.tenantId };
    let route = `list?list=full&programId=${encodeURIComponent(programId)}`;
    this.api.fetchData(body, 'ims/feeplan', route).subscribe({
      next: (res: any) => {
        this.feePlansLoading = false;
        if (!res?.status) {
          this.feePlans = [];
          after?.();
          return;
        }
        const arr = Array.isArray(res?.data) ? res.data : [];
        this.feePlans = arr
          .map((x: any) => ({
            id: String(x.feePlanId || x.id || x._id || '').trim(),
            name: String(x.feePlanName || x.feePlanCode || x.name || 'Fee Plan').trim(),
            feePlanCode: x.feePlanCode ? String(x.feePlanCode).trim() : '',
            instalments: Array.isArray(x.instalments)
              ? x.instalments.map((i: any) => ({
                  seq: Number(i.seq || 0) || 0,
                  label: String(i.label || `Instalment ${i.seq || ''}`).trim(),
                  amount: Number(i.amount || 0) || 0,
                  dueDate: i.dueDate ? String(i.dueDate).trim() : null,
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
        if (!exists && this.feePlans.length) {
          this.step1Form.patchValue({ feePlanId: this.feePlans[0].id }, { emitEvent: true });
        }
        after?.();
      },
      error: () => {
        this.feePlansLoading = false;
        this.feePlans = [];
        after?.();
      },
    });
  }

  get selectedPlan(): FeePlan | null {
    const id = String(this.step1Form.get('feePlanId')?.value || '').trim();
    return this.feePlans.find((p) => p.id === id) || null;
  }

  private onFeePlanChanged(feePlanId: string): void {
    const fp = this.feePlans.find((x) => x.id === feePlanId) || null;
    this.step1Form.patchValue(
      {
        feePlanCode: fp?.feePlanCode || this.step1Form.get('feePlanCode')?.value || '',
        feePlanName: fp?.name || this.step1Form.get('feePlanName')?.value || '',
      },
      { emitEvent: false }
    );
    const total =
      fp?.feeHeads?.reduce((s, x) => s + (Number(x.fee || 0) + Number(x.stax || 0)), 0) || 0;
    if (total > 0) this.step1Form.get('baseFee')?.setValue(total, { emitEvent: false });
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
    const v = Number(this.step1Form.get('additionalScholarshipPct')?.value ?? 0);
    return Number.isFinite(v) ? v : 0;
  }

  get totalDiscountPct(): number {
    const a = Math.max(0, Math.min(100, this.testScholarshipPct || 0)) / 100;
    const b = Math.max(0, Math.min(100, this.scholarshipPct || 0)) / 100;
    const c = Math.max(0, Math.min(100, this.additionalScholarshipPct || 0)) / 100;
    const eff = 1 - (1 - a) * (1 - b) * (1 - c);
    return Math.round(eff * 10000) / 100;
  }

  get feeHeadPreview(): Array<{ label: string; fee: number; stax: number; total: number; scholBenefits: number }> {
    const plan = this.selectedPlan;
    const heads = plan?.feeHeads || [];
    if (!heads.length) return [];
    const clamp = (v: number) => Math.max(0, Math.min(100, Number(v || 0)));
    const p1 = clamp(this.testScholarshipPct || 0);
    const p2 = clamp(this.scholarshipPct || 0);
    const p3 = clamp(this.additionalScholarshipPct || 0);
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
      const key = String(h.key || '').trim().toLowerCase();
      const isTuition =
        key === 'tuition' ||
        key === 'tuitionfee' ||
        key === 'tuition_fee' ||
        String(h.label || '').toLowerCase().includes('tuition');
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
      return { label: h.label, fee: outFee, stax: outTax, total: outFee + outTax, scholBenefits };
    });
  }

  get finalFee(): number {
    return this.feeHeadPreview.reduce((s, r) => s + Number(r.total || 0), 0);
  }

  get neftRefsFA(): UntypedFormArray {
    return this.step2Form.get('neftRefs') as UntypedFormArray;
  }

  get chequesFA(): UntypedFormArray {
    return this.step2Form.get('cheques') as UntypedFormArray;
  }

  trackByIndex(i: number): number {
    return i;
  }

  private buildPaymentsFromPaymentsArray(payments: any[], finalFee: number): void {
    const nefts = payments.filter((p) => String(p.paymentType || '').toUpperCase() === 'NEFT');
    const chqs = payments.filter((p) => String(p.paymentType || '').toUpperCase() === 'CHEQUE');
    const neftTotal = nefts.reduce((s, p) => s + (Number(p.amount || 0) || 0), 0);
    this.step2Form.get('neftAmount')?.setValue(neftTotal, { emitEvent: false });
    const neftFA = this.fb.array([]);
    if (nefts.length) {
      nefts.forEach((p) => {
        neftFA.push(
          this.fb.group({
            utr: [String(p?.neft?.utr || '').trim(), [Validators.required, Validators.minLength(6), Validators.maxLength(40)]],
            amount: [Number(p.amount || 0), [Validators.required, Validators.min(1)]],
            paidOn: [p?.neft?.paidOn || p?.submittedOn || null],
            bankName: [p?.neft?.bankName || ''],
            referenceNote: [p?.neft?.referenceNote || ''],
            remarks: [p?.remarks || ''],
          })
        );
      });
    } else {
      neftFA.push(
        this.fb.group({
          utr: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(40)]],
          amount: [0, [Validators.required, Validators.min(1)]],
          paidOn: [null],
          bankName: [''],
          referenceNote: [''],
          remarks: [''],
        })
      );
    }
    this.step2Form.setControl('neftRefs', neftFA);
    const chqFA = this.fb.array([]);
    if (chqs.length) {
      chqs
        .sort((a, b) => (Number(a?.cheque?.sno || 0) || 0) - (Number(b?.cheque?.sno || 0) || 0))
        .forEach((p) => {
          chqFA.push(
            this.fb.group({
              sno: [Number(p?.cheque?.sno || 0) || 0],
              chequeNo: [String(p?.cheque?.chequeNo || '').trim(), [Validators.required, Validators.minLength(4), Validators.maxLength(30)]],
              chequeDate: [p?.cheque?.chequeDate || null],
              dueDate: [p?.cheque?.dueDate || null, [Validators.required]],
              favourOf: [{ value: String(p?.cheque?.favourOf || this.DEFAULT_FAVOUR_OF).trim(), disabled: true }, [Validators.required]],
              mode: [((p?.cheque?.mode || 'PDC') === 'CDC' ? 'CDC' : 'PDC') as ChequeMode, [Validators.required]],
              bankName: [p?.cheque?.bankName || ''],
              amount: [{ value: Number(p.amount || 0), disabled: true }],
              remarks: [p?.remarks || ''],
            })
          );
        });
    }
    this.step2Form.setControl('cheques', chqFA);
  }

  get neftTotalEntered(): number {
    return (this.neftRefsFA.value || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
  }

  get chequeTotal(): number {
    return (this.chequesFA.getRawValue() || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
  }

  get totalCollected(): number {
    return (this.neftTotalEntered || 0) + (this.chequeTotal || 0);
  }

  get alert$() {
    return this.alert.alert$;
  }

  clearAlert(): void {
    this.alert.clear();
  }

  cancel(): void {
    this.router.navigate(['/app/admissions/view', this.admissionId]);
  }

  submitAndSendForApproval(): void {
    this.step1Form.markAllAsTouched();
    this.step2Form.markAllAsTouched();
    if (this.step1Form.invalid) {
      this.alert.error('Please fix required Admission details.');
      return;
    }
    if (this.step2Form.invalid) {
      this.alert.error('Please fix required Payment details.');
      return;
    }
    const plan = this.selectedPlan;
    if (!plan) {
      this.alert.error('Please select a valid fee plan.');
      return;
    }
    this.saving = true;
    const s1 = this.step1Form.getRawValue();
    const bodyUpdate: any = {
      entiId: this.tenantId,
      admissionId: this.admissionId,
      academicYear: String(s1.academicYear || '').trim(),
      sourceType: String(s1.sourceType || '').trim() || null,
      registrationNumber: String(s1.registrationNumber || '').trim() || null,
      portalStudentId: String(s1.portalStudentId || '').trim() || null,
      scholarshipTestId: String(s1.scholarshipTestId || '').trim() || null,
      centerId: String(s1.centerId || '').trim(),
      centerName: String(s1.centerName || '').trim(),
      programId: String(s1.programId || '').trim(),
      programName: String(s1.programName || '').trim(),
      programCode: String(s1.programCode || '').trim(),
      feePlanId: String(s1.feePlanId || '').trim(),
      feePlanCode: String(s1.feePlanCode || plan.feePlanCode || '').trim() || null,
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
      schoolMarks: {
        overallPct: s1.schoolOverallPct ?? null,
        coreSubjectPct: s1.schoolCorePct ?? null,
        remarks: String(s1.schoolRemarks || '').trim() || null,
      },
    };
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
        chequeDate: r.chequeDate || null,
        dueDate: r.dueDate || null,
        favourOf: String(this.DEFAULT_FAVOUR_OF || '').trim(),
        mode: (r.mode === 'CDC' ? 'CDC' : 'PDC') as ChequeMode,
        bankName: String(r.bankName || '').trim() || null,
        amount: Number(r.amount || 0),
        remarks: String(r.remarks || '').trim() || null,
      }))
      .filter((x: any) => !!x.chequeNo && !!x.dueDate && x.amount > 0);

    const bodyPayments: any = {
      entiId: this.tenantId,
      admissionId: this.admissionId,
      neftRefs,
      cheques,
    };
    this.api.fetchData(bodyUpdate, 'admi', 'update').subscribe({
      next: (r1: any) => {
        if (!r1?.status) {
          this.saving = false;
          this.alert.error(r1?.message || r1?.error || 'Failed to update admission');
          return;
        }
        this.api.fetchData(bodyPayments, 'admi', 'payments/save').subscribe({
          next: (r2: any) => {
            if (!r2?.status) {
              this.saving = false;
              this.alert.error(r2?.message || r2?.error || 'Failed to save payments');
              return;
            }
            const bodyApproval: any = { entiId: this.tenantId, admissionId: this.admissionId };
            this.api.fetchData(bodyApproval, 'admi', 'submit-approval').subscribe({
              next: (r3: any) => {
                this.saving = false;
                if (!r3?.status) {
                  this.alert.error(r3?.message || r3?.error || 'Failed to send for approval');
                  return;
                }
                this.alert.success('Updated and sent for approval.');
                this.router.navigate(['/app/admissions/view', this.admissionId]);
              },
              error: () => {
                this.saving = false;
                this.alert.error('Failed to send for approval');
              },
            });
          },
          error: () => {
            this.saving = false;
            this.alert.error('Failed to save payments');
          },
        });
      },
      error: () => {
        this.saving = false;
        this.alert.error('Failed to update admission');
      },
    });
  }
}