import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';

type ChequeMode = 'PDC' | 'CDC' | '' | null;
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
  schoolMarks?: {
    overallPct?: any | null;
    coreSubjectPct?: any | null;
    remarks?: string | null;
  };
  createdByName?: string;
}

@Component({
  selector: 'app-admissionview',
  standalone: false,
  templateUrl: './admissionview.component.html',
  styleUrls: ['./admissionview.component.scss'],
})
export class AdmissionviewComponent implements OnInit {
  admissionId = '';
  admissionNo = '';
  loading = true;
  admission!: AdmissionViewModel;
  rawPayments: any[] = [];
  existingPayments: any[] = [];
  showPaymentsEditor = false;
  showEditAdmission = false;
  rejectModalOpen = false;
  rejectReason = '';
  actionBusy = false;
  readonly PRINT_LOGO_URL = `${window.location.origin}/assets/logo.png`;
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private api: CommonapiService,
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

    this.loadAdmission();
  }

  goToPaymentsEdit(): void {
    if (!this.admissionId) return;
    this.router.navigate(['app/admissions/payments/edit', this.admissionId]);
  }

  goToAdmissionEdit(): void {
    if (!this.admissionId) return;
    this.router.navigate(['app/admissions/edit', this.admissionId]);
  }

  get feeHeadPreview(): FeeBreakupRow[] {
    return this.admission?.fee?.breakup || [];
  }

  get finalFee(): number {
    return this.admission?.fee?.finalFee || 0;
  }

  get chequeCount(): number {
    const summaryCount = this.admission?.payments?.chequeSummary?.totalCheques;
    if (typeof summaryCount === 'number' && !isNaN(summaryCount)) {
      return summaryCount;
    }
    const list = this.admission?.payments?.cheques || [];
    return list.length || 0;
  }

  get chequeTotal(): number {
    const summaryTotal = this.admission?.payments?.chequeSummary?.totalAmount;
    if (typeof summaryTotal === 'number' && !isNaN(summaryTotal)) {
      return summaryTotal;
    }
    const cheques = this.admission?.payments?.cheques || [];
    if (!cheques.length) return 0;
    return cheques.reduce((s: number, c: ChequeRow) => {
      return s + (Number(c.amount || 0) || 0);
    }, 0);
  }

  private pickTenantId(): string {
    const t2 = (localStorage.getItem('tenantId') || '').trim();
    return t2;
  }

  private loadAdmission(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      this.router.navigate(['/auth/login']);
      return;
    }
    const body: any = {
      admissionId: this.admissionId,
      entiId: tenantId,
    };
    this.loading = true;
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
        const admission = resp.data.admission;
        const payments = Array.isArray(resp.data.payments)
          ? resp.data.payments
          : [];
        this.rawPayments = payments;
        this.admission = this.mapApiToView(admission, payments);
      },
      error: (err: any) => {
        console.error('Admission view error', err);
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
    if (adm.programId && typeof adm.programId === 'object') {
      duration = adm.programId.duration;
    }
    const creatorName = adm.createdBy?.name || 'Admin';
    return {
      workflowStage: String(adm?.workflow?.stage || ''),
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
        duration: duration,
        courseStart: adm.academicYear ? adm.academicYear.split(' - ')[0] : null,
        startMonth: null,
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

  get otherTotal(): number {
    return (this.admission?.payments?.otherPayments || []).reduce(
      (s, n) => s + Number(n.amount || 0),
      0,
    );
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
      case 'PENDING':
      case 'SUBMITTED':
      default:
        return 'pending';
    }
  }

  private mapTestResult(test: any): 'pass' | 'fail' | 'pending' | null {
    if (!test) return null;
    const waiver =
      typeof test.waiverPerInTf === 'number' ? test.waiverPerInTf : null;
    if (waiver === null) return 'pending';
    if (waiver > 0) return 'pass';
    return 'fail';
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
    return ['DRAFT'].includes(this.workflowStage);
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
    return (
      this.workflowStage === 'SUBMITTED_FOR_APPROVAL' ||
      this.workflowStage === 'APPROVED' ||
      this.workflowStage === 'PAYMENTS_SUBMITTED' ||
      this.workflowStage === 'CONFIRMED' ||
      this.workflowStage === 'APPROVAL_SENT'
    );
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

  sendForApproval(): void {
    if (this.actionBusy) return;
    const tenantId = localStorage.getItem('tenantId');
    if (!tenantId) {
      this.alert.error('tenantId missing. Please login again.');
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
      this.alert.error('You are not authorized to approve.');
      return;
    }
    if (this.actionBusy) return;
    const tenantId = localStorage.getItem('tenantId');
    if (!tenantId) {
      this.alert.error('tenantId/userId missing. Please login again.');
      return;
    }
    this.actionBusy = true;
    const body = { entiId: tenantId, admissionId: this.admissionId };
    this.api.fetchData(body, 'admi', 'approve').subscribe({
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
      this.alert.error('You are not authorized to reject.');
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
    const tenantId = localStorage.getItem('tenantId');
    if (!tenantId) {
      this.alert.error('tenantId/userId missing. Please login again.');
      return;
    }
    this.actionBusy = true;
    const body = {
      entiId: tenantId,
      admissionId: this.admissionId,
      reason,
    };
    this.api.fetchData(body, 'admi', 'reject').subscribe({
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

  onPaymentsSaved(): void {
    this.showPaymentsEditor = false;
    this.alert.success('Payments updated');
    this.loadAdmission();
  }

  onAdmissionEdited(): void {
    this.showEditAdmission = false;
    this.alert.success('Admission updated');
    this.loadAdmission();
  }

  private esc(v: any): string {
    const s = String(v ?? '');
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
          <div>${this.esc((a as any)?.academicYear || '')}</div>
          <div class="kv-label">Program</div>
          <div>${this.esc(a?.academics?.programName || '')}</div>
          <div class="kv-label">Fee Plan</div>
          <div>${this.esc((a as any)?.feePlanName || a?.fee?.feePlanName || '')}</div>
          <div class="kv-label">Study Centre</div>
          <div>${this.esc(a?.academics?.centreName || '')}</div>
          <div class="kv-label">Discounts </div>
          <div>Test Scholarship : ${testSch.toFixed(2)}% , Scholarship : ${schl.toFixed(2)}% , Additional Scholarship :${addSchl.toFixed(2)}%</div>
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

  goBack(): void {
    // this.router.navigate(['/app/admissions']);
    window.history.back();
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
                <td></td>
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

  printEnrollmentReport(): void {
    const html = this.buildEnrollmentReportHtml();
    this.openPrintWindow('Enrollment Report', html);
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
}
