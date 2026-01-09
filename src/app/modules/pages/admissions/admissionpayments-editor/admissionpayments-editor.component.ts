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
  readonly DEFAULT_FAVOUR_OF = 'ZEDSWEVEN I PRIVATE LIMITED';
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: UntypedFormBuilder,
    private api: CommonapiService,
    private alert: AlertService
  ) {}
  ngOnInit(): void {
    this.admissionId = String(
      this.route.snapshot.paramMap.get('id') || ''
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

  get totalCollected(): number {
    return (this.neftTotalEntered || 0) + (this.chequeTotal || 0);
  }

  get balanceAmount(): number {
    const due = Math.round(this.finalFee || 0);
    const paid = Math.round(this.totalCollected || 0);
    return Math.max(0, due - paid);
  }

  private pickTenantId(): string {
    return (localStorage.getItem('tenantId') || '').trim();
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
            resp?.message || resp?.error || 'Failed to load admission'
          );
          this.back();
          return;
        }
        const root = resp?.data || resp || {};
        this.registrationNumber = root.admission.registrationNumber;
        const admission = root?.admission || root?.data?.admission || root;
        const fee = admission?.fee || root?.fee || {};
        const breakup = Array.isArray(fee?.breakup) ? fee.breakup : [];
        const breakupSum = breakup.reduce(
          (s: number, r: any) => s + (Number(r?.total || 0) || 0),
          0
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
        const tplBody = { entiId: tenantId, admissionId: this.admissionId };
        this.api.fetchData(tplBody, 'admi', 'paymenttemplate').subscribe({
          next: (tpl: any) => {
            if (!tpl?.status) {
              this.loading = false;
              this.alert.error(
                tpl?.message ||
                  tpl?.error ||
                  'Failed to load instalment template'
              );
              return;
            }
            const tdata = tpl?.data || {};
            this.chequeTemplate = Array.isArray(tdata?.chequeTemplate)
              ? tdata.chequeTemplate
              : [];
            this.neftTemplateAmount =
              tdata?.neftAmount != null && Number(tdata.neftAmount) > 0
                ? Number(tdata.neftAmount)
                : savedNeftSplitFromObj > 0
                ? savedNeftSplitFromObj
                : null;
            if (!this.chequeTemplate.length) {
              this.loading = false;
              this.alert.error(
                'Cheque template not returned from paymenttemplate API'
              );
              return;
            }
            this.buildPaymentsFromFinalFee(
              this.finalFee,
              this.neftTemplateAmount,
              this.chequeTemplate
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
    chequeTpl: any[]
  ): void {
    const due = this.roundRupee(finalFee);
    const { admissionRow, chequeRows } = this.splitAdmissionRow(
      chequeTpl || []
    );
    let baseNeft =
      neftTplAmount != null &&
      Number.isFinite(neftTplAmount) &&
      Number(neftTplAmount) > 0
        ? Number(neftTplAmount)
        : Number(admissionRow?.amount || 0) || 0;

    if (!baseNeft) {
      const neftPay = (this.existingPayments || []).find(
        (p: any) => String(p.paymentType || '').toUpperCase() === 'NEFT'
      );
      baseNeft = Number(neftPay?.amount || 0) || 0;
    }
    const chequeBase = (chequeRows || []).map(
      (x: any) => Number(x?.amount || 0) || 0
    );
    const baseAmounts = [baseNeft, ...chequeBase];
    const baseTotal = baseAmounts.reduce(
      (s: number, x: number) => s + (Number(x) || 0),
      0
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
    this.form.setControl('neftRefs', neftFA);
    const chqFA = this.fb.array([]) as UntypedFormArray;
    chequeAmounts.forEach((amt: number, idx: number) => {
      const tplRow = chequeRows[idx] || {};
      const sno = Number(tplRow?.sno || idx + 1) || idx + 1;
      const label = String(
        tplRow?.instalmentLabel || tplRow?.label || `Instalment ${sno}`
      ).trim();
      const chequeDateISO = this.toISODateInput(
        tplRow?.chequeDate || tplRow?.dueDate || null
      );
      chqFA.push(
        this.fb.group({
          sno: [sno],
          instalmentLabel: [label],
          chequeDate: [
            { value: chequeDateISO, disabled: true },
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
    if (Array.isArray(savedNeftRefs) && savedNeftRefs.length) {
      const fa = this.fb.array([]);
      savedNeftRefs.forEach((r: any) => {
        fa.push(
          this.fb.group({
            utr: [
              String(r.utr || '').trim(),
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
            paidOn: [r.paidOn || null],
            bankName: [r.bankName || ''],
            referenceNote: [r.referenceNote || ''],
            remarks: [r.remarks || ''],
          })
        );
      });
      this.form.setControl('neftRefs', fa);
    } else if (this.neftRefsFA.length === 0) {
      this.addNeftRef();
    }
    if (
      Array.isArray(savedCheques) &&
      savedCheques.length &&
      this.chequesFA.length
    ) {
      savedCheques.forEach((s: any) => {
        const sno = Number(s.sno || 0) || 0;
        const idx = this.chequesFA.controls.findIndex(
          (c: any) => Number(c.get('sno')?.value || 0) === sno
        );
        if (idx >= 0) {
          const g = this.chequesFA.at(idx) as UntypedFormGroup;
          g.patchValue(
            {
              chequeNo: String(s.chequeNo || '').trim(),
              dueDate: this.toISODateInput(s.dueDate),
              bankName: s.bankName || '',
              remarks: s.remarks || '',
              mode: (s.mode === 'CDC' ? 'CDC' : 'PDC') as ChequeMode,
              instalmentLabel:
                s.instalmentLabel || g.get('instalmentLabel')?.value || '',
            },
            { emitEvent: false }
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
      })
    );
  }

  removeNeftRef(i: number): void {
    if (this.neftRefsFA.length <= 1) return;
    this.neftRefsFA.removeAt(i);
  }

  private extractNeftRefsFromPayments(payments: any[]): any[] {
    const nefts = (payments || []).filter(
      (p) => String(p.paymentType || '').toUpperCase() === 'NEFT'
    );
    return nefts
      .map((p: any) => ({
        utr: p.neft?.utr || p.utr || '',
        amount: Number(p.amount || 0) || 0,
        paidOn: p.neft?.paidOn || null,
        bankName: p.neft?.bankName || '',
        referenceNote: p.neft?.referenceNote || '',
        remarks: p.remarks || '',
      }))
      .filter(
        (x: any) => !!String(x.utr || '').trim() || Number(x.amount || 0) > 0
      );
  }

  private extractChequesFromPayments(payments: any[]): any[] {
    const chq = (payments || []).filter(
      (p) => String(p.paymentType || '').toUpperCase() === 'CHEQUE'
    );
    return chq.map((p: any) => ({
      sno: Number(p.cheque?.sno || 0) || 0,
      chequeNo: p.cheque?.chequeNo || '',
      chequeDate: p.cheque?.chequeDate || null,
      dueDate: p.cheque?.dueDate || null,
      favourOf: p.cheque?.favourOf || this.DEFAULT_FAVOUR_OF,
      mode: p.cheque?.mode || 'PDC',
      bankName: p.cheque?.bankName || '',
      amount: Number(p.amount || 0) || 0,
      remarks: p.remarks || '',
      instalmentLabel: p.cheque?.instalmentLabel || '',
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
        chequeDate: r.chequeDate || null,
        dueDate: r.dueDate || null,
        favourOf: String(this.DEFAULT_FAVOUR_OF || '').trim(),
        mode: (r.mode === 'CDC' ? 'CDC' : 'PDC') as ChequeMode,
        bankName: String(r.bankName || '').trim() || null,
        amount: Number(r.amount || 0),
        remarks: String(r.remarks || '').trim() || null,
        instalmentLabel: String(r.instalmentLabel || '').trim() || null,
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
            res?.message || res?.error || 'Failed to save payments'
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
    baseTotal: number
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
}
