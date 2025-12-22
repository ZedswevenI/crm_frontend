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
}

interface NefRef {
  utrNo: string;
  amount: number;
  paidOn?: string | null;
  remarks?: string | null;
}

interface ChequeRow {
  sno: number;
  chequeDate: string;
  dueDate: string;
  favourOf: string;
  amount: number;
  chequeNo: string;
  mode: ChequeMode;
  status: ChequeStatus;
  remarks?: string | null;
}

interface AdmissionViewModel {
  admissionId: string;
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
}

@Component({
  selector: 'app-admissionview',
  standalone: false,
  templateUrl: './admissionview.component.html',
  styleUrls: ['./admissionview.component.scss'],
})
export class AdmissionviewComponent implements OnInit {
  admissionId = '';
  loading = true;

  admission!: AdmissionViewModel;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private api: CommonapiService
  ) {
    this.breadcrumb.set([
      { label: 'Control Panel' },
      { label: 'Admissions' },
      { label: 'Admission View' },
    ]);
  }

  // ---------------- lifecycle ----------------
  ngOnInit(): void {
    this.admissionId = String(
      this.route.snapshot.paramMap.get('id') || ''
    ).trim();
    if (!this.admissionId) {
      this.alert.error('Invalid admission id');
      this.router.navigate(['/app/admissions']);
      return;
    }

    this.loadAdmission();
  }

  // ---------------- computed props ----------------
  get feeHeadPreview(): FeeBreakupRow[] {
    return this.admission?.fee?.breakup || [];
  }

  get finalFee(): number {
    // from backend directly
    return this.admission?.fee?.finalFee || 0;
  }

  get chequeCount(): number {
    const summaryCount = this.admission?.payments?.chequeSummary?.totalCheques;

    // if summary value is a valid number, use it
    if (typeof summaryCount === 'number' && !isNaN(summaryCount)) {
      return summaryCount;
    }

    // else fallback to list length
    const list = this.admission?.payments?.cheques || [];
    return list.length || 0;
  }

  get chequeTotal(): number {
    const summaryTotal = this.admission?.payments?.chequeSummary?.totalAmount;

    // if summary value is a valid number, use it
    if (typeof summaryTotal === 'number' && !isNaN(summaryTotal)) {
      return summaryTotal;
    }

    // else compute from cheques array
    const cheques = this.admission?.payments?.cheques || [];
    if (!cheques.length) return 0;

    return cheques.reduce((s: number, c: ChequeRow) => {
      return s + (Number(c.amount || 0) || 0);
    }, 0);
  }

  get neftTotal(): number {
    // we can either use neftTotalEntered from admission.fee.payments.neft.totalEntered
    // or recompute from refs; here we recompute from refs (should match backend)
    return (this.admission?.payments?.neftRefs || []).reduce(
      (s: number, n: NefRef) => s + Number(n.amount || 0),
      0
    );
  }

  // ---------------- API integration (CommonapiService) ----------------
  private pickTenantId(): string {
    const t1 = (localStorage.getItem('entiId') || '').trim();
    const t2 = (localStorage.getItem('tenantId') || '').trim();
    return t1 || t2;
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
      entiId: tenantId, // pickTenantId on backend reads entiId / tenantId
    };

    this.loading = true;

    this.api.fetchData(body, 'admi', 'view').subscribe({
      next: (resp: any) => {
        this.loading = false;

        // controller returns: { status, data: { admission, payments } }
        if (!resp?.status || !resp?.data?.admission) {
          this.alert.error(
            resp?.message || resp?.error || 'Admission not found'
          );
          this.router.navigate(['/app/admissions']);
          return;
        }

        const admission = resp.data.admission;
        const payments = Array.isArray(resp.data.payments)
          ? resp.data.payments
          : [];

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
    const feeBreakupRaw = Array.isArray(adm?.fee?.breakup)
      ? adm.fee.breakup
      : [];

    const breakup: FeeBreakupRow[] = feeBreakupRaw.map((h: any) => ({
      label: String(h.label || '').trim(),
      total: Number(h.total || 0),
      scholBenefits: Number(h.scholBenefits || 0),
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
        paidOn: p.neft?.paidOn || null,
        remarks: p.remarks || null,
      }));

    const chequeRows: ChequeRow[] = (payments || [])
      .filter(
        (p: any) => String(p.paymentType || '').toUpperCase() === 'CHEQUE'
      )
      .map((p: any, idx: number) => ({
        sno: typeof p.cheque?.sno === 'number' ? p.cheque.sno : idx + 1,
        chequeDate: p.cheque?.chequeDate || '',
        dueDate: p.cheque?.dueDate || '',
        favourOf: p.cheque?.favourOf || '',
        amount: Number(p.amount || 0),
        chequeNo: p.cheque?.chequeNo || '',
        mode: (p.cheque?.mode || '') as ChequeMode,
        status: this.mapPaymentStatus(p.status),
        remarks: p.remarks || null,
      }));

    return {
      admissionId: String(adm.admissionId || ''),
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
        testName: adm.test?.resultCategory || null,
        score: adm.test?.normalizedScore
          ? Number(adm.test.normalizedScore)
          : null,
        percentile: adm.test?.normalizedPercentage
          ? Number(adm.test.normalizedPercentage)
          : null,
        result: this.mapTestResult(adm.test),
        remarks: null,
      },

      fee: {
        feePlanCode: adm.feePlanCode || '—',
        feePlanName: adm.programName || '',
        baseFee: Number(adm.fee?.baseFee || 0),
        finalFee: Number(adm.fee?.finalFee || 0),
        testScholarshipPct: Number(adm.fee?.testScholarshipPct || 0),
        scholarshipPct: Number(adm.fee?.scholarshipPct || 0),
        additionalScholarshipPct: Number(
          adm.fee?.additionalScholarshipPct || 0
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
    statusRaw?: string
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

  // ---------- actions ----------
  printFeeAcknowledgement(): void {
    window.print(); // plug in actual print later
  }

  printContract(): void {
    window.print();
  }

  printFeeCalculation(): void {
    window.print();
  }

  goBack(): void {
    this.router.navigate(['/app/admissions']);
  }
}
