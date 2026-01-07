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
  readonly PRINT_LOGO_URL = '../../../../../assets/logo.png';

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

      // what is actually charged after scholarship
      total: Number(
        h.total ??
          h.amount ?? // in case backend sends amount
          0
      ),

      // benefit in rupees
      scholBenefits: Number(h.scholBenefits ?? 0),

      // optional raw fee + tax if backend has them
      fee: Number(h.fee ?? h.base ?? 0),
      stax: Number(h.stax ?? h.taxAmount ?? h.gstAmount ?? 0),
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
  // ---------- computed helpers already present above ----------
  get neftTotal(): number {
    return (this.admission?.payments?.neftRefs || []).reduce(
      (s, n) => s + Number(n.amount || 0),
      0
    );
  }
  // ---------- print actions (hook points) ----------

  /** Simple HTML escape to avoid breaking the print HTML */
  private esc(v: any): string {
    const s = String(v ?? '');
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Common print window helper */
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
            * { box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
            body { margin: 16px; font-size: 12px; color: #111827; }
            .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 16mm 18mm; border: 1px solid #e5e7eb; }
            h1, h2, h3, h4 { margin: 0; }
            .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
            .title-main { font-size: 18px; font-weight: 700; text-transform: uppercase; }
            .subtitle { font-size: 12px; font-weight: 600; }
            .meta { font-size: 11px; text-align: right; }
            .section { margin-top: 12px; }
            .section-title { font-size: 12px; font-weight: 600; margin-bottom: 4px; text-transform: uppercase; }
            .kv-grid { display: grid; grid-template-columns: 120px 1fr 120px 1fr; gap: 2px 8px; font-size: 11px; }
            .kv-label { font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11px; }
            th, td { border: 1px solid #e5e7eb; padding: 4px 6px; vertical-align: top; }
            th { background: #f3f4f6; font-weight: 600; text-align: left; }
            tfoot td { font-weight: 600; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .mt-4 { margin-top: 16px; }
            .mt-2 { margin-top: 8px; }
            .small { font-size: 10px; }
            .note-list { font-size: 10px; margin: 4px 0 0 16px; padding: 0; }
            .note-list li { margin-bottom: 2px; }
            @media print {
              body { margin: 0; }
              .page { border: none; }
            }
            .brand {
              display: flex;
              gap: 10px;
              align-items: center;
            }
            .brand img {
              height: 42px;
              width: auto;
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          ${innerHtml}
        </body>
      </html>
    `);
    doc.close();

    // Give the browser a moment to render before printing
    setTimeout(() => {
      w.focus();
      w.print();
    }, 300);
  }

  /** Build HTML for the Fee Calculation Sheet (based on your sample PDF) */
  private buildFeeCalculationHtml(): string {
    const a = this.admission;
    if (!a) {
      console.error('No admission loaded');
      return '<p>No data available</p>';
    }

    const today = new Date();
    const feeRows = this.feeHeadPreview || [];
    const feeTotal = this.finalFee || 0;
    const scholTotal = feeRows.reduce(
      (s, r) => s + Number(r.scholBenefits || 0),
      0
    );

    const feeRowsHtml = feeRows
      .map(
        (r, idx) => `
        <tr>
          <td class="text-center">${idx + 1}</td>
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
        </tr>
      `
      )
      .join('');

    return `
      <div class="page">
      <div class="brand">
              <img src="${this.esc(this.PRINT_LOGO_URL)}" alt="Logo" />
            </div>
        <div class="header-row">
          <div>
            <div class="title-main">Fee Calculation Sheet</div>
            <div class="subtitle">For Enrolment / Admission</div>
          </div>
          <div class="meta">
            <div><b>Admission ID:</b> ${this.esc(a.admissionId)}</div>
            ${
              a.student?.regNo
                ? `<div><b>Reg No:</b> ${this.esc(a.student.regNo)}</div>`
                : ''
            }
            <div><b>Date:</b> ${today.toLocaleDateString('en-IN')}</div>
          </div>
        </div>

        <!-- Student & academic block -->
        <div class="section">
          <div class="section-title">Student & Academic Details</div>
          <div class="kv-grid">
            <div class="kv-label">Student Name</div>
            <div>${this.esc(a.student.name)}</div>
            <div class="kv-label">Student Mobile</div>
            <div>${this.esc(a.student.phone)}</div>

            <div class="kv-label">Parent Name</div>
            <div>${this.esc(a.student.parentName)}</div>
            <div class="kv-label">Parent Mobile</div>
            <div>${this.esc(a.student.parentPhone)}</div>

            <div class="kv-label">Programme</div>
            <div>${this.esc(a.academics.programName)}</div>
            <div class="kv-label">Centre</div>
            <div>${this.esc(a.academics.centreName)}</div>

            <div class="kv-label">Batch</div>
            <div>${this.esc(a.academics.batchName || '')}</div>
            <div class="kv-label">Class / Timing</div>
            <div>${this.esc(a.academics.className || '')}</div>
          </div>
        </div>

        <!-- Fee heads -->
        <div class="section">
          <div class="section-title">Fee Breakup (after scholarships)</div>
          <table>
            <thead>
              <tr>
                <th style="width:40px" class="text-center">#</th>
                <th>Fee Head</th>
                <th class="text-right">Fee (₹)</th>
                <th class="text-right">Tax (₹)</th>
                <th class="text-right">Total (₹)</th>
                <th class="text-right">Scholarship Benefit (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${feeRowsHtml || '<tr><td colspan="6">No fee heads</td></tr>'}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" class="text-right">Grand Total</td>
                <td class="text-right">${feeTotal.toLocaleString('en-IN')}</td>
                <td class="text-right">${scholTotal.toLocaleString(
                  'en-IN'
                )}</td>
              </tr>
            </tfoot>
          </table>

          <div class="mt-2 small">
            <b>Overall Discount % (Test + Scholarship + Additional):</b>
            ${Number(a.fee.totalDiscountPct || 0).toFixed(2)}%
          </div>
        </div>

        <!-- Payment schedule summary (from payments) -->
        <div class="section mt-4">
          <div class="section-title">Payment Schedule Summary</div>
          <div class="kv-grid">
            <div class="kv-label">NEFT Total</div>
            <div>₹ ${this.neftTotal.toLocaleString('en-IN')}</div>
            <div class="kv-label">Cheques Total</div>
            <div>₹ ${this.chequeTotal.toLocaleString('en-IN')}</div>

            <div class="kv-label">Total Payable</div>
            <div>₹ ${feeTotal.toLocaleString('en-IN')}</div>
            <div class="kv-label">Plan Code</div>
            <div>${this.esc(a.fee.feePlanCode)} – ${this.esc(
      a.fee.feePlanName
    )}</div>
          </div>
        </div>

        <div class="section mt-4 small">
          <b>For Office Use:</b>
          <p class="small">
            This sheet is generated from the system based on the selected fee plan and scholarship
            entries. Please verify details before handing over to the parent/student.
          </p>
        </div>
      </div>
    `;
  }

  /** Build HTML for Fee Acknowledgement (Enrolment Report style) */
  private buildFeeAcknowledgementHtml(): string {
    const a = this.admission;
    if (!a) {
      console.error('No admission loaded');
      return '<p>No data available</p>';
    }

    const today = new Date();

    const neftRowsHtml = (a.payments.neftRefs || [])
      .map(
        (n, idx) => `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td>${this.esc(n.utrNo)}</td>
          <td class="text-right">${Number(n.amount || 0).toLocaleString(
            'en-IN'
          )}</td>
          <td>${this.esc(
            n.paidOn ? new Date(n.paidOn).toLocaleDateString('en-IN') : ''
          )}</td>
          <td>${this.esc(n.remarks || '')}</td>
        </tr>
      `
      )
      .join('');

    const chequeRowsHtml = (a.payments.cheques || [])
      .map(
        (c, idx) => `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td>${this.esc(
            c.dueDate ? new Date(c.dueDate).toLocaleDateString('en-IN') : ''
          )}</td>
          <td>${this.esc(c.chequeNo)}</td>
          <td>${this.esc(c.favourOf)}</td>
          <td class="text-right">${Number(c.amount || 0).toLocaleString(
            'en-IN'
          )}</td>
          <td>${this.esc(c.mode)}</td>
        </tr>
      `
      )
      .join('');

    const feeTotal = this.finalFee || 0;

    return `
      <div class="page">
        <div class="brand">
              <img src="${this.esc(this.PRINT_LOGO_URL)}" alt="Logo" />
            </div>
        <div class="header-row">            
          <div>
            <div class="title-main">Enrolment Report / Fee Acknowledgement</div>
            <div class="subtitle">Provisional Admission Confirmation</div>
          </div>
          <div class="meta">
            <div><b>Admission ID:</b> ${this.esc(a.admissionId)}</div>
            ${
              a.student?.regNo
                ? `<div><b>Reg No:</b> ${this.esc(a.student.regNo)}</div>`
                : ''
            }
            <div><b>Date:</b> ${today.toLocaleDateString('en-IN')}</div>
          </div>
        </div>

        <!-- Student info -->
        <div class="section">
          <div class="section-title">Student Details</div>
          <div class="kv-grid">
            <div class="kv-label">Student Name</div>
            <div>${this.esc(a.student.name)}</div>
            <div class="kv-label">Student Mobile</div>
            <div>${this.esc(a.student.phone)}</div>

            <div class="kv-label">Parent Name</div>
            <div>${this.esc(a.student.parentName)}</div>
            <div class="kv-label">Parent Mobile</div>
            <div>${this.esc(a.student.parentPhone)}</div>

            <div class="kv-label">Programme</div>
            <div>${this.esc(a.academics.programName)}</div>
            <div class="kv-label">Centre</div>
            <div>${this.esc(a.academics.centreName)}</div>

            <div class="kv-label">Batch</div>
            <div>${this.esc(a.academics.batchName || '')}</div>
            <div class="kv-label">Class / Timing</div>
            <div>${this.esc(a.academics.className || '')}</div>
          </div>
        </div>

        <!-- Summary of fee & discount -->
        <div class="section">
          <div class="section-title">Fee Summary</div>
          <table>
            <tbody>
              <tr>
                <td>Fee Plan</td>
                <td>${this.esc(a.fee.feePlanCode)} – ${this.esc(
      a.fee.feePlanName
    )}</td>
              </tr>
              <tr>
                <td>Scholarship / Discount % (Total)</td>
                <td>${Number(a.fee.totalDiscountPct || 0).toFixed(2)}%</td>
              </tr>
              <tr>
                <td><b>Final Payable Fee</b></td>
                <td><b>₹ ${feeTotal.toLocaleString('en-IN')}</b></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- NEFT section -->
        <div class="section">
          <div class="section-title">NEFT Details</div>
          <table>
            <thead>
              <tr>
                <th style="width:40px" class="text-center">#</th>
                <th>UTR No</th>
                <th class="text-right">Amount (₹)</th>
                <th>Paid On</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${
                neftRowsHtml ||
                '<tr><td colspan="5" class="text-center">No NEFT entries</td></tr>'
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" class="text-right">Total</td>
                <td class="text-right">₹ ${this.neftTotal.toLocaleString(
                  'en-IN'
                )}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Cheque section -->
        <div class="section">
          <div class="section-title">Cheque Schedule</div>
          <table>
            <thead>
              <tr>
                <th style="width:40px" class="text-center">#</th>
                <th>Due Date</th>
                <th>Cheque No</th>
                <th>Favour of</th>
                <th class="text-right">Amount (₹)</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              ${
                chequeRowsHtml ||
                '<tr><td colspan="6" class="text-center">No cheques recorded</td></tr>'
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" class="text-right">Total Cheques</td>
                <td class="text-right">₹ ${this.chequeTotal.toLocaleString(
                  'en-IN'
                )}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="section mt-4 small">
          <b>Declaration:</b>
          <ul class="note-list">
            <li>
              This acknowledgement is system-generated based on the fee plan and payment details
              captured at the time of admission.
            </li>
            <li>
              The enrolment is subject to realisation of cheques / NEFT and fulfilment of all
              eligibility criteria of the institute.
            </li>
          </ul>
        </div>

        <div class="section mt-4 small">
          <table style="border:none; width:100%; margin-top:16px;">
            <tr>
              <td style="border:none; width:50%;">Parent / Student Signature</td>
              <td style="border:none; text-align:right;">Authorised Signatory</td>
            </tr>
          </table>
        </div>
      </div>
    `;
  }

  // ---------- public print API called from HTML buttons ----------

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

  /** Build HTML for Enrolment Contract (FIITJEE-style layout) */
  private buildContractHtml(): string {
    const a = this.admission;
    if (!a) {
      console.error('No admission loaded');
      return '<p>No data available</p>';
    }

    const today = new Date();

    // Casts so we can safely read optional fields without TS errors
    const s: any = a.student || {};
    const ac: any = a.academics || {};
    const fee: any = a.fee || {};
    const anyAdm: any = a;

    // You can move these to config if needed
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
      s.regNo || anyAdm.registrationNumber || anyAdm.enrolmentNo || ''
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
            n.paidOn ? new Date(n.paidOn).toLocaleDateString('en-IN') : ''
          )}</td>
          <td class="text-right">${Number(n.amount || 0).toLocaleString(
            'en-IN'
          )}</td>
        </tr>
      `
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
            c.dueDate ? new Date(c.dueDate).toLocaleDateString('en-IN') : ''
          )}</td>
          <td class="text-right">${Number(c.amount || 0).toLocaleString(
            'en-IN'
          )}</td>
        </tr>
      `
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
