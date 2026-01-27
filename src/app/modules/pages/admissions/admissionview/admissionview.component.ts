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
  };
  academics: {
    centreName: string;
    programName: string;
    batchName?: string | null;
    className?: string | null;
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
    chequeSummary: {
      totalCheques: number;
      totalAmount: number;
      pendingCount: number;
      clearedCount: number;
      bouncedCount: number;
    };
    cheques: ChequeRow[];
  };
  workflowStage?: string | null;
  schoolMarks?: {
    overallPct?: any | null;
    coreSubjectPct?: any | null;
    remarks?: string | null;
  };
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
  readonly PRINT_LOGO_URL = '../../../../../assets/logo.png';
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
    return {
      workflowStage: String(adm?.workflow?.stage || ''),
      admissionId: String(adm.admissionId || ''),
      admissionNo: String(adm.admissionNo || ''),
      status: this.mapStageToStatus(adm?.workflow?.stage, adm?.status),
      createdAt: adm.createdAt || '',
      updatedAt: adm.updatedAt || null,
      student: {
        name: adm.student?.name || '',
        regNo: adm.registrationNumber || null,
        phone: adm.student?.phone || '',
        parentName: adm.student?.parentName || adm.student?.fatherName || '',
        parentPhone: adm.student?.parentPhone || '',
        email: adm.student?.email || null,
      },
      academics: {
        centreName: adm.centerName || '',
        programName: adm.programName || '',
        batchName: adm.batchName || null,
        className: adm.classLabel || adm.student?.className || null,
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
          <div class="title-main">FEE CALCULATION</div>
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
        <div class="ack-org2">${this.esc(orgLine2)}</div>
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
        <div class="ack-sign">Signature of Staff</div>
      </div>
      <div class="ack-footer">
        <div class="ack-support">
          For any support on a later stage please contact us on 9159241133 / 9626292233
        </div>
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
    this.router.navigate(['/app/admissions']);
  }

  private buildContractHtml(): string {
    const a = this.admission;
    if (!a) {
      console.error('No admission loaded');
      return '<p>No data available</p>';
    }
    const today = new Date();
    const s: any = a.student || {};
    const ac: any = a.academics || {};
    const fee: any = a.fee || {};
    const anyAdm: any = a;
    const providerName = 'ZEDSWEVEN I PRIVATE LIMITED';
    const headOfficeAddress =
      '13/1 Maharaja Avenue extension, Kalapatti Main Rd, beside Suguna pip school, GKD Nagar, Nehru Nagar West, Coimbatore, Tamil Nadu 641014'; // TODO: replace with real office address
    const centreAddress = ac.centreName || 'Study Centre';
    const studentName = this.esc(s.name || '');
    const parentName = this.esc(s.parentName || '');
    const studentDob = this.esc(s.dob || '');
    const studentSex = this.esc(s.gender || '');
    const studentAddress =
      this.esc(s.address || s.addressLine1 || anyAdm.studentAddress || '') ||
      '__________________________';
    const enrolmentNumber = this.esc(
      s.regNo || anyAdm.registrationNumber || anyAdm.enrolmentNo || '',
    );
    const registrationNumber = this.esc(anyAdm.registrationNumber || '');
    const studentId = this.esc(anyAdm.studentId || '');
    const studentEmail = this.esc(s.email || '');
    const studentMobile = this.esc(s.phone || '');
    const parentMobile = this.esc(s.parentPhone || '');
    const programName = this.esc(ac.programName || '');
    const programDuration = this.esc(ac.duration || '');
    const courseCommencement = this.esc(ac.courseStart || ac.startMonth || '');
    const gstin = this.esc(ac.gstin || '________________');
    const feePlanText = `${this.esc(fee.feePlanCode || '')} ${
      fee.feePlanName ? ' - ' + this.esc(fee.feePlanName) : ''
    }`;
    const baseFee = Number(fee.baseFee || 0);
    const finalFee = this.finalFee || Number(fee.finalFee || 0);
    const totalDiscountPct = Number(fee.totalDiscountPct || 0);
    const neftRowsHtml = (a.payments.neftRefs || [])
      .map(
        (n: any, idx: number) => `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td>NEFT</td>
          <td>${this.esc(n.utrNo || '')}</td>
          <td>${this.esc(
            n.paidOn ? new Date(n.paidOn).toLocaleDateString('en-IN') : '',
          )}</td>
          <td class="text-right">${Number(n.amount || 0).toLocaleString(
            'en-IN',
          )}</td>
        </tr>
      `,
      )
      .join('');
    const chequeRowsHtml = (a.payments.cheques || [])
      .map(
        (c: any, idx: number) => `
        <tr>
          <td class="text-center">${
            (a.payments.neftRefs?.length || 0) + idx + 1
          }</td>
          <td>${this.esc(c.mode || 'PDC')}</td>
          <td>${this.esc(c.chequeNo || '')}</td>
          <td>${this.esc(
            c.dueDate ? new Date(c.dueDate).toLocaleDateString('en-IN') : '',
          )}</td>
          <td class="text-right">${Number(c.amount || 0).toLocaleString(
            'en-IN',
          )}</td>
        </tr>
      `,
      )
      .join('');
    const paymentTableBody =
      neftRowsHtml || chequeRowsHtml
        ? neftRowsHtml + chequeRowsHtml
        : '<tr><td colspan="5" class="text-center">No payment schedule captured</td></tr>';

    return `
      <div class="page">
      <div class="brand">
              <img src="${this.esc(this.PRINT_LOGO_URL)}" alt="Logo" />
            </div>
        <!-- Header -->
        <div class="header-row">
          <div>
            <div class="title-main">ENROLMENT CONTRACT</div>
            <div class="small">
              (Prepared in line with the requirements for point of taxation / fee contracts)
            </div>
          </div>
          <div class="meta">
            <div><b>Date:</b> ${today.toLocaleDateString('en-IN')}</div>
            <div><b>Admission ID:</b> ${this.esc(a.admissionId || '')}</div>
            ${
              enrolmentNumber
                ? `<div><b>Enrolment No:</b> ${enrolmentNumber}</div>`
                : ''
            }
          </div>
        </div>
        <div class="section small">
          This contract is between <b>${providerName}</b>, having its registered / head office at
          <b>${this.esc(headOfficeAddress)}</b>, and
          <b>${parentName}</b> (Parent / Guardian) of <b>${studentName}</b> (Student),
          for enrolment into the below mentioned classroom / coaching program, for the
          duration indicated and as per the terms listed in this document.
        </div>
        <!-- 1. STUDENT / PROGRAM DETAILS -->
        <div class="section">
          <div class="section-title">1. STUDENT / PROGRAM DETAILS</div>
          <div class="small">
            The details of the Student’s enrolment, program, fee and other relevant information are as follows:
          </div>
          <table>
            <tbody>
              <tr>
                <th colspan="2">i) Details of Education Provider</th>
              </tr>
              <tr>
                <td style="width:45%;">Full Name of Education Provider</td>
                <td>${this.esc(providerName)}</td>
              </tr>
              <tr>
                <td>Head Office Address</td>
                <td>${this.esc(headOfficeAddress)}</td>
              </tr>

              <tr>
                <th colspan="2">ii) Details of Student / Parent / Guardian</th>
              </tr>
              <tr>
                <td>Full Name of Student</td>
                <td>${studentName}</td>
              </tr>
              <tr>
                <td>Date of Birth (DD-MMM-YYYY)</td>
                <td>${studentDob || '__________________________'}</td>
              </tr>
              <tr>
                <td>Sex</td>
                <td>${studentSex || '__________________________'}</td>
              </tr>
              <tr>
                <td>Permanent Address</td>
                <td>${studentAddress}</td>
              </tr>
              <tr>
                <td>Enrolment Number</td>
                <td>${enrolmentNumber || '__________________________'}</td>
              </tr>
              <tr>
                <td>Registration Number</td>
                <td>${registrationNumber || '__________________________'}</td>
              </tr>
              <tr>
                <td>Student ID</td>
                <td>${studentId || '__________________________'}</td>
              </tr>
              <tr>
                <td>Email ID of Student</td>
                <td>${studentEmail || '__________________________'}</td>
              </tr>
              <tr>
                <td>Contact Number</td>
                <td>${studentMobile || '__________________________'}</td>
              </tr>
              <tr>
                <td>Full Name of Parent / Guardian</td>
                <td>${parentName || '__________________________'}</td>
              </tr>
              <tr>
                <td>Parent / Guardian Mobile</td>
                <td>${parentMobile || '__________________________'}</td>
              </tr>

              <tr>
                <th colspan="2">iii) Program / Centre related information</th>
              </tr>
              <tr>
                <td>Full Name of Program</td>
                <td>${programName}</td>
              </tr>
              <tr>
                <td>Duration of Program</td>
                <td>${programDuration || '__________________________'}</td>
              </tr>
              <tr>
                <td>Course commencement (MMM-YYYY)</td>
                <td>${courseCommencement || '__________________________'}</td>
              </tr>
              <tr>
                <td>Study Centre</td>
                <td>${this.esc(centreAddress)}</td>
              </tr>
              <tr>
                <td>GSTIN</td>
                <td>${gstin}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- 2. COURSE FEE, SCHOLARSHIPS / WAIVERS AND PAYMENT SCHEDULE -->
        <div class="section">
          <div class="section-title">
            2. DETAILS OF COURSE FEE, SCHOLARSHIPS / WAIVERS AND PAYMENT SCHEDULE
          </div>
          <div class="small">
            The details of fee plan, scholarship / waivers and instalment schedule for the chosen program are
            summarised below:
          </div>
          <table>
            <tbody>
              <tr>
                <td style="width:45%;">Fee Plan</td>
                <td>${feePlanText || '__________________________'}</td>
              </tr>
              <tr>
                <td>Base Fee (before discounts)</td>
                <td>₹ ${baseFee.toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td>Total Scholarship / Discount (%)</td>
                <td>${totalDiscountPct.toFixed(2)}%</td>
              </tr>
              <tr>
                <td><b>Final Payable Fee</b></td>
                <td><b>₹ ${finalFee.toLocaleString('en-IN')}</b></td>
              </tr>
            </tbody>
          </table>
          <div class="mt-2 small">
            <b>Payment Schedule (as per current records)</b>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:40px;" class="text-center">#</th>
                <th>Mode</th>
                <th>UTR / Cheque No.</th>
                <th>Due / Paid Date</th>
                <th class="text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${paymentTableBody}
            </tbody>
          </table>
        </div>
        <!-- 3. MISCELLANEOUS TERMS & CONDITIONS -->
        <div class="section small">
          <div class="section-title">3. MISCELLANEOUS TERMS AND CONDITIONS</div>
          <ul class="note-list">
            <li>
              Post-dated cheques / scheduled electronic payments shall be deposited or initiated on the
              agreed due dates. Any delay or rejection may attract additional charges and late fees as per
              the institute’s policy.
            </li>
            <li>
              If a cheque or transaction is not honoured, the Parent / Guardian agrees to clear the amount
              through an alternate mode along with applicable bank and administrative charges and any
              late fee specified by the institute.
            </li>
            <li>
              Repeated defaults in payment may result in temporary suspension of classroom access or
              termination of enrolment, without any claim on the missed classes.
            </li>
            <li>
              All official communication will be sent to the contact details recorded in this contract /
              enrolment form. Any change in address, email or phone must be informed in writing within a
              reasonable time.
            </li>
            <li>
              Refunds, withdrawals and exit options (if any) shall be governed strictly by the written
              policies of the institute in force on the date of enrolment.
            </li>
          </ul>
        </div>

        <!-- 4. JURISDICTION -->
        <div class="section small">
          <div class="section-title">4. JURISDICTION</div>
          <p class="small">
            Any dispute arising out of or in connection with this enrolment shall be subject to the
            exclusive jurisdiction of the courts having jurisdiction over the registered office of the
            institute. Disputes, if any, may be referred to arbitration as per the policy notified by the
            institute from time to time.
          </p>
        </div>
        <!-- Signatures -->
        <div class="section mt-4 small">
          <table style="border:none; width:100%; margin-top:24px;">
            <tr>
              <td style="border:none; width:33%; vertical-align:top;">
                <div style="height:180px; border:1px solid #e5e7eb; margin-bottom:4px; font-size:9px; display:flex;align-items:center;justify-content:center;text-align:center;">
                  Photograph of Parent / Guardian
                </div>
                ___________________________<br/>
                Signature of Parent / Guardian<br/>
                Name: ${parentName || '________________'}
              </td>
              <td style="border:none; width:33%; text-align:center; vertical-align:top;">
                <div style="height:180px; border:1px solid #e5e7eb; margin-bottom:4px; font-size:9px; display:flex;align-items:center;justify-content:center;text-align:center;">
                  Photograph of Student
                </div>
                ___________________________<br/>
                Signature of Student<br/>
                Name: ${studentName || '________________'}
              </td>
              <td style="border:none; width:33%; text-align:right; vertical-align:bottom;">
                ___________________________<br/>
                Authorised Signatory<br/>
                For ${this.esc(providerName)}
              </td>
            </tr>
          </table>
          <div class="small mt-2">
            * Valid only if signed and sealed by the institute office.
          </div>
        </div>
      </div>
    `;
  }
}
