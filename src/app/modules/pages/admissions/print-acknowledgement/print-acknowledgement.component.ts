import { Component, OnInit } from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { Location } from '@angular/common';
import { AlertService } from '../../../../service/alert/alert.service';
import { BredcrumpService } from '../../../../service/bredcrump/bredcrump.service';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { ActivatedRoute, Router } from '@angular/router';

interface FeePlan {
  id: string;
  name: string;
  feePlanCode?: string;
  instalments: Array<{
    seq: number;
    label: string;
    instalmentDate: number;
    amount: number;
    mode: string;
    chequeFavour?: string;
  }>;
}

interface ProgramItem {
  programId: string;
  programName: string;
  programCode?: string;
}

interface InstRow {
  sno: number;
  label: string;
  dueDate: string;
  mode: string;
  amount: number;
  favour: string;
}

@Component({
  selector: 'app-print-acknowledgement',
  standalone: false,
  templateUrl: './print-acknowledgement.component.html',
  styleUrl: './print-acknowledgement.component.scss',
})
export class PrintAcknowledgementComponent implements OnInit {
  form!: UntypedFormGroup;

  programs: ProgramItem[] = [];
  programsLoading = false;

  feePlans: FeePlan[] = [];
  feePlansLoading = false;

  lookupLoading = false;
  manualMode = false;

  instalments: InstRow[] = [];
  neftSplitAmount = 0;

  readonly DEFAULT_FAVOUR = 'ZEDSWEVEN I PRIVATE LIMITED';
  readonly PRINT_LOGO_URL = `${window.location.origin}/assets/logo.png`;
  readonly ORG_LINE1 = 'ZEDSWEVEN I Private Limited, Coimbatore';
  readonly ORG_LINE2 =
    '47D2, Nehru Nagar West, Civil Aerodrome Post, Kalapatti Road, Coimbatore - 641014';

  constructor(
    private fb: UntypedFormBuilder,
    private location: Location,
    private alert: AlertService,
    private breadcrumb: BredcrumpService,
    private api: CommonapiService,
    private router: Router
  ) {
    this.breadcrumb.set([
      { label: 'Admissions & Fees' },
      { label: 'Admission' },
      { label: 'Print Acknowledgement' },
    ]);
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      lookupRegNo: [''],
      studentName: ['', Validators.required],
      admissionNo: [''],
      regNo: [''],
      programId: ['', Validators.required],
      feePlanId: ['', Validators.required],
      neftCount: [1, [Validators.required, Validators.min(0)]],
      neftTotal: [0, [Validators.required, Validators.min(0)]],
      chequeCount: [0, [Validators.required, Validators.min(0)]],
      chequeTotal: [0, [Validators.required, Validators.min(0)]],
      enrolledBy: [(localStorage.getItem('name') || '').trim(), Validators.required],
    });

    this.loadPrograms();

    // Editing the search box after a lookup invalidates the fetched student.
    this.form.get('lookupRegNo')!.valueChanges.subscribe((v) => {
      if (this.manualMode) return;
      if (String(v || '').trim() !== String(this.form.get('regNo')!.value || '')) {
        this.form.patchValue(
          { studentName: '', regNo: '', admissionNo: '' },
          { emitEvent: false },
        );
      }
    });

    this.form.get('programId')!.valueChanges.subscribe((pid) => {
      this.feePlans = [];
      this.instalments = [];
      this.form.patchValue({ feePlanId: '' }, { emitEvent: false });
      if (pid) this.loadFeePlans(pid);
    });

    this.form.get('feePlanId')!.valueChanges.subscribe((fpid) => {
      this.instalments = [];
      this.neftSplitAmount = 0;
      if (fpid) this.buildInstalments(fpid);
    });
  }

  fetchByRegNo(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }
    const regNo = String(this.form.get('lookupRegNo')!.value || '').trim();
    if (!regNo) {
      this.alert.error('Please enter Enrolment / Reg No.');
      return;
    }

    this.form.patchValue(
      { studentName: '', regNo: '', admissionNo: '' },
      { emitEvent: false },
    );
    this.lookupLoading = true;
    this.api
      .fetchData({ entiId: tenantId, registrationNumber: regNo }, 'admi', 'portal/fetch')
      .subscribe({
        next: (res: any) => {
          this.lookupLoading = false;
          if (!res?.status) {
            this.alert.error(res?.message || res?.error || 'Fetch failed');
            return;
          }
          const d = res?.data || {};
          const name =
            d.name ||
            d.studentName ||
            `${d.firstName || ''} ${d.lastName || ''}`.trim();
          this.form.patchValue(
            {
              studentName: name,
              regNo: d.regNo || d.registrationNumber || regNo,
            },
            { emitEvent: false },
          );
          this.alert.success('Fetched student details.');
        },
        error: (err) => {
          this.lookupLoading = false;
          const p = err?.error;
          const admissionNo = String(p?.data?.admissionNo || '').trim();
          if (String(p?.data?.admissionId || '').trim()) {
            this.alert.error(
              admissionNo
                ? `Admission already exists for ${regNo} (Admission No: ${admissionNo}). Enter the payment details below to print, or use Enter manually.`
                : `Admission already exists for ${regNo}.`,
              6000,
            );
            return;
          }
          this.alert.error(p?.message || err?.message || 'Fetch failed');
        },
      });
  }

  enterManually(): void {
    this.manualMode = true;
    this.form.patchValue({ lookupRegNo: '' }, { emitEvent: false });
  }

  clearStudent(): void {
    this.manualMode = false;
    this.form.patchValue(
      { lookupRegNo: '', studentName: '', regNo: '', admissionNo: '' },
      { emitEvent: false },
    );
  }

  private pickTenantId(): string {
    return (localStorage.getItem('tenantId') || '').trim();
  }

  private loadPrograms(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) return;
    this.programsLoading = true;
    this.api
      .fetchData({ entiId: tenantId }, 'ims/program', 'list?list=full')
      .subscribe({
        next: (res: any) => {
          this.programsLoading = false;
          if (!res?.status) return;
          this.programs = (Array.isArray(res.data) ? res.data : [])
            .map((x: any) => ({
              programId: String(x.programId || x._id || '').trim(),
              programName: String(x.programName || x.name || '').trim(),
              programCode: String(x.programCodes || x.programCode || '').trim(),
            }))
            .filter((p: ProgramItem) => !!p.programId);
        },
        error: () => {
          this.programsLoading = false;
          this.alert.error('Failed to load programs');
        },
      });
  }

  private loadFeePlans(programId: string): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) return;
    this.feePlansLoading = true;
    this.api
      .fetchData(
        { entiId: tenantId },
        'ims/feeplan',
        `list?list=full&programId=${encodeURIComponent(programId)}`,
      )
      .subscribe({
        next: (res: any) => {
          this.feePlansLoading = false;
          if (!res?.status) return;
          this.feePlans = (Array.isArray(res.data) ? res.data : [])
            .map((x: any) => ({
              id: String(x.feePlanId || x.id || x._id || '').trim(),
              name: String(x.feePlanName || x.name || '').trim(),
              feePlanCode: x.feePlanCode || '',
              instalments: Array.isArray(x.instalments)
                ? x.instalments.map((i: any) => ({
                    seq: Number(i.seq || 0),
                    label: String(i.label || '').trim(),
                    instalmentDate: Number(i.instalmentDate || 0),
                    amount: Number(i.amount || 0),
                    mode: String(i.mode || 'PDC').trim(),
                    chequeFavour: String(
                      i.chequeFavour || this.DEFAULT_FAVOUR,
                    ).trim(),
                  }))
                : [],
            }))
            .filter((fp: FeePlan) => !!fp.id);
        },
        error: () => {
          this.feePlansLoading = false;
          this.alert.error('Failed to load fee plans');
        },
      });
  }

  private buildInstalments(feePlanId: string): void {
    const plan = this.feePlans.find((p) => p.id === feePlanId);
    if (!plan) return;

    const neftInsts = plan.instalments.filter(
      (i) => Number(i.instalmentDate) === 0,
    );
    const chequeInsts = plan.instalments.filter(
      (i) => Number(i.instalmentDate) > 0,
    );

    this.neftSplitAmount = neftInsts.reduce(
      (s, i) => s + (Number(i.amount) || 0),
      0,
    );

    // Auto-fill neft total from plan
    this.form.patchValue(
      { neftTotal: this.roundRupee(this.neftSplitAmount) },
      { emitEvent: false },
    );

    const rows: InstRow[] = [];
    let sno = 1;

    if (this.neftSplitAmount > 0) {
      rows.push({
        sno: sno++,
        label: 'ON ADMISSION',
        dueDate: '',
        mode: 'Online/DD',
        amount: this.roundRupee(this.neftSplitAmount),
        favour: this.DEFAULT_FAVOUR,
      });
    }

    chequeInsts.forEach((i) => {
      rows.push({
        sno: sno++,
        label: i.label || `Instalment ${i.seq}`,
        dueDate: this.epochToDisplay(i.instalmentDate),
        mode: `(${(i.mode || 'PDC').toUpperCase()})`,
        amount: this.roundRupee(i.amount),
        favour: i.chequeFavour || this.DEFAULT_FAVOUR,
      });
    });

    this.instalments = rows;

    // Auto-fill cheque count from plan
    this.form.patchValue(
      { chequeCount: chequeInsts.length },
      { emitEvent: false },
    );
  }

  get selectedPlanName(): string {
    const plan = this.feePlans.find(
      (p) => p.id === this.form.get('feePlanId')?.value,
    );
    return plan?.name || '';
  }

  get totalCollected(): number {
    const neft = Number(this.form.get('neftTotal')?.value || 0);
    const cheque = Number(this.form.get('chequeTotal')?.value || 0);
    return this.roundRupee(neft + cheque);
  }

  private epochToDisplay(v: any): string {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return '';
    const d = new Date(n);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${d.getFullYear()}`;
  }

  private roundRupee(v: any): number {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n);
  }

  private esc(v: any): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private fmtDate(): string {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${d.getFullYear()}`;
  }

  goBack(): void {
    // this.location.back();
        this.router.navigate(['/app/admissions']);
  }

  printAck(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.alert.error('Please fill all required fields before printing.');
      return;
    }
    const html = this.buildAckHtml();
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) {
      this.alert.error('Popup blocked. Please allow popups to print.');
      return;
    }
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Fee Acknowledgement</title>
      <style>
        *{box-sizing:border-box;}
        @page{size:A4 landscape;margin:10mm;}
        body{font-family:system-ui,-apple-system,sans-serif;font-size:12px;margin:0;color:#111827;}
        .ack-sheet{width:100%;display:flex;align-items:stretch;}
        .ack-panel{width:50%;padding:8mm 10mm;display:flex;flex-direction:column;min-height:calc(210mm - 20mm);box-sizing:border-box;}
        .ack-sep{width:0;border-left:2px dashed #111827;align-self:stretch;margin:0;}
        .ack-toprow{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:4mm;}
        .ack-copy{font-weight:700;font-size:12px;color:#111827;margin-top:2mm;flex:1 1 0;}
        .ack-logo{flex:1 1 0;display:flex;justify-content:center;align-items:flex-start;}
        .ack-logo img{height:38px;width:auto;object-fit:contain;display:block;}
        .ack-rightsp{flex:1 1 0;}
        .ack-org{text-align:center;line-height:1.3;}
        .ack-org1{font-weight:600;}
        .ack-org2{font-size:11px;margin-top:2px;}
        .ack-title{text-align:center;font-weight:800;text-decoration:underline;margin-top:12px;letter-spacing:0.3px;font-size:13px;}
        .ack-date{margin-top:12px;}
        .ack-lines{margin-top:8px;line-height:1.5;}
        .mt-6{margin-top:6px;}
        .ack-table{width:100%;border-collapse:collapse;margin-top:8px;}
        .ack-table th,.ack-table td{border:1px solid #111827;padding:6px 8px;vertical-align:middle;}
        .ack-table th{font-weight:700;text-align:left;background:#f3f4f6;}
        .text-center{text-align:center;}
        .text-right{text-align:right;}
        .ack-note{margin-top:6px;font-size:11px;font-style:italic;}
        .ack-list{margin-top:4px;margin-left:18px;font-size:11px;line-height:1.6;}
        .ack-warn{margin-top:4px;font-size:11px;}
        .ack-warn2{margin-top:2px;font-size:11px;font-weight:700;}
        .ack-signwrap{margin-top:auto;display:flex;justify-content:flex-end;padding-top:12px;}
        .ack-sign{white-space:nowrap;font-size:11px;}
        .ack-footer{margin-top:6px;font-size:10px;}
        .ack-org-bottom{text-align:center;margin-top:20px;font-size:11px;line-height:1.4;}
        @media print{body{margin:0;}}
      </style>
      </head><body onload="window.print();">${html}</body></html>`);
    w.document.close();
  }

  private buildAckHtml(): string {
    const f = this.form.getRawValue();
    const studentName = this.esc(f.studentName || '—');
    const admissionNo = this.esc(f.admissionNo || '');
    const regNo = this.esc(f.regNo || '—');
    const programName = this.esc(
      this.programs.find((p) => p.programId === f.programId)?.programName || '',
    );
    const feePlanName = this.esc(this.selectedPlanName);
    const enrolledBy = this.esc(f.enrolledBy || 'Admin');
    const neftCount = Number(f.neftCount || 0);
    const neftTotal = this.roundRupee(Number(f.neftTotal || 0));
    const chequeCount = Number(f.chequeCount || 0);
    const chequeTotal = this.roundRupee(Number(f.chequeTotal || 0));
    const grandTotal = this.roundRupee(neftTotal + chequeTotal);
    const dateText = this.fmtDate();

    // Instalment rows HTML
    const instRowsHtml = this.instalments.length
      ? this.instalments
          .map(
            (r) => `
          <tr>
            <td class="text-center">${r.sno}</td>
            <td>${this.esc(r.dueDate || 'On Admission')}</td>
            <td>${this.esc(r.mode)}</td>
            <td>${this.esc(r.label)}</td>
            <td>${this.esc(r.favour)}</td>
            <td class="text-right">₹${r.amount.toLocaleString('en-IN')}</td>
          </tr>`,
          )
          .join('')
      : `<tr><td colspan="6" class="text-center">No instalments</td></tr>`;

    const bodyBlock = (copyTitle: string) => `
      <div class="ack-panel">
        <div class="ack-toprow">
          <div class="ack-copy">${this.esc(copyTitle)}</div>
          <div class="ack-logo"><img src="${this.esc(this.PRINT_LOGO_URL)}" alt="Logo"/></div>
          <div class="ack-rightsp"></div>
        </div>
        <div class="ack-org"><div class="ack-org1">${this.esc(this.ORG_LINE1)}</div></div>
        <div class="ack-title">ACKNOWLEDGEMENT</div>
        <div class="ack-date"><b>Date: ${this.esc(dateText)}</b></div>
        <div class="ack-lines">
          <div>Received the below mentioned Payments towards the Enrolment for <b><u>${studentName}</u></b></div>
          ${admissionNo ? `<div class="mt-6">Admission No: <b><u>${admissionNo}</u></b></div>` : ''}
          </b> &nbsp;&amp;&nbsp; Enrolling For Program <b><u>${programName}</u></b>&nbsp;
          Fee Plan Opted: <b><u>${feePlanName}</u></b>&nbsp;
          Enrolled by: <b><u>${enrolledBy}</u></b>
        </div>
        <table class="ack-table" style="margin-top:10px;">
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
              <td class="text-center">${neftTotal.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td>Post Dated Cheques</td>
              <td class="text-center">${chequeCount}</td>
              <td class="text-center">${chequeTotal.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2"><b>Total Value of Payments Submitted</b></td>
              <td class="text-center"><b>${grandTotal.toLocaleString('en-IN')}</b></td>
            </tr>
          </tfoot>
        </table>
        <div class="ack-note">Please ensure the below mentioned documents are also submitted to complete the admission formalities.</div>
        <ol class="ack-list">
          <li>Z-SAT Exam Hall Ticket in Original</li>
          <li>Student ID Proof (Xerox Copy)</li>
          <li>Offer Letter Copy (Print out taken from Result website)</li>
          <li>Enrolment form in Filled Manner</li>
          <li>Passport Size Photograph of student &amp; Parent as mentioned in the enrolment form</li>
        </ol>
        <div class="ack-warn"><b>Note:</b> This is not an Enrolment <b>FEE</b> Receipt.</div>
        <div class="ack-warn2">Proper Enrolment Report will be provided at a later stage along with an enrolment Number</div>
        <div class="ack-signwrap"><div class="ack-sign">Authorised Signatory</div></div>
        <div class="ack-footer">For any support on a later stage please contact us on 9159241133 / 9626292233</div>
        <div class="ack-org-bottom">
          <div class="ack-org1">${this.esc(this.ORG_LINE1)}</div>
          <div class="ack-org2">${this.esc(this.ORG_LINE2)}</div>
        </div>
      </div>`;

    return `<div class="ack-sheet">
      ${bodyBlock('OFFICE COPY')}
      <div class="ack-sep"></div>
      ${bodyBlock('PARENT COPY')}
    </div>`;
  }

  get instalmentTotal(): number {
    return this.instalments.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  }
}
