import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { CommonapiService } from '../../../../service/commonapi/commonapi.service';
import { AlertService } from '../../../../service/alert/alert.service';

type ChequeMode = 'PDC' | 'CDC';

@Component({
  selector: 'app-admissionpayments-editor',
  standalone: false,
  templateUrl: './admissionpayments-editor.component.html',
  styleUrl: './admissionpayments-editor.component.scss',
})
export class AdmissionpaymentsEditorComponent implements OnInit {
  admissionId = '';
  registrationNumber = '';
  loading = true;
  submitting = false;
  form!: UntypedFormGroup;
  finalFee = 0;
  existingPayments: any[] = [];
  chequeTemplate: any[] = [];
  neftTemplateAmount: number | null = null;
  bankNames: string[] = [
    'STATE BANK OF INDIA',
    'HDFC BANK',
    'ICICI BANK',
    'AXIS BANK',
    'KOTAK MAHINDRA BANK',
    'PUNJAB NATIONAL BANK',
    'BANK OF BARODA',
    'CANARA BANK',
    'UNION BANK OF INDIA',
    'INDIAN BANK',
    'IDBI BANK',
    'YES BANK',
    'INDUSIND BANK',
    'FEDERAL BANK',
    'RBL BANK',
    'BANDHAN BANK',
  ];

  readonly DEFAULT_FAVOUR_OF = 'ZEDSWEVEN I PRIVATE LIMITED';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: UntypedFormBuilder,
    private api: CommonapiService,
    private alert: AlertService,
  ) {}

  ngOnInit(): void {
    this.admissionId = String(
      this.route.snapshot.paramMap.get('id') || '',
    ).trim();
    if (!this.admissionId) {
      this.alert.error('Invalid admission id');
      this.back();
      return;
    }

    this.form = this.fb.group({
      neftAmount: [{ value: 0, disabled: true }],
      neftRefs: this.fb.array([]),
      cheques: this.fb.array([]),
    });

    this.load();
  }

  trackByIndex(i: number): number {
    return i;
  }

  get neftRefsFA(): UntypedFormArray {
    return this.form.get('neftRefs') as UntypedFormArray;
  }

  get chequesFA(): UntypedFormArray {
    return this.form.get('cheques') as UntypedFormArray;
  }

  get neftAmount(): number {
    return Number(this.form.getRawValue().neftAmount ?? 0) || 0;
  }

  get neftTotalEntered(): number {
    return (this.neftRefsFA.value || []).reduce(
      (s: number, r: any) => s + (Number(r.amount) || 0),
      0,
    );
  }

  get chequeCount(): number {
    return this.chequesFA.length;
  }

  get chequeTotal(): number {
    return (this.chequesFA.getRawValue() || []).reduce(
      (s: number, r: any) => s + (Number(r.amount) || 0),
      0,
    );
  }

  get totalCollected(): number {
    return (this.neftTotalEntered || 0) + (this.chequeTotal || 0);
  }

  get balanceAmount(): number {
    const due = Math.round(this.finalFee || 0);
    const paid = Math.round(this.totalCollected || 0);
    return Math.max(0, due - paid);
  }

  private pickTenantId(): string {
    // ✅ keep your existing storage key (but support both)
    return (
      localStorage.getItem('tenantId') ||
      localStorage.getItem('tenantid') ||
      ''
    ).trim();
  }

  load(): void {
    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId/userId missing. Please login again.');
      this.router.navigate(['/auth/login']);
      return;
    }

    this.loading = true;

    const viewBody = { entiId: tenantId, admissionId: this.admissionId };
    this.api.fetchData(viewBody, 'admi', 'view').subscribe({
      next: (resp: any) => {
        if (!resp?.status) {
          this.loading = false;
          this.alert.error(
            resp?.message || resp?.error || 'Failed to load admission',
          );
          this.back();
          return;
        }

        const root = resp?.data || resp || {};
        const admission = root?.admission || root?.data?.admission || root;

        this.registrationNumber = safeStr(admission?.registrationNumber);

        // final fee
        const fee = admission?.fee || root?.fee || {};
        const breakup = Array.isArray(fee?.breakup) ? fee.breakup : [];
        const breakupSum = breakup.reduce(
          (s: number, r: any) => s + (Number(r?.total || 0) || 0),
          0,
        );

        const finalFeeRaw =
          (fee?.finalFee != null ? Number(fee.finalFee) : null) ??
          (root?.finalFee != null ? Number(root.finalFee) : null) ??
          (admission?.finalFee != null ? Number(admission.finalFee) : null) ??
          0;

        const computedFinal = finalFeeRaw > 0 ? finalFeeRaw : breakupSum;
        this.finalFee = this.roundRupee(computedFinal);

        if (!this.finalFee || this.finalFee <= 0) {
          this.loading = false;
          this.alert.error('finalFee missing in admission view response');
          return;
        }

        // pull payments
        const admPaymentsObj = admission?.payments || {};
        const savedNeftRefsFromObj = Array.isArray(admPaymentsObj?.neft?.refs)
          ? admPaymentsObj.neft.refs
          : [];
        const savedNeftSplitFromObj =
          Number(admPaymentsObj?.neft?.splitAmount || 0) || 0;

        const paymentsArray = Array.isArray(root?.payments)
          ? root.payments
          : Array.isArray(root?.data?.payments)
            ? root.data.payments
            : Array.isArray(admission?.payments)
              ? admission.payments
              : [];

        this.existingPayments = paymentsArray;

        // Support older fallback shapes if any
        const neftSaved = Array.isArray(admission?.neftRefs)
          ? admission.neftRefs
          : Array.isArray(root?.neftRefs)
            ? root.neftRefs
            : null;

        const chqSaved = Array.isArray(admission?.cheques)
          ? admission.cheques
          : Array.isArray(root?.cheques)
            ? root.cheques
            : null;

        const savedNeftRefs =
          neftSaved ??
          (savedNeftRefsFromObj?.length
            ? savedNeftRefsFromObj
            : this.extractNeftRefsFromPayments(paymentsArray));

        const savedCheques =
          chqSaved ?? this.extractChequesFromPayments(paymentsArray);

        // get payment template
        const tplBody = { entiId: tenantId, admissionId: this.admissionId };
        this.api.fetchData(tplBody, 'admi', 'paymenttemplate').subscribe({
          next: (tpl: any) => {
            if (!tpl?.status) {
              this.loading = false;
              this.alert.error(
                tpl?.message ||
                  tpl?.error ||
                  'Failed to load instalment template',
              );
              return;
            }

            const tdata = tpl?.data || {};
            this.chequeTemplate = Array.isArray(tdata?.chequeTemplate)
              ? tdata.chequeTemplate
              : [];

            // ✅ FIX: controller returns neftSplitAmount (not neftAmount)
            const tplSplit = Number(tdata?.neftSplitAmount || 0) || 0;
            this.neftTemplateAmount =
              tplSplit > 0
                ? tplSplit
                : savedNeftSplitFromObj > 0
                  ? savedNeftSplitFromObj
                  : null;

            if (!this.chequeTemplate.length) {
              this.loading = false;
              this.alert.error(
                'Cheque template not returned from paymenttemplate API',
              );
              return;
            }

            this.buildPaymentsFromFinalFee(
              this.finalFee,
              this.neftTemplateAmount,
              this.chequeTemplate,
            );

            this.patchSavedPayments(savedNeftRefs, savedCheques);

            this.loading = false;
          },
          error: () => {
            this.loading = false;
            this.alert.error('Failed to load instalment template');
          },
        });
      },
      error: () => {
        this.loading = false;
        this.alert.error('Failed to load admission');
        this.back();
      },
    });
  }

  private buildPaymentsFromFinalFee(
    finalFee: number,
    neftTplAmount: number | null,
    chequeTpl: any[],
  ): void {
    const due = this.roundRupee(finalFee);
    const { admissionRow, chequeRows } = this.splitAdmissionRow(
      chequeTpl || [],
    );

    // NEFT base
    let baseNeft =
      neftTplAmount != null &&
      Number.isFinite(neftTplAmount) &&
      Number(neftTplAmount) > 0
        ? Number(neftTplAmount)
        : Number(admissionRow?.amount || 0) || 0;

    if (!baseNeft) {
      const neftPay = (this.existingPayments || []).find(
        (p: any) => String(p.paymentType || '').toUpperCase() === 'NEFT',
      );
      baseNeft = Number(neftPay?.amount || 0) || 0;
    }

    const chequeBase = (chequeRows || []).map(
      (x: any) => Number(x?.amount || 0) || 0,
    );
    const baseAmounts = [baseNeft, ...chequeBase];
    const baseTotal = baseAmounts.reduce(
      (s: number, x: number) => s + (Number(x) || 0),
      0,
    );

    if (!baseTotal || due <= 0) {
      this.form.get('neftAmount')?.setValue(0, { emitEvent: false });
      this.form.setControl('neftRefs', this.fb.array([]));
      this.form.setControl('cheques', this.fb.array([]));
      this.addNeftRef();
      return;
    }

    const scaled = this.scalePlan(baseAmounts, due, baseTotal);
    const neftAmt = scaled[0] || 0;
    const chequeAmounts = scaled.slice(1);

    this.form.get('neftAmount')?.setValue(neftAmt, { emitEvent: false });

    // NEFT array
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
      }),
    );
    this.form.setControl('neftRefs', neftFA);

    // Cheques array
    const chqFA = this.fb.array([]) as UntypedFormArray;

    chequeAmounts.forEach((amt: number, idx: number) => {
      const tplRow = chequeRows[idx] || {};
      const sno = Number(tplRow?.sno || idx + 1) || idx + 1;

      const label = String(
        tplRow?.instalmentLabel || tplRow?.label || `Instalment ${sno}`,
      ).trim();

      // template dueDate may be ISO string; we store form as YYYY-MM-DD input string
      const dueDateISO = this.toISODateInput(tplRow?.dueDate || null);
      const chequeDateISO = this.toISODateInput(
        tplRow?.chequeDate || tplRow?.dueDate || null,
      );

      // instalmentDate in UI is display-only; keep epoch if template provides it, else use dueDate epoch if available
      const instalmentDateEpoch =
        typeof tplRow?.instalmentDate === 'number'
          ? tplRow.instalmentDate
          : typeof tplRow?.dueDate === 'number'
            ? tplRow.dueDate
            : null;

      chqFA.push(
        this.fb.group({
          sno: [sno],
          instalmentLabel: [label],
          instalmentDate: [instalmentDateEpoch],

          // ✅ chequeDate should be editable (not disabled) because required
          chequeDate: [chequeDateISO, [Validators.required]],

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

          dueDate: [dueDateISO, [Validators.required]],
          mode: ['PDC' as ChequeMode, [Validators.required]],
          bankName: ['', [Validators.required]],
          remarks: [''],
        }),
      );
    });

    this.form.setControl('cheques', chqFA);
  }

  private splitAdmissionRow(rows: any[]): {
    admissionRow: any | null;
    chequeRows: any[];
  } {
    if (!Array.isArray(rows) || !rows.length)
      return { admissionRow: null, chequeRows: [] };
    const isAdmission = (r: any) => {
      const label = this.normLabel(r?.instalmentLabel || r?.label || '');
      return label.includes('admission') || label.includes('advance');
    };
    const idx = rows.findIndex(isAdmission);
    if (idx < 0) return { admissionRow: null, chequeRows: rows };
    const admissionRow = rows[idx];
    const chequeRows = rows.filter((_: any, i: number) => i !== idx);
    return { admissionRow, chequeRows };
  }

  private normLabel(v: any): string {
    return String(v || '')
      .trim()
      .toLowerCase();
  }

  private patchSavedPayments(savedNeftRefs: any[], savedCheques: any[]): void {
    // NEFT patch
    if (Array.isArray(savedNeftRefs) && savedNeftRefs.length) {
      const fa = this.fb.array([]);
      savedNeftRefs.forEach((r: any) => {
        fa.push(
          this.fb.group({
            utr: [
              safeStr(r.utr),
              [
                Validators.required,
                Validators.minLength(6),
                Validators.maxLength(40),
              ],
            ],
            amount: [
              Number(r.amount || 0) || 0,
              [Validators.required, Validators.min(1)],
            ],
            paidOn: [this.epochToISODateInput(r.paidOn)],
            bankName: [safeStr(r.bankName)],
            referenceNote: [safeStr(r.referenceNote)],
            remarks: [safeStr(r.remarks)],
          }),
        );
      });
      this.form.setControl('neftRefs', fa);
    } else if (this.neftRefsFA.length === 0) {
      this.addNeftRef();
    }

    // Cheque patch by sno
    if (
      Array.isArray(savedCheques) &&
      savedCheques.length &&
      this.chequesFA.length
    ) {
      savedCheques.forEach((s: any) => {
        const sno = Number(s.sno || 0) || 0;
        const idx = this.chequesFA.controls.findIndex(
          (c: any) => Number(c.get('sno')?.value || 0) === sno,
        );
        if (idx >= 0) {
          const g = this.chequesFA.at(idx) as UntypedFormGroup;
          g.patchValue(
            {
              chequeNo: safeStr(s.chequeNo),
              chequeDate: this.epochToISODateInput(s.chequeDate),
              dueDate: this.epochToISODateInput(s.dueDate),

              bankName: safeStr(s.bankName),
              remarks: safeStr(s.remarks),
              mode: (s.mode === 'CDC' ? 'CDC' : 'PDC') as ChequeMode,

              instalmentLabel:
                safeStr(s.instalmentLabel) ||
                g.get('instalmentLabel')?.value ||
                '',
              instalmentDate:
                typeof s.instalmentDate === 'number'
                  ? s.instalmentDate
                  : g.get('instalmentDate')?.value || null,
            },
            { emitEvent: false },
          );
        }
      });
    }
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
      }),
    );
  }

  removeNeftRef(i: number): void {
    if (this.neftRefsFA.length <= 1) return;
    this.neftRefsFA.removeAt(i);
  }

  private extractNeftRefsFromPayments(payments: any[]): any[] {
    const nefts = (payments || []).filter(
      (p) => String(p.paymentType || '').toUpperCase() === 'NEFT',
    );
    return nefts
      .map((p: any) => ({
        utr: safeStr(p.neft?.utr || p.utr || ''),
        amount: Number(p.amount || 0) || 0,
        paidOn: p.neft?.paidOn ?? null,
        bankName: safeStr(p.neft?.bankName || ''),
        referenceNote: safeStr(p.neft?.referenceNote || ''),
        remarks: safeStr(p.remarks || ''),
      }))
      .filter((x: any) => !!safeStr(x.utr) || Number(x.amount || 0) > 0);
  }

  private extractChequesFromPayments(payments: any[]): any[] {
    const chq = (payments || []).filter(
      (p) => String(p.paymentType || '').toUpperCase() === 'CHEQUE',
    );
    return chq.map((p: any) => ({
      sno: Number(p.cheque?.sno || 0) || 0,
      chequeNo: safeStr(p.cheque?.chequeNo || ''),
      chequeDate: p.cheque?.chequeDate ?? null,
      dueDate: p.cheque?.dueDate ?? null,
      favourOf: safeStr(p.cheque?.favourOf || this.DEFAULT_FAVOUR_OF),
      mode: (p.cheque?.mode === 'CDC' ? 'CDC' : 'PDC') as ChequeMode,
      bankName: safeStr(p.cheque?.bankName || ''),
      amount: Number(p.amount || 0) || 0,
      remarks: safeStr(p.remarks || ''),
      instalmentLabel: safeStr(p.cheque?.instalmentLabel || ''),
      instalmentDate: p.cheque?.instalmentDate ?? null,
    }));
  }

  save(): void {
    if (this.submitting) return;

    const tenantId = this.pickTenantId();
    if (!tenantId) {
      this.alert.error('tenantId (entiId) is missing. Please login again.');
      return;
    }
    if (!this.admissionId) {
      this.alert.error('Admission not available.');
      return;
    }

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.alert.error('Please fill required NEFT/cheque details.');
      return;
    }

    const entered = this.neftTotalEntered;
    if (entered <= 0) {
      this.alert.error('Please add at least one NEFT reference amount.');
      return;
    }
    if (entered > this.neftAmount) {
      this.alert.error(
        `NEFT total (₹${entered}) cannot exceed NEFT split (₹${this.neftAmount}).`,
      );
      return;
    }

    const totalPaid = entered + this.chequeTotal;
    const totalDue = this.roundRupee(this.finalFee || 0);
    if (totalDue > 0 && Math.round(totalPaid) !== totalDue) {
      this.alert.error(
        `Total of NEFT and cheques (₹${totalPaid}) must match final fee (₹${totalDue}).`,
      );
      return;
    }

    // ✅ NEFT: convert paidOn to epoch
    const neftRefs = (this.neftRefsFA.value || [])
      .map((r: any) => ({
        utr: safeStr(r.utr),
        amount: Number(r.amount || 0),
        paidOn: this.dateInputToEpoch(r.paidOn),
        bankName: safeStr(r.bankName) || null,
        referenceNote: safeStr(r.referenceNote) || null,
        remarks: safeStr(r.remarks) || null,
      }))
      .filter((x: any) => !!x.utr && x.amount > 0);

    // ✅ Cheques: convert chequeDate/dueDate + send instalment fields
    const cheques = (this.chequesFA.getRawValue() || [])
      .map((r: any) => ({
        sno: Number(r.sno || 0) || 0,
        chequeNo: safeStr(r.chequeNo),
        chequeDate: this.dateInputToEpoch(r.chequeDate),
        dueDate: this.dateInputToEpoch(r.dueDate),
        instalmentLabel: safeStr(r.instalmentLabel) || null,
        instalmentDate: this.dateInputToEpoch(r.instalmentDate),
        favourOf: safeStr(this.DEFAULT_FAVOUR_OF),
        mode: (r.mode === 'CDC' ? 'CDC' : 'PDC') as ChequeMode,
        bankName: safeStr(r.bankName) || null,
        amount: Number(r.amount || 0),
        remarks: safeStr(r.remarks) || null,
      }))
      .filter((x: any) => !!x.chequeNo && !!x.dueDate && x.amount > 0);

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
            res?.message || res?.error || 'Failed to save payments',
          );
          return;
        }
        this.alert.success('Payment details updated.');
        this.back();
      },
      error: () => {
        this.submitting = false;
        this.alert.error('Failed to save payments');
      },
    });
  }

  back(): void {
    this.router.navigate(['app/admissions/view', this.admissionId]);
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
      const b = Math.floor(x);
      const f = x - b;
      return f >= 0.5 ? b + 1 : b;
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

  // For template labels etc.
  private toISODateInput(v: any): string | null {
    if (!v) return null;
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const iso = s.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (iso?.[1]) return iso[1];

    const dm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dm) {
      const dd = dm[1].padStart(2, '0');
      const mm = dm[2].padStart(2, '0');
      const yyyy = dm[3];
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

  private epochToISODateInput(v: any): string | null {
    if (!v) return null;
    if (typeof v === 'string') {
      // if already ISO date input
      const s = v.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      // if epoch in string
      const asNum = Number(s);
      if (Number.isFinite(asNum) && asNum > 0) v = asNum;
      else return this.toISODateInput(s);
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      const d = new Date(v);
      if (isNaN(d.getTime())) return null;
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }

  private dateInputToEpoch(v: any): number | null {
    if (!v) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;

    const s = String(v).trim();
    if (!s) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s + 'T00:00:00');
      return isNaN(d.getTime()) ? null : d.getTime();
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.getTime();
  }
}

function safeStr(v: any): string {
  return v === null || v === undefined ? '' : String(v).trim();
}
